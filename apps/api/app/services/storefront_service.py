"""
Public storefront business logic — port of apps/api/src/storefront/products-public.service.ts.

Scope cut for v1: implements list / get-by-slug / related with the most-used filter
combos (category, brand, in_stock, on_sale, is_new, sort). Color/size/material
filters require variant joins that this v1 leaves as TODO — the parity gate will
flag if the frontend uses them in practice.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.pagination import make_page
from ..db.models import (
    Brand,
    Category,
    Product,
    ProductImage,
    ProductRetailerListing,
    ProductVariant,
)

NEW_ARRIVAL_DAYS = 30


def _dec(v) -> str | None:
    if v is None:
        return None
    return str(v) if isinstance(v, Decimal) else str(Decimal(str(v)))


def _iso_ms(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


async def _hydrate_card(db: AsyncSession, p: Product) -> dict[str, Any]:
    """Build the storefront card payload — includes brand, category, images,
    variants, in-stock retailer listings."""
    brand = (await db.execute(
        select(Brand.id_, Brand.name, Brand.slug).where(Brand.id_ == p.brandId)
    )).first()
    category = (await db.execute(
        select(Category.id_, Category.name, Category.slug).where(Category.id_ == p.categoryId)
    )).first()
    subcategory = None
    if p.subcategoryId:
        subcategory = (await db.execute(
            select(Category.id_, Category.name, Category.slug).where(Category.id_ == p.subcategoryId)
        )).first()

    images = (await db.execute(
        select(ProductImage).where(ProductImage.productId == p.id_).order_by(ProductImage.position.asc())
    )).scalars().all()
    variants = (await db.execute(
        select(ProductVariant).where(ProductVariant.productId == p.id_).order_by(ProductVariant.createdAt.asc())
    )).scalars().all()
    listings = (await db.execute(
        select(ProductRetailerListing)
        .where(
            ProductRetailerListing.productId == p.id_,
            ProductRetailerListing.availabilityStatus == "IN_STOCK",
        )
    )).scalars().all()

    return {
        "id": p.id_,
        "slug": p.slug,
        "title": p.title,
        "description": p.description,
        "price": _dec(p.price),
        "mrp": _dec(p.mrp),
        "discountPct": _dec(p.discountPct),
        "currency": p.currency,
        "primaryRetailer": p.primaryRetailer,
        "status": p.status,
        "tags": p.tags or [],
        "avgRating": _dec(p.avgRating),
        "reviewCount": p.reviewCount,
        "featuredUntil": _iso_ms(p.featuredUntil),
        "createdAt": _iso_ms(p.createdAt),
        "updatedAt": _iso_ms(p.updatedAt),
        "brand": {"id": brand[0], "name": brand[1], "slug": brand[2]} if brand else None,
        "category": {"id": category[0], "name": category[1], "slug": category[2]} if category else None,
        "subcategory": (
            {"id": subcategory[0], "name": subcategory[1], "slug": subcategory[2]} if subcategory else None
        ),
        "images": [
            {
                "id": i.id_,
                "url": i.url,
                "altText": i.altText,
                "isPrimary": i.isPrimary,
                "isAiGenerated": i.isAiGenerated,
                "position": i.position,
            }
            for i in images
        ],
        "variants": [
            {
                "id": v.id_,
                "sku": v.sku,
                "attributes": v.attributes,
                "color": v.color,
                "size": v.size,
                "isDefault": v.isDefault,
            }
            for v in variants
        ],
        "retailerListings": [
            {
                "id": l.id_,
                "retailer": l.retailer,
                "retailerProductUrl": l.retailerProductUrl,
                "retailerImageUrl": l.retailerImageUrl,
                "rawPrice": _dec(l.rawPrice),
                "availabilityStatus": l.availabilityStatus,
            }
            for l in listings
        ],
    }


async def list_products(db: AsyncSession, q: dict[str, Any]) -> dict[str, Any]:
    page = q.get("page") or 1
    page_size = q.get("pageSize") or 24

    conds = [Product.status == "ACTIVE"]
    if q.get("search"):
        s = f"%{q['search'].lower()}%"
        conds.append(or_(func.lower(Product.title).like(s), func.lower(Product.description).like(s)))
    if q.get("category"):
        # Match category OR subcategory slug.
        cat_ids = (await db.execute(
            select(Category.id_).where(Category.slug == q["category"])
        )).scalars().all()
        if cat_ids:
            conds.append(or_(Product.categoryId.in_(cat_ids), Product.subcategoryId.in_(cat_ids)))
        else:
            return make_page([], 0, page, page_size)
    if q.get("brand"):
        brand_ids = (await db.execute(
            select(Brand.id_).where(Brand.slug.in_(q["brand"]))
        )).scalars().all()
        conds.append(Product.brandId.in_(brand_ids))
    if q.get("retailer"):
        conds.append(
            exists().where(
                and_(
                    ProductRetailerListing.productId == Product.id_,
                    ProductRetailerListing.retailer.in_(q["retailer"]),
                    ProductRetailerListing.availabilityStatus == "IN_STOCK",
                )
            )
        )
    if q.get("minPrice") is not None:
        conds.append(Product.price >= q["minPrice"])
    if q.get("maxPrice") is not None:
        conds.append(Product.price <= q["maxPrice"])
    if q.get("inStock"):
        conds.append(
            exists().where(
                and_(
                    ProductRetailerListing.productId == Product.id_,
                    ProductRetailerListing.availabilityStatus == "IN_STOCK",
                )
            )
        )
    if q.get("onSale"):
        conds.append(Product.discountPct > 0)
    if q.get("discount") and q["discount"] > 0:
        conds.append(Product.discountPct >= q["discount"])
    if q.get("isNew"):
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=NEW_ARRIVAL_DAYS)
        conds.append(Product.createdAt >= cutoff)

    where = and_(*conds)
    total = (await db.execute(select(func.count(Product.id_)).where(where))).scalar_one()

    # Sort.
    sort = q.get("sort") or "newest"
    if sort == "price_asc":
        order = Product.price.asc()
    elif sort == "price_desc":
        order = Product.price.desc()
    elif sort == "best_rated":
        order = Product.avgRating.desc().nulls_last()
    elif sort == "popular":
        order = Product.reviewCount.desc()
    else:
        order = Product.createdAt.desc()

    rows = (await db.execute(
        select(Product)
        .where(where)
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()
    data = [await _hydrate_card(db, p) for p in rows]
    return make_page(data, total, page, page_size)


async def get_by_slug(db: AsyncSession, slug: str) -> dict[str, Any] | None:
    p = (await db.execute(
        select(Product).where(Product.slug == slug, Product.status == "ACTIVE")
    )).scalar_one_or_none()
    if p is None:
        return None
    return await _hydrate_card(db, p)


async def related(db: AsyncSession, slug: str) -> list[dict[str, Any]]:
    p = (await db.execute(
        select(Product).where(Product.slug == slug)
    )).scalar_one_or_none()
    if p is None:
        return []
    rows = (await db.execute(
        select(Product)
        .where(
            Product.categoryId == p.categoryId,
            Product.status == "ACTIVE",
            Product.id_ != p.id_,
        )
        .order_by(Product.createdAt.desc())
        .limit(6)
    )).scalars().all()
    return [await _hydrate_card(db, r) for r in rows]


async def home(db: AsyncSession) -> dict[str, Any]:
    """Composite payload for the home page — matches NestJS's overview()."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    new_cutoff = now - timedelta(days=NEW_ARRIVAL_DAYS)

    featured_brands = (await db.execute(
        select(Brand)
        .where(Brand.status == "ACTIVE", Brand.isFeatured.is_(True))
        .order_by(Brand.name.asc())
        .limit(12)
    )).scalars().all()

    new_arr = await list_products(db, {"page": 1, "pageSize": 12, "isNew": True})

    latest_articles_rows = await _latest_articles(db, limit=3)

    category_sections = await _category_sections(db)

    return {
        "banners": [],  # TODO: port banners.listActiveForHome — stub for v1
        "featuredBrands": [
            {
                "id": b.id_, "slug": b.slug, "name": b.name,
                "logoUrl": b.logoUrl, "heroUrl": b.heroUrl,
            }
            for b in featured_brands
        ],
        "newArrivals": new_arr["data"],
        "newArrivalsCount": new_arr["total"],
        "featuredEdit": None,  # TODO: port edits.getFeaturedForHome
        "latestArticles": latest_articles_rows,
        "categorySections": category_sections,
        "_newArrivalCutoff": _iso_ms(new_cutoff),
    }


async def _latest_articles(db: AsyncSession, *, limit: int) -> list[dict[str, Any]]:
    from ..db.models import Article  # noqa: PLC0415 — lazy import to avoid cycle risk
    rows = (await db.execute(
        select(Article)
        .where(Article.status == "PUBLISHED")
        .order_by(Article.publishedAt.desc())
        .limit(limit)
    )).scalars().all()
    return [
        {
            "id": a.id_,
            "slug": a.slug,
            "title": a.title,
            "excerpt": a.excerpt,
            "heroUrl": a.heroUrl,
            "publishedAt": _iso_ms(a.publishedAt),
            "readingMinutes": a.readingMinutes,
        }
        for a in rows
    ]


async def _category_sections(db: AsyncSession) -> list[dict[str, Any]]:
    cats = (await db.execute(
        select(Category)
        .where(Category.parentId.is_(None))
        .order_by(Category.displayOrder.asc())
        .limit(7)
    )).scalars().all()
    out = []
    for cat in cats:
        result = await list_products(db, {"page": 1, "pageSize": 5, "category": cat.slug})
        if not result["data"]:
            continue
        out.append({
            "category": {"id": cat.id_, "slug": cat.slug, "name": cat.name},
            "products": result["data"],
        })
    return out


async def autocomplete(db: AsyncSession, query: str) -> dict[str, Any]:
    """Lightweight search across product titles + brand names. Returns suggestions."""
    if not query:
        return {"query": "", "suggestions": []}
    pattern = f"%{query.lower()}%"
    titles = (await db.execute(
        select(Product.title, Product.slug)
        .where(func.lower(Product.title).like(pattern), Product.status == "ACTIVE")
        .limit(5)
    )).all()
    brands = (await db.execute(
        select(Brand.name, Brand.slug)
        .where(func.lower(Brand.name).like(pattern), Brand.status == "ACTIVE")
        .limit(5)
    )).all()
    return {
        "query": query,
        "suggestions": (
            [{"kind": "product", "label": t[0], "slug": t[1]} for t in titles]
            + [{"kind": "brand", "label": b[0], "slug": b[1]} for b in brands]
        ),
    }
