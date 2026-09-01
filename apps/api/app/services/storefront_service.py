"""
Public storefront business logic - port of apps/api/src/storefront/products-public.service.ts.

Scope cut for v1: implements list / get-by-slug / related with the most-used filter
combos (category, brand, in_stock, on_sale, is_new, sort). Color/size/material
filters require variant joins that this v1 leaves as TODO - the parity gate will
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
    PlatformSetting,
    Product,
    ProductCategoryLink,
    ProductImage,
    ProductRetailerListing,
    ProductVariant,
)

# Default "new arrivals" window: products stay in New Arrivals for one week
# after they are added, then drop out (and remain reachable via their category).
# Overridable at runtime via the admin `NEW_ARRIVAL_DAYS` platform setting.
NEW_ARRIVAL_DAYS_DEFAULT = 7


async def _new_arrival_days(db: AsyncSession) -> int:
    """Resolve the "new arrivals" window (in days) from the admin platform
    setting, falling back to the one-week default. Guards against non-numeric
    or non-positive stored values so a bad setting never breaks the storefront.
    """
    raw = (await db.execute(
        select(PlatformSetting.valueJson).where(PlatformSetting.key == "NEW_ARRIVAL_DAYS")
    )).scalar_one_or_none()
    try:
        days = int(raw)
    except (TypeError, ValueError):
        return NEW_ARRIVAL_DAYS_DEFAULT
    return days if days > 0 else NEW_ARRIVAL_DAYS_DEFAULT


def _dec(v) -> str | None:
    if v is None:
        return None
    return str(v) if isinstance(v, Decimal) else str(Decimal(str(v)))


def _iso_ms(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


_CATEGORY_FALLBACK_IMAGES: dict[str, str] = {
    "jeans": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80",
    "shirts": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1000&q=80",
    "t-shirts": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80",
    "tracks": "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=1000&q=80",
    "footwear": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80",
    "watches": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
    "trousers": "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1000&q=80",
    "shorts": "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1000&q=80",
    "jackets": "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80",
    "hoodies": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=80",
}
_DEFAULT_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80"


async def _hydrate_cards(db: AsyncSession, products: list[Product]) -> list[dict[str, Any]]:
    """Build storefront card payloads in bulk using batched queries - eliminates N+1 queries."""
    if not products:
        return []

    product_ids = [p.id_ for p in products]
    brand_ids = list({p.brandId for p in products if p.brandId})
    cat_ids = list({p.categoryId for p in products if p.categoryId} | {p.subcategoryId for p in products if p.subcategoryId})

    brands = (await db.execute(
        select(Brand.id_, Brand.name, Brand.slug).where(Brand.id_.in_(brand_ids))
    )).all() if brand_ids else []
    brand_map = {b[0]: b for b in brands}

    categories = (await db.execute(
        select(Category.id_, Category.name, Category.slug).where(Category.id_.in_(cat_ids))
    )).all() if cat_ids else []
    cat_map = {c[0]: c for c in categories}

    images = (await db.execute(
        select(ProductImage).where(ProductImage.productId.in_(product_ids)).order_by(ProductImage.position.asc())
    )).scalars().all()
    image_map: dict[str, list[ProductImage]] = {}
    for img in images:
        image_map.setdefault(img.productId, []).append(img)

    variants = (await db.execute(
        select(ProductVariant).where(ProductVariant.productId.in_(product_ids)).order_by(ProductVariant.createdAt.asc())
    )).scalars().all()
    variant_map: dict[str, list[ProductVariant]] = {}
    for v in variants:
        variant_map.setdefault(v.productId, []).append(v)

    listings = (await db.execute(
        select(ProductRetailerListing).where(
            ProductRetailerListing.productId.in_(product_ids),
            ProductRetailerListing.availabilityStatus == "IN_STOCK",
        )
    )).scalars().all()
    listing_map: dict[str, list[ProductRetailerListing]] = {}
    for l in listings:
        listing_map.setdefault(l.productId, []).append(l)

    listing_ids = [l.id_ for l in listings]
    links = (await db.execute(
        select(AffiliateLink).where(AffiliateLink.productRetailerListingId.in_(listing_ids))
    )).scalars().all() if listing_ids else []
    link_map = {link.productRetailerListingId: link for link in links}

    cards = []
    for p in products:
        b_info = brand_map.get(p.brandId)
        c_info = cat_map.get(p.categoryId)
        sub_info = cat_map.get(p.subcategoryId) if p.subcategoryId else None
        p_images = image_map.get(p.id_, [])
        p_variants = variant_map.get(p.id_, [])
        p_listings = listing_map.get(p.id_, [])

        ai_images = [i for i in p_images if i.isAiGenerated]
        retailer_images = [i for i in p_images if not i.isAiGenerated]
        primary = next((i for i in p_images if i.isPrimary), None) or (p_images[0] if p_images else None)
        if not primary or "placehold.co" in primary.url:
            fallback_url = next((l.retailerImageUrl for l in p_listings if l.retailerImageUrl and "placehold.co" not in l.retailerImageUrl), None)
            if not fallback_url:
                cat_slug = c_info[2] if c_info else ""
                fallback_url = _CATEGORY_FALLBACK_IMAGES.get(cat_slug, _DEFAULT_FALLBACK_IMAGE)
            primary = type("SyntheticImage", (), {
                "url": fallback_url,
                "isAiGenerated": False,
                "altText": p.title,
            })()
        secondary = next((i for i in retailer_images if not i.isPrimary), None) or (retailer_images[0] if retailer_images else None)

        sorted_listings = sorted(
            p_listings,
            key=lambda x: float(x.rawPrice) if x.rawPrice is not None else 0
        )
        best_listing = sorted_listings[0] if sorted_listings else None
        best_affiliate = link_map.get(best_listing.id_) if best_listing else None

        sizes = sorted(list(set(v.size for v in p_variants if v.size)))
        colors = sorted(list(set(v.color for v in p_variants if v.color)))

        gallery_list = [
            {
                "url": i.url,
                "altText": i.altText,
                "isAiGenerated": i.isAiGenerated,
                "isPrimary": i.isPrimary,
                "position": i.position,
            }
            for i in p_images
        ] if p_images else [
            {
                "url": primary.url,
                "altText": p.title,
                "isAiGenerated": False,
                "isPrimary": True,
                "position": 0,
            }
        ]

        cards.append({
            "id": p.id_,
            "slug": p.slug,
            "title": p.title,
            "description": p.description,
            "primaryRetailer": p.primaryRetailer,
            "status": p.status,
            "tags": p.tags or [],
            "featuredUntil": _iso_ms(p.featuredUntil),
            "isFeatured": bool(p.featuredUntil and p.featuredUntil > datetime.now(timezone.utc).replace(tzinfo=None)),
            "createdAt": _iso_ms(p.createdAt),
            "updatedAt": _iso_ms(p.updatedAt),
            "brand": {"id": b_info[0], "name": b_info[1], "slug": b_info[2]} if b_info else None,
            "category": {"id": c_info[0], "name": c_info[1], "slug": c_info[2]} if c_info else None,
            "subcategory": {"id": sub_info[0], "name": sub_info[1], "slug": sub_info[2]} if sub_info else None,
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
            "gallery": gallery_list,
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
                for v in p_variants
            ],
            "sizes": sizes,
            "colors": colors,
            "retailers": [
                {
                    "retailer": l.retailer,
                    "retailerDisplayName": l.retailerDisplayName,
                    "rawPrice": float(l.rawPrice) if l.rawPrice is not None else None,
                    "availabilityStatus": l.availabilityStatus,
                    "affiliateUrl": link_map.get(l.id_).convertedUrl if link_map.get(l.id_) else l.retailerProductUrl,
                    "affiliatePartner": link_map.get(l.id_).partner if link_map.get(l.id_) else None,
                    "pending": link_map.get(l.id_).pendingConversion if link_map.get(l.id_) else True,
                }
                for l in p_listings
            ],
            "buyNow": {
                "retailer": best_listing.retailer,
                "retailerDisplayName": best_listing.retailerDisplayName,
                "url": best_affiliate.convertedUrl if best_affiliate else best_listing.retailerProductUrl,
                "partner": best_affiliate.partner if best_affiliate else None,
                "pending": best_affiliate.pendingConversion if best_affiliate else True,
                "trackingId": best_affiliate.partnerLinkId if best_affiliate else None,
            } if best_listing else None,
        })
    return cards


async def _hydrate_card(db: AsyncSession, p: Product) -> dict[str, Any]:
    cards = await _hydrate_cards(db, [p])
    return cards[0] if cards else {}


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
            conds.append(or_(
                Product.categoryId.in_(cat_ids),
                Product.subcategoryId.in_(cat_ids),
                # Extra visibility surfaces chosen in the admin "Product
                # Visibility" checkboxes (product_category_links).
                exists().where(and_(
                    ProductCategoryLink.productId == Product.id_,
                    ProductCategoryLink.categoryId.in_(cat_ids),
                )),
            ))
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
    if q.get("inStock"):
        conds.append(
            exists().where(
                and_(
                    ProductRetailerListing.productId == Product.id_,
                    ProductRetailerListing.availabilityStatus == "IN_STOCK",
                )
            )
        )
    if q.get("isNew"):
        days = await _new_arrival_days(db)
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
        conds.append(Product.createdAt >= cutoff)

    where = and_(*conds)
    total = (await db.execute(select(func.count(Product.id_)).where(where))).scalar_one()

    # Sort.
    sort = q.get("sort") or "newest"
    if sort == "oldest":
        order = Product.createdAt.asc()
    else:
        order = Product.createdAt.desc()

    rows = (await db.execute(
        select(Product)
        .where(where)
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()
    data = await _hydrate_cards(db, rows)
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
    """Composite payload for the home page - matches NestJS's overview()."""
    from ..core.cache import cache_get, cache_set
    cached = await cache_get("storefront:home")
    if cached is not None:
        return cached

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    new_cutoff = now - timedelta(days=await _new_arrival_days(db))

    featured_brands = (await db.execute(
        select(Brand)
        .where(Brand.status == "ACTIVE", Brand.isFeatured.is_(True))
        .order_by(Brand.name.asc())
        .limit(12)
    )).scalars().all()

    new_arr = await list_products(db, {"page": 1, "pageSize": 12, "isNew": True})

    latest_articles_rows = await _latest_articles(db, limit=3)

    category_sections = await _category_sections(db)

    result = {
        "featuredBrands": [
            {
                "id": b.id_,
                "slug": b.slug,
                "name": b.name,
                "logoUrl": b.logoUrl,
                "heroUrl": b.heroUrl,
            }
            for b in featured_brands
        ],
        "newArrivals": new_arr["data"],
        "newArrivalsCount": new_arr["total"],
        "featuredEdit": None,
        "latestArticles": latest_articles_rows,
        "categorySections": category_sections,
        "_newArrivalCutoff": _iso_ms(new_cutoff),
    }
    await cache_set("storefront:home", result, ttl_seconds=30)
    return result


async def _latest_articles(db: AsyncSession, *, limit: int) -> list[dict[str, Any]]:
    from ..db.models import Article  # noqa: PLC0415 - lazy import to avoid cycle risk
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
