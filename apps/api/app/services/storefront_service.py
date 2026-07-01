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
    AffiliateLink,
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

    # Load affiliate links for listings
    links = (await db.execute(
        select(AffiliateLink).where(AffiliateLink.productRetailerListingId.in_([l.id_ for l in listings]))
    )).scalars().all() if listings else []
    link_map = {link.productRetailerListingId: link for link in links}

    ai_images = [i for i in images if i.isAiGenerated]
    retailer_images = [i for i in images if not i.isAiGenerated]
    primary = next((i for i in images if i.isPrimary), None) or (images[0] if images else None)
    secondary = next((i for i in retailer_images if not i.isPrimary), None) or (retailer_images[0] if retailer_images else None)

    sorted_listings = sorted(
        listings,
        key=lambda x: float(x.rawPrice) if x.rawPrice is not None else float(p.price)
    )
    best_listing = sorted_listings[0] if sorted_listings else None
    best_affiliate = link_map.get(best_listing.id_) if best_listing else None

    sizes = sorted(list(set(v.size for v in variants if v.size)))
    colors = sorted(list(set(v.color for v in variants if v.color)))

    return {
        "id": p.id_,
        "slug": p.slug,
        "title": p.title,
        "description": p.description,
        "price": float(p.price) if p.price is not None else None,
        "mrp": float(p.mrp) if p.mrp is not None else None,
        "discountPct": float(p.discountPct) if p.discountPct is not None else None,
        "currency": p.currency,
        "primaryRetailer": p.primaryRetailer,
        "status": p.status,
        "tags": p.tags or [],
        "avgRating": float(p.avgRating) if p.avgRating is not None else None,
        "reviewCount": p.reviewCount,
        "featuredUntil": _iso_ms(p.featuredUntil),
        "createdAt": _iso_ms(p.createdAt),
        "updatedAt": _iso_ms(p.updatedAt),
        "brand": {"id": brand[0], "name": brand[1], "slug": brand[2]} if brand else None,
        "category": {"id": category[0], "name": category[1], "slug": category[2]} if category else None,
        "subcategory": (
            {"id": subcategory[0], "name": subcategory[1], "slug": subcategory[2]} if subcategory else None
        ),
        "primaryImage": {
            "url": primary.url,
            "isAiGenerated": primary.isAiGenerated,
            "altText": primary.altText,
        } if primary else None,
        "secondaryImage": {
            "url": secondary.url,
            "isAiGenerated": secondary.isAiGenerated,
            "altText": secondary.altText,
        } if secondary else None,
        "gallery": [
            {
                "url": i.url,
                "altText": i.altText,
                "isAiGenerated": i.isAiGenerated,
                "isPrimary": i.isPrimary,
                "position": i.position,
            }
            for i in images
        ],
        "aiImageCount": len(ai_images),
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
        "sizes": sizes,
        "colors": colors,
        "retailers": [
            {
                "retailer": l.retailer,
                "rawPrice": float(l.rawPrice) if l.rawPrice is not None else None,
                "availabilityStatus": l.availabilityStatus,
                "affiliateUrl": link_map.get(l.id_).convertedUrl if link_map.get(l.id_) else l.retailerProductUrl,
                "affiliatePartner": link_map.get(l.id_).partner if link_map.get(l.id_) else None,
                "pending": link_map.get(l.id_).pendingConversion if link_map.get(l.id_) else True,
            }
            for l in listings
        ],
        "buyNow": {
            "retailer": best_listing.retailer,
            "url": best_affiliate.convertedUrl if best_affiliate else best_listing.retailerProductUrl,
            "partner": best_affiliate.partner if best_affiliate else None,
            "pending": best_affiliate.pendingConversion if best_affiliate else True,
            "trackingId": best_affiliate.partnerLinkId if best_affiliate else None,
        } if best_listing else None,
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
    term = query.strip() if query else ""
    if not term:
        return {"products": [], "brands": [], "categories": []}

    pattern = f"%{term.lower()}%"

    # Query products (include brand name)
    products_rows = (await db.execute(
        select(Product.slug, Product.title, Brand.name)
        .join(Brand, Brand.id_ == Product.brandId)
        .where(Product.status == "ACTIVE", func.lower(Product.title).like(pattern))
        .limit(5)
    )).all()

    # Query brands
    brands_rows = (await db.execute(
        select(Brand.slug, Brand.name)
        .where(Brand.status == "ACTIVE", func.lower(Brand.name).like(pattern))
        .limit(5)
    )).all()

    # Query categories
    categories_rows = (await db.execute(
        select(Category.slug, Category.name, Category.path)
        .where(or_(func.lower(Category.name).like(pattern), func.lower(Category.slug).like(pattern)))
        .order_by(Category.displayOrder.asc())
        .limit(5)
    )).all()

    return {
        "products": [{"slug": r[0], "title": r[1], "brand": r[2]} for r in products_rows],
        "brands": [{"slug": r[0], "name": r[1]} for r in brands_rows],
        "categories": [{"slug": r[0], "name": r[1], "path": r[2]} for r in categories_rows],
    }
