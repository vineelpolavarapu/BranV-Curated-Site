"""
Brands business logic — port of `apps/api/src/brands/brands.service.ts` +
the public read endpoints in `apps/api/src/storefront/brands-public.controller.ts`.

Parity rules:
  * Soft-delete: if a brand has any products, DELETE flips status→ARCHIVED
    instead of removing the row (PRD §21 — click history must not break).
  * Slug generation: slugify the input, then suffix `-2`, `-3`, ... until unique.
  * Public listing returns only ACTIVE brands, featured first then A→Z, with
    `_count.products` scoped to status=ACTIVE products.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.pagination import make_page
from ..core.slug import ensure_unique_slug, slugify
from ..db.models import Brand, Product
from . import audit_service

_CUID_ALPHABET = string.ascii_lowercase + string.digits


def _mint_cuid() -> str:
    return "c" + "".join(secrets.choice(_CUID_ALPHABET) for _ in range(24))


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso_ms(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _serialize(b: Brand, product_count: int | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": b.id_,
        "slug": b.slug,
        "name": b.name,
        "logoUrl": b.logoUrl,
        "heroUrl": b.heroUrl,
        "description": b.description,
        "isFeatured": b.isFeatured,
        "status": b.status,
        "createdAt": _iso_ms(b.createdAt),
        "updatedAt": _iso_ms(b.updatedAt),
    }
    if product_count is not None:
        out["_count"] = {"products": product_count}
    return out


# ───────────── admin ────────────────────────────────────────────────────────


async def list_admin(
    db: AsyncSession, *, page: int, page_size: int, search: str | None
) -> dict[str, Any]:
    where = True
    if search:
        s = f"%{search.lower()}%"
        where = or_(
            func.lower(Brand.name).like(s),
            func.lower(Brand.slug).like(s),
        )
    total = (await db.execute(select(func.count()).select_from(Brand).where(where))).scalar_one()

    rows = (await db.execute(
        select(Brand)
        .where(where)
        .order_by(Brand.isFeatured.desc(), Brand.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    if not rows:
        return make_page([], total, page, page_size)

    # _count.products (status filter NOT applied for the admin view — matches Nest).
    counts = dict(
        (await db.execute(
            select(Product.brandId, func.count(Product.id_))
            .where(Product.brandId.in_([b.id_ for b in rows]))
            .group_by(Product.brandId)
        )).all()
    )
    data = [_serialize(b, product_count=counts.get(b.id_, 0)) for b in rows]
    return make_page(data, total, page, page_size)


async def get_by_id(db: AsyncSession, brand_id: str) -> dict[str, Any] | None:
    b = (await db.execute(select(Brand).where(Brand.id_ == brand_id))).scalar_one_or_none()
    if b is None:
        return None
    count = (await db.execute(
        select(func.count(Product.id_)).where(Product.brandId == brand_id)
    )).scalar_one()
    return _serialize(b, product_count=count)


async def create(db: AsyncSession, *, dto: dict[str, Any], actor_id: str) -> dict[str, Any]:
    base_slug = slugify(dto.get("slug") or dto["name"])

    async def is_taken(cand: str) -> bool:
        return (await db.execute(
            select(Brand.id_).where(Brand.slug == cand).limit(1)
        )).first() is not None

    slug = await ensure_unique_slug(base_slug, is_taken)
    now = _utcnow_naive()
    brand = Brand(
        id_=_mint_cuid(),
        slug=slug,
        name=dto["name"],
        logoUrl=dto.get("logoUrl"),
        heroUrl=dto.get("heroUrl"),
        description=dto.get("description"),
        isFeatured=bool(dto.get("isFeatured", False)),
        status=dto.get("status") or "ACTIVE",
        createdAt=now,
        updatedAt=now,
    )
    db.add(brand)
    await db.commit()
    # Re-load to get any server defaults the model carries.
    brand = (await db.execute(select(Brand).where(Brand.id_ == brand.id_))).scalar_one()

    # Audit (no transactional dependency, so just call inline rather than via BackgroundTasks).
    await audit_service.record(
        actorId=actor_id,
        action="brand.create",
        targetType="brand",
        targetId=brand.id_,
        metadata={"name": brand.name, "slug": brand.slug},
    )
    return _serialize(brand)


async def update_brand(
    db: AsyncSession, *, brand_id: str, dto: dict[str, Any], actor_id: str
) -> dict[str, Any] | None:
    existing = (await db.execute(
        select(Brand).where(Brand.id_ == brand_id)
    )).scalar_one_or_none()
    if existing is None:
        return None

    next_slug = existing.slug
    if dto.get("slug") and dto["slug"] != existing.slug:
        async def is_taken(cand: str) -> bool:
            row = (await db.execute(
                select(Brand.id_).where(Brand.slug == cand).limit(1)
            )).scalar_one_or_none()
            return row is not None and row != brand_id
        next_slug = await ensure_unique_slug(slugify(dto["slug"]), is_taken)

    values: dict[str, Any] = {"updatedAt": _utcnow_naive(), "slug": next_slug}
    for k in ("name", "logoUrl", "heroUrl", "description", "isFeatured", "status"):
        if dto.get(k) is not None:
            values[k] = dto[k]
    await db.execute(update(Brand).where(Brand.id_ == brand_id).values(**values))
    await db.commit()

    fresh = (await db.execute(select(Brand).where(Brand.id_ == brand_id))).scalar_one()
    await audit_service.record(
        actorId=actor_id, action="brand.update", targetType="brand", targetId=brand_id
    )
    return _serialize(fresh)


async def delete_brand(db: AsyncSession, *, brand_id: str, actor_id: str) -> bool:
    """Returns True if deleted/archived, False if brand not found."""
    brand = (await db.execute(
        select(Brand).where(Brand.id_ == brand_id)
    )).scalar_one_or_none()
    if brand is None:
        return False

    product_count = (await db.execute(
        select(func.count(Product.id_)).where(Product.brandId == brand_id)
    )).scalar_one()

    if product_count > 0:
        await db.execute(
            update(Brand)
            .where(Brand.id_ == brand_id)
            .values(status="ARCHIVED", updatedAt=_utcnow_naive())
        )
        await db.commit()
        await audit_service.record(
            actorId=actor_id,
            action="brand.archive",
            targetType="brand",
            targetId=brand_id,
            metadata={"productCount": product_count},
        )
    else:
        await db.execute(delete(Brand).where(Brand.id_ == brand_id))
        await db.commit()
        await audit_service.record(
            actorId=actor_id, action="brand.delete", targetType="brand", targetId=brand_id
        )
    return True


# ───────────── public ───────────────────────────────────────────────────────


async def list_public(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (await db.execute(
        select(Brand)
        .where(Brand.status == "ACTIVE")
        .order_by(Brand.isFeatured.desc(), Brand.name.asc())
    )).scalars().all()
    if not rows:
        return []
    counts = dict(
        (await db.execute(
            select(Product.brandId, func.count(Product.id_))
            .where(and_(Product.brandId.in_([b.id_ for b in rows]), Product.status == "ACTIVE"))
            .group_by(Product.brandId)
        )).all()
    )
    return [
        {
            "id": b.id_,
            "slug": b.slug,
            "name": b.name,
            "logoUrl": b.logoUrl,
            "heroUrl": b.heroUrl,
            "isFeatured": b.isFeatured,
            "_count": {"products": counts.get(b.id_, 0)},
        }
        for b in rows
    ]


async def get_public_by_slug(db: AsyncSession, slug: str) -> dict[str, Any] | None:
    b = (await db.execute(select(Brand).where(Brand.slug == slug))).scalar_one_or_none()
    if b is None or b.status != "ACTIVE":
        return None
    count = (await db.execute(
        select(func.count(Product.id_))
        .where(and_(Product.brandId == b.id_, Product.status == "ACTIVE"))
    )).scalar_one()
    return _serialize(b, product_count=count)
