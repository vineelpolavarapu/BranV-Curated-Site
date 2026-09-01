"""
Content admin + public domains: articles, edits.

Both follow the same shape: admin CRUD with slug+status workflow, public
list/detail by slug.

Soft-delete on articles: DELETE flips status→ARCHIVED.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import Field
from sqlalchemy import and_, delete, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import (
    AuthenticatedUser,
    current_user_required,
    enforce_two_factor,
    require_roles,
)
from ...core.pagination import make_page
from ...core.pydantic_config import ApiModel
from ...core.slug import ensure_unique_slug, slugify
from ...db.models import (
    Article,
    Edit,
    EditProduct,
    Product,
)
from ...db.session import get_db
from ...services import audit_service

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDeps = [
    Depends(current_user_required),
    Depends(require_roles("ADMIN")),
    Depends(enforce_two_factor),
]

_ALPH = string.ascii_lowercase + string.digits


def _cuid() -> str:
    return "c" + "".join(secrets.choice(_ALPH) for _ in range(24))


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


# ───────────── ARTICLES ─────────────────────────────────────────────────────

articles_admin_router = APIRouter(prefix="/admin/articles", tags=["admin-articles"], dependencies=AdminDeps)
articles_public_router = APIRouter(prefix="/articles", tags=["articles"])

ArticleStatusLit = Literal["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]


class ArticleRequest(ApiModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=140)
    heroUrl: str | None = None
    excerpt: str | None = Field(default=None, max_length=500)
    bodyMd: str | None = Field(default=None, max_length=50_000)
    status: ArticleStatusLit | None = None
    scheduledAt: str | None = None
    publishedAt: str | None = None
    tags: list[str] | None = Field(default=None, max_length=20)
    metaTitle: str | None = Field(default=None, max_length=200)
    metaDescription: str | None = Field(default=None, max_length=500)
    ogImage: str | None = None


def _parse_dt(s: str | None) -> datetime | None:
    if s is None:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)


def _serialize_article(a: Article) -> dict[str, Any]:
    return {
        "id": a.id_,
        "slug": a.slug,
        "title": a.title,
        "heroUrl": a.heroUrl,
        "excerpt": a.excerpt,
        "bodyMd": a.bodyMd,
        "status": a.status,
        "scheduledAt": _iso(a.scheduledAt),
        "publishedAt": _iso(a.publishedAt),
        "authorId": a.authorId,
        "tags": a.tags or [],
        "metaTitle": a.metaTitle,
        "metaDescription": a.metaDescription,
        "ogImage": a.ogImage,
        "readingMinutes": a.readingMinutes,
        "createdAt": _iso(a.createdAt),
        "updatedAt": _iso(a.updatedAt),
    }


@articles_admin_router.get("")
async def articles_admin_list(
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=60)] = 12,
    search: Annotated[str | None, Query()] = None,
    tag: Annotated[str | None, Query()] = None,
    status_: Annotated[ArticleStatusLit | None, Query(alias="status")] = None,
) -> dict[str, Any]:
    conds = []
    if status_:
        conds.append(Article.status == status_)
    if search:
        s = f"%{search.lower()}%"
        conds.append(or_(func.lower(Article.title).like(s), func.lower(Article.slug).like(s)))
    if tag:
        conds.append(Article.tags.contains([tag]))
    where = and_(*conds) if conds else True  # noqa: E712
    total = (await db.execute(select(func.count(Article.id_)).where(where))).scalar_one()
    rows = (await db.execute(
        select(Article).where(where).order_by(desc(Article.updatedAt))
        .offset((page - 1) * pageSize).limit(pageSize)
    )).scalars().all()
    return make_page([_serialize_article(a) for a in rows], total, page, pageSize)


@articles_admin_router.get("/{article_id}")
async def articles_admin_get(article_id: str, db: DbDep) -> dict[str, Any]:
    a = (await db.execute(select(Article).where(Article.id_ == article_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Article not found")
    return _serialize_article(a)


async def _unique_article_slug(db: AsyncSession, base: str, exclude_id: str | None = None) -> str:
    async def taken(cand: str) -> bool:
        row = (await db.execute(select(Article.id_).where(Article.slug == cand))).scalar_one_or_none()
        return row is not None and row != exclude_id
    return await ensure_unique_slug(base, taken)


@articles_admin_router.post("", status_code=201)
async def articles_admin_create(
    payload: ArticleRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    base = slugify(payload.slug or payload.title)
    slug = await _unique_article_slug(db, base)
    status_ = payload.status or "DRAFT"
    now = _now()
    a = Article(
        id_=_cuid(),
        slug=slug,
        title=payload.title,
        heroUrl=payload.heroUrl,
        excerpt=payload.excerpt,
        bodyMd=payload.bodyMd or "",
        status=status_,
        scheduledAt=_parse_dt(payload.scheduledAt),
        publishedAt=_parse_dt(payload.publishedAt) or (now if status_ == "PUBLISHED" else None),
        authorId=user.id,
        tags=payload.tags or [],
        metaTitle=payload.metaTitle,
        metaDescription=payload.metaDescription,
        ogImage=payload.ogImage,
        readingMinutes=max(1, len((payload.bodyMd or "").split()) // 200),
        createdAt=now,
        updatedAt=now,
    )
    db.add(a)
    await db.commit()
    await audit_service.record(actorId=user.id, action="article.create", targetType="article", targetId=a.id_)
    return _serialize_article(a)


@articles_admin_router.patch("/{article_id}")
async def articles_admin_update(
    article_id: str,
    payload: ArticleRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    existing = (await db.execute(select(Article).where(Article.id_ == article_id))).scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Article not found")
    values: dict[str, Any] = {"updatedAt": _now()}
    if payload.slug and payload.slug != existing.slug:
        values["slug"] = await _unique_article_slug(db, slugify(payload.slug), exclude_id=article_id)
    for k in ("title", "heroUrl", "excerpt", "bodyMd", "tags",
              "metaTitle", "metaDescription", "ogImage", "status"):
        v = getattr(payload, k)
        if v is not None:
            values[k] = v
    if payload.scheduledAt is not None:
        values["scheduledAt"] = _parse_dt(payload.scheduledAt)
    if payload.publishedAt is not None:
        values["publishedAt"] = _parse_dt(payload.publishedAt)
    # First-time publish stamps publishedAt now.
    if payload.status == "PUBLISHED" and existing.status != "PUBLISHED" and not values.get("publishedAt"):
        values["publishedAt"] = _now()
    await db.execute(update(Article).where(Article.id_ == article_id).values(**values))
    await db.commit()
    await audit_service.record(actorId=user.id, action="article.update", targetType="article", targetId=article_id)
    fresh = (await db.execute(select(Article).where(Article.id_ == article_id))).scalar_one()
    return _serialize_article(fresh)


@articles_admin_router.delete("/{article_id}", status_code=204, response_class=Response)
async def articles_admin_delete(
    article_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    # Soft-delete: flip to ARCHIVED (matches Nest behavior - preserves embeds + analytics).
    result = await db.execute(
        update(Article).where(Article.id_ == article_id).values(status="ARCHIVED", updatedAt=_now())
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "Article not found")
    await audit_service.record(actorId=user.id, action="article.archive", targetType="article", targetId=article_id)
    return Response(status_code=204)


@articles_public_router.get("")
async def articles_public_list(
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=60)] = 12,
    tag: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    conds = [Article.status == "PUBLISHED"]
    if tag:
        conds.append(Article.tags.contains([tag]))
    where = and_(*conds)
    total = (await db.execute(select(func.count(Article.id_)).where(where))).scalar_one()
    rows = (await db.execute(
        select(Article).where(where).order_by(desc(Article.publishedAt))
        .offset((page - 1) * pageSize).limit(pageSize)
    )).scalars().all()
    return make_page([_serialize_article(a) for a in rows], total, page, pageSize)


@articles_public_router.get("/{slug}")
async def articles_public_detail(slug: str, db: DbDep) -> dict[str, Any]:
    a = (await db.execute(
        select(Article).where(Article.slug == slug, Article.status == "PUBLISHED")
    )).scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Article not found")
    return _serialize_article(a)


@articles_public_router.get("/{slug}/related")
async def articles_public_related(slug: str, db: DbDep) -> list[dict[str, Any]]:
    a = (await db.execute(select(Article).where(Article.slug == slug))).scalar_one_or_none()
    if not a:
        return []
    rows = (await db.execute(
        select(Article)
        .where(
            Article.status == "PUBLISHED",
            Article.id_ != a.id_,
        )
        .order_by(desc(Article.publishedAt))
        .limit(4)
    )).scalars().all()
    return [_serialize_article(r) for r in rows]


# ───────────── EDITS ────────────────────────────────────────────────────────

edits_admin_router = APIRouter(prefix="/admin/edits", tags=["admin-edits"], dependencies=AdminDeps)
edits_public_router = APIRouter(prefix="/edits", tags=["edits"])

EditStatusLit = Literal["DRAFT", "PUBLISHED", "ARCHIVED"]


class EditRequest(ApiModel):
    title: str = Field(min_length=1, max_length=140)
    slug: str | None = Field(default=None, max_length=140)
    heroUrl: str | None = None
    description: str | None = Field(default=None, max_length=2000)
    status: EditStatusLit | None = None
    isFeaturedOnHome: bool | None = None
    productIds: list[str] | None = Field(default=None, max_length=80)


def _serialize_edit(e: Edit, products: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    out = {
        "id": e.id_,
        "slug": e.slug,
        "title": e.title,
        "heroUrl": e.heroUrl,
        "description": e.description,
        "status": e.status,
        "isFeaturedOnHome": e.isFeaturedOnHome,
        "publishedAt": _iso(e.publishedAt),
        "createdAt": _iso(e.createdAt),
        "updatedAt": _iso(e.updatedAt),
    }
    if products is not None:
        out["editProducts"] = products
    return out


async def _unique_edit_slug(db: AsyncSession, base: str, exclude_id: str | None = None) -> str:
    async def taken(cand: str) -> bool:
        row = (await db.execute(select(Edit.id_).where(Edit.slug == cand))).scalar_one_or_none()
        return row is not None and row != exclude_id
    return await ensure_unique_slug(base, taken)


@edits_admin_router.get("")
async def edits_admin_list(
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=60)] = 24,
    search: Annotated[str | None, Query()] = None,
    status_: Annotated[EditStatusLit | None, Query(alias="status")] = None,
) -> dict[str, Any]:
    conds = []
    if status_:
        conds.append(Edit.status == status_)
    if search:
        s = f"%{search.lower()}%"
        conds.append(or_(func.lower(Edit.title).like(s), func.lower(Edit.slug).like(s)))
    where = and_(*conds) if conds else True  # noqa: E712
    total = (await db.execute(select(func.count(Edit.id_)).where(where))).scalar_one()
    rows = (await db.execute(
        select(Edit).where(where).order_by(desc(Edit.updatedAt))
        .offset((page - 1) * pageSize).limit(pageSize)
    )).scalars().all()
    return make_page([_serialize_edit(e) for e in rows], total, page, pageSize)


@edits_admin_router.get("/{edit_id}")
async def edits_admin_get(edit_id: str, db: DbDep) -> dict[str, Any]:
    e = (await db.execute(select(Edit).where(Edit.id_ == edit_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Edit not found")
    eps = (await db.execute(
        select(EditProduct, Product.slug, Product.title)
        .outerjoin(Product, Product.id_ == EditProduct.productId)
        .where(EditProduct.editId == edit_id)
        .order_by(EditProduct.position.asc())
    )).all()
    products = [
        {"productId": ep.productId, "position": ep.position,
         "product": {"id": ep.productId, "slug": slug, "title": title} if slug else None}
        for ep, slug, title in eps
    ]
    return _serialize_edit(e, products=products)


@edits_admin_router.post("", status_code=201)
async def edits_admin_create(
    payload: EditRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    slug = await _unique_edit_slug(db, slugify(payload.slug or payload.title))
    status_ = payload.status or "DRAFT"
    now = _now()
    if payload.isFeaturedOnHome:
        await db.execute(update(Edit).where(Edit.isFeaturedOnHome.is_(True)).values(isFeaturedOnHome=False))
    edit_id = _cuid()
    db.add(Edit(
        id_=edit_id, slug=slug, title=payload.title, heroUrl=payload.heroUrl,
        description=payload.description, status=status_,
        isFeaturedOnHome=bool(payload.isFeaturedOnHome),
        publishedAt=now if status_ == "PUBLISHED" else None,
        createdAt=now, updatedAt=now,
    ))
    await db.flush()
    for idx, pid in enumerate(payload.productIds or []):
        db.add(EditProduct(id_=_cuid(), editId=edit_id, productId=pid, position=idx,
                           createdAt=now, updatedAt=now))
    await db.commit()
    await audit_service.record(actorId=user.id, action="edit.create", targetType="edit", targetId=edit_id)
    fresh = (await db.execute(select(Edit).where(Edit.id_ == edit_id))).scalar_one()
    return _serialize_edit(fresh)


@edits_admin_router.patch("/{edit_id}")
async def edits_admin_update(
    edit_id: str,
    payload: EditRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    existing = (await db.execute(select(Edit).where(Edit.id_ == edit_id))).scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Edit not found")
    values: dict[str, Any] = {"updatedAt": _now()}
    if payload.slug and payload.slug != existing.slug:
        values["slug"] = await _unique_edit_slug(db, slugify(payload.slug), exclude_id=edit_id)
    for k in ("title", "heroUrl", "description", "status", "isFeaturedOnHome"):
        v = getattr(payload, k)
        if v is not None:
            values[k] = v
    if payload.status == "PUBLISHED" and existing.status != "PUBLISHED":
        values["publishedAt"] = _now()
    if payload.isFeaturedOnHome:
        await db.execute(
            update(Edit).where(Edit.isFeaturedOnHome.is_(True), Edit.id_ != edit_id)
            .values(isFeaturedOnHome=False)
        )
    await db.execute(update(Edit).where(Edit.id_ == edit_id).values(**values))
    if payload.productIds is not None:
        await db.execute(delete(EditProduct).where(EditProduct.editId == edit_id))
        now = _now()
        for idx, pid in enumerate(payload.productIds):
            db.add(EditProduct(id_=_cuid(), editId=edit_id, productId=pid, position=idx,
                               createdAt=now, updatedAt=now))
    await db.commit()
    await audit_service.record(actorId=user.id, action="edit.update", targetType="edit", targetId=edit_id)
    fresh = (await db.execute(select(Edit).where(Edit.id_ == edit_id))).scalar_one()
    return _serialize_edit(fresh)


@edits_admin_router.delete("/{edit_id}", status_code=204, response_class=Response)
async def edits_admin_delete(
    edit_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    result = await db.execute(
        update(Edit).where(Edit.id_ == edit_id).values(status="ARCHIVED", updatedAt=_now())
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "Edit not found")
    await audit_service.record(actorId=user.id, action="edit.archive", targetType="edit", targetId=edit_id)
    return Response(status_code=204)


@edits_public_router.get("")
async def edits_public_list(db: DbDep) -> list[dict[str, Any]]:
    rows = (await db.execute(
        select(Edit).where(Edit.status == "PUBLISHED").order_by(desc(Edit.publishedAt))
    )).scalars().all()
    return [_serialize_edit(e) for e in rows]


@edits_public_router.get("/{slug}")
async def edits_public_detail(slug: str, db: DbDep) -> dict[str, Any]:
    from ...services.storefront_service import _hydrate_card

    e = (await db.execute(
        select(Edit).where(Edit.slug == slug, Edit.status == "PUBLISHED")
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Edit not found")
    eps = (await db.execute(
        select(EditProduct, Product)
        .join(Product, Product.id_ == EditProduct.productId)
        .where(EditProduct.editId == e.id_, Product.status == "ACTIVE")
        .order_by(EditProduct.position.asc())
    )).all()
    # Full storefront card shape (brand, image, price, buyNow) - the same
    # hydration the product-list/detail pages use - not the minimal
    # {id, slug, title, position} shape the admin product-picker needs.
    out = _serialize_edit(e)
    out["products"] = [await _hydrate_card(db, p) for _, p in eps]
    return out
