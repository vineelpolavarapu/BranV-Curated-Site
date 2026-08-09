"""Categories - flat list, slug lookup, attribute-schema CRUD per category."""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Category, CategoryAttributeSchema, Product
from . import audit_service

_CUID_ALPHABET = string.ascii_lowercase + string.digits


def _cuid() -> str:
    return "c" + "".join(secrets.choice(_CUID_ALPHABET) for _ in range(24))


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso_ms(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _serialize_cat(c: Category, counts: dict[str, int] | None = None) -> dict[str, Any]:
    out = {
        "id": c.id_,
        "parentId": c.parentId,
        "slug": c.slug,
        "name": c.name,
        "path": c.path,
        "displayOrder": c.displayOrder,
        "createdAt": _iso_ms(c.createdAt),
        "updatedAt": _iso_ms(c.updatedAt),
    }
    if counts is not None:
        out["_count"] = {
            "productsAsCategory": counts.get("cat", 0),
            "productsAsSubcategory": counts.get("subcat", 0),
            "attributeSchemas": counts.get("schemas", 0),
        }
    return out


def _serialize_schema(s: CategoryAttributeSchema) -> dict[str, Any]:
    return {
        "id": s.id_,
        "categoryId": s.categoryId,
        "attributeKey": s.attributeKey,
        "displayName": s.displayName,
        "filterType": s.filterType,
        "optionsJson": s.optionsJson,
        "displayOrder": s.displayOrder,
        "createdAt": _iso_ms(s.createdAt),
        "updatedAt": _iso_ms(s.updatedAt),
    }


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (await db.execute(
        select(Category).order_by(Category.path.asc(), Category.displayOrder.asc())
    )).scalars().all()
    if not rows:
        return []

    ids = [c.id_ for c in rows]
    cat_counts = dict(
        (await db.execute(
            select(Product.categoryId, func.count(Product.id_))
            .where(Product.categoryId.in_(ids))
            .group_by(Product.categoryId)
        )).all()
    )
    subcat_counts = dict(
        (await db.execute(
            select(Product.subcategoryId, func.count(Product.id_))
            .where(Product.subcategoryId.in_(ids))
            .group_by(Product.subcategoryId)
        )).all()
    )
    schema_counts = dict(
        (await db.execute(
            select(CategoryAttributeSchema.categoryId, func.count(CategoryAttributeSchema.id_))
            .where(CategoryAttributeSchema.categoryId.in_(ids))
            .group_by(CategoryAttributeSchema.categoryId)
        )).all()
    )
    return [
        _serialize_cat(c, counts={
            "cat": cat_counts.get(c.id_, 0),
            "subcat": subcat_counts.get(c.id_, 0),
            "schemas": schema_counts.get(c.id_, 0),
        })
        for c in rows
    ]


async def get_by_slug(db: AsyncSession, slug: str) -> dict[str, Any] | None:
    c = (await db.execute(select(Category).where(Category.slug == slug))).scalar_one_or_none()
    if c is None:
        return None
    parent = None
    if c.parentId:
        parent_row = (await db.execute(
            select(Category.slug).where(Category.id_ == c.parentId)
        )).scalar_one_or_none()
        if parent_row:
            parent = {"slug": parent_row}
    children = (await db.execute(
        select(Category).where(Category.parentId == c.id_).order_by(Category.displayOrder.asc())
    )).scalars().all()
    schemas = (await db.execute(
        select(CategoryAttributeSchema)
        .where(CategoryAttributeSchema.categoryId == c.id_)
        .order_by(CategoryAttributeSchema.displayOrder.asc())
    )).scalars().all()
    out = _serialize_cat(c)
    out["parent"] = parent
    out["children"] = [_serialize_cat(ch) for ch in children]
    out["attributeSchemas"] = [_serialize_schema(s) for s in schemas]
    return out


async def list_schemas(db: AsyncSession, category_id: str) -> list[dict[str, Any]] | None:
    if (await db.execute(select(Category.id_).where(Category.id_ == category_id))).scalar_one_or_none() is None:
        return None
    rows = (await db.execute(
        select(CategoryAttributeSchema)
        .where(CategoryAttributeSchema.categoryId == category_id)
        .order_by(CategoryAttributeSchema.displayOrder.asc())
    )).scalars().all()
    return [_serialize_schema(s) for s in rows]


async def upsert_schema(
    db: AsyncSession, *, category_id: str, dto: dict[str, Any], actor_id: str
) -> dict[str, Any] | None:
    if (await db.execute(select(Category.id_).where(Category.id_ == category_id))).scalar_one_or_none() is None:
        return None
    now = _now()
    existing = (await db.execute(
        select(CategoryAttributeSchema)
        .where(
            CategoryAttributeSchema.categoryId == category_id,
            CategoryAttributeSchema.attributeKey == dto["attributeKey"],
        )
    )).scalar_one_or_none()
    if existing:
        await db.execute(
            update(CategoryAttributeSchema)
            .where(CategoryAttributeSchema.id_ == existing.id_)
            .values(
                displayName=dto["displayName"],
                filterType=dto["filterType"],
                optionsJson=dto.get("optionsJson"),
                displayOrder=dto.get("displayOrder") or 0,
                updatedAt=now,
            )
        )
        sid = existing.id_
    else:
        sid = _cuid()
        db.add(
            CategoryAttributeSchema(
                id_=sid,
                categoryId=category_id,
                attributeKey=dto["attributeKey"],
                displayName=dto["displayName"],
                filterType=dto["filterType"],
                optionsJson=dto.get("optionsJson"),
                displayOrder=dto.get("displayOrder") or 0,
                createdAt=now,
                updatedAt=now,
            )
        )
    await db.commit()
    await audit_service.record(
        actorId=actor_id,
        action="category.attribute.upsert",
        targetType="category",
        targetId=category_id,
        metadata={"attributeKey": dto["attributeKey"]},
    )
    fresh = (await db.execute(
        select(CategoryAttributeSchema).where(CategoryAttributeSchema.id_ == sid)
    )).scalar_one()
    return _serialize_schema(fresh)


async def bulk_upsert(
    db: AsyncSession, *, category_id: str, items: list[dict[str, Any]], actor_id: str
) -> list[dict[str, Any]] | None:
    if (await db.execute(select(Category.id_).where(Category.id_ == category_id))).scalar_one_or_none() is None:
        return None
    out = []
    for item in items:
        result = await upsert_schema(db, category_id=category_id, dto=item, actor_id=actor_id)
        if result is not None:
            out.append(result)
    return out


async def delete_schema(
    db: AsyncSession, *, category_id: str, attribute_key: str, actor_id: str
) -> bool:
    if (await db.execute(select(Category.id_).where(Category.id_ == category_id))).scalar_one_or_none() is None:
        return False
    result = await db.execute(
        delete(CategoryAttributeSchema).where(
            CategoryAttributeSchema.categoryId == category_id,
            CategoryAttributeSchema.attributeKey == attribute_key,
        )
    )
    await db.commit()
    await audit_service.record(
        actorId=actor_id,
        action="category.attribute.delete",
        targetType="category",
        targetId=category_id,
        metadata={"attributeKey": attribute_key},
    )
    return result.rowcount > 0
