"""
Products admin CRUD — port of apps/api/src/products/products.controller.ts.

This batch ships the core CRUD + sub-resource endpoints (images, variants,
retailer-listings). The Quick Add atomic transaction is intentionally stubbed
because it depends on the scrape + affiliate-convert integrations which are
themselves mock-only in this turn — adding it without those would lie about
what works.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone
from decimal import Decimal
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
    Brand,
    Category,
    Product,
    ProductImage,
    ProductRetailerListing,
    ProductVariant,
)
from ...db.session import get_db
from ...services import audit_service

router = APIRouter(prefix="/admin/products", tags=["admin-products"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDeps = [
    Depends(current_user_required),
    Depends(require_roles("ADMIN")),
    Depends(enforce_two_factor),
]

_ALPH = string.ascii_lowercase + string.digits

ProductStatusLit = Literal["DRAFT", "ACTIVE", "ARCHIVED"]
AvailabilityLit = Literal["IN_STOCK", "OUT_OF_STOCK_AT_RETAILER", "DELISTED"]


def _cuid() -> str:
    return "c" + "".join(secrets.choice(_ALPH) for _ in range(24))


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _dec(v) -> str | None:
    return None if v is None else str(v) if isinstance(v, Decimal) else str(Decimal(str(v)))


class VariantInput(ApiModel):
    sku: str | None = Field(default=None, max_length=80)
    attributes: dict[str, Any] | None = None
    color: str | None = Field(default=None, max_length=40)
    size: str | None = Field(default=None, max_length=40)
    isDefault: bool | None = None


class ImageInput(ApiModel):
    url: str
    altText: str | None = Field(default=None, max_length=255)
    isPrimary: bool | None = None
    isAiGenerated: bool | None = None
    position: int | None = None


class RetailerListingInput(ApiModel):
    retailer: str = Field(min_length=1, max_length=40)
    retailerProductUrl: str
    retailerImageUrl: str | None = None
    rawPrice: float
    availabilityStatus: AvailabilityLit | None = None


class ProductBase(ApiModel):
    title: str = Field(min_length=1, max_length=200)
    brandId: str
    categoryId: str
    subcategoryId: str | None = None
    slug: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20_000)
    price: float
    mrp: float | None = None
    primaryRetailer: str | None = None
    status: ProductStatusLit | None = None
    metaTitle: str | None = None
    metaDescription: str | None = None
    featureDays: int | None = Field(default=None, ge=0, le=365)
    tags: list[str] | None = Field(default=None, max_length=20)
    variants: list[VariantInput] | None = Field(default=None, max_length=20)
    images: list[ImageInput] | None = Field(default=None, max_length=20)
    retailerListings: list[RetailerListingInput] | None = Field(default=None, max_length=20)


class CreateProductRequest(ProductBase):
    pass


class UpdateProductRequest(ApiModel):
    title: str | None = None
    brandId: str | None = None
    categoryId: str | None = None
    subcategoryId: str | None = None
    slug: str | None = None
    description: str | None = None
    price: float | None = None
    mrp: float | None = None
    primaryRetailer: str | None = None
    status: ProductStatusLit | None = None
    metaTitle: str | None = None
    metaDescription: str | None = None
    featureDays: int | None = None
    tags: list[str] | None = None


def _serialize_product(p: Product) -> dict[str, Any]:
    return {
        "id": p.id_,
        "slug": p.slug,
        "title": p.title,
        "brandId": p.brandId,
        "categoryId": p.categoryId,
        "subcategoryId": p.subcategoryId,
        "description": p.description,
        "price": _dec(p.price),
        "mrp": _dec(p.mrp),
        "discountPct": _dec(p.discountPct),
        "currency": p.currency,
        "primaryRetailer": p.primaryRetailer,
        "status": p.status,
        "metaTitle": p.metaTitle,
        "metaDescription": p.metaDescription,
        "tags": p.tags or [],
        "featuredUntil": _iso(p.featuredUntil),
        "createdAt": _iso(p.createdAt),
        "updatedAt": _iso(p.updatedAt),
    }


async def _serialize_admin_products(db: AsyncSession, products: list[Product]) -> list[dict[str, Any]]:
    if not products:
        return []

    product_ids = [p.id_ for p in products]

    # Batch query brands
    brand_ids = list({p.brandId for p in products if p.brandId})
    brands = (await db.execute(
        select(Brand.id_, Brand.name, Brand.slug).where(Brand.id_.in_(brand_ids))
    )).all() if brand_ids else []
    brand_map = {b[0]: {"id": b[0], "name": b[1], "slug": b[2]} for b in brands}

    # Batch query categories
    cat_ids = list({p.categoryId for p in products if p.categoryId} | {p.subcategoryId for p in products if p.subcategoryId})
    categories = (await db.execute(
        select(Category.id_, Category.name, Category.slug).where(Category.id_.in_(cat_ids))
    )).all() if cat_ids else []
    cat_map = {c[0]: {"id": c[0], "name": c[1], "slug": c[2]} for c in categories}

    # Batch query images
    images = (await db.execute(
        select(ProductImage).where(ProductImage.productId.in_(product_ids)).order_by(ProductImage.position.asc())
    )).scalars().all() if product_ids else []

    images_by_prod = {}
    for img in images:
        if img.productId not in images_by_prod:
            images_by_prod[img.productId] = []
        images_by_prod[img.productId].append({
            "id": img.id_,
            "url": img.url,
            "altText": img.altText,
            "isPrimary": img.isPrimary,
            "isAiGenerated": img.isAiGenerated,
            "position": img.position,
        })

    # Batch query variants count
    variants_counts = (await db.execute(
        select(ProductVariant.productId, func.count(ProductVariant.id_))
        .where(ProductVariant.productId.in_(product_ids))
        .group_by(ProductVariant.productId)
    )).all() if product_ids else []
    variants_count_map = {v[0]: v[1] for v in variants_counts}

    # Batch query listings count
    listings_counts = (await db.execute(
        select(ProductRetailerListing.productId, func.count(ProductRetailerListing.id_))
        .where(ProductRetailerListing.productId.in_(product_ids))
        .group_by(ProductRetailerListing.productId)
    )).all() if product_ids else []
    listings_count_map = {l[0]: l[1] for l in listings_counts}

    out = []
    for p in products:
        p_imgs = images_by_prod.get(p.id_) or []
        out.append({
            "id": p.id_,
            "slug": p.slug,
            "title": p.title,
            "brandId": p.brandId,
            "categoryId": p.categoryId,
            "subcategoryId": p.subcategoryId,
            "description": p.description,
            "price": _dec(p.price),
            "mrp": _dec(p.mrp),
            "discountPct": _dec(p.discountPct),
            "currency": p.currency,
            "primaryRetailer": p.primaryRetailer,
            "status": p.status,
            "metaTitle": p.metaTitle,
            "metaDescription": p.metaDescription,
            "tags": p.tags or [],
            "featuredUntil": _iso(p.featuredUntil),
            "createdAt": _iso(p.createdAt),
            "updatedAt": _iso(p.updatedAt),
            "brand": brand_map.get(p.brandId) if p.brandId else None,
            "category": cat_map.get(p.categoryId) if p.categoryId else None,
            "subcategory": cat_map.get(p.subcategoryId) if p.subcategoryId else None,
            "images": p_imgs,
            "_count": {
                "variants": variants_count_map.get(p.id_) or 0,
                "retailerListings": listings_count_map.get(p.id_) or 0,
            }
        })
    return out


async def _unique_product_slug(db: AsyncSession, base: str, exclude_id: str | None = None) -> str:
    async def taken(cand: str) -> bool:
        row = (await db.execute(select(Product.id_).where(Product.slug == cand))).scalar_one_or_none()
        return row is not None and row != exclude_id
    return await ensure_unique_slug(base, taken)


def _calc_discount(price: float | None, mrp: float | None) -> float | None:
    if price is None or mrp is None or mrp <= 0 or price >= mrp:
        return None
    return round((mrp - price) / mrp * 100, 2)


# ───────────── Scrape / Quick Add live BEFORE list so :id routes don't match ─


class ScrapeUrlRequest(ApiModel):
    url: str = Field(min_length=1, max_length=2048)


@router.post("/scrape-url", dependencies=AdminDeps)
async def scrape_url(payload: ScrapeUrlRequest) -> dict[str, Any]:
    """Fetch + parse a retailer product page. Mock when USE_MOCK_INTEGRATIONS=true."""
    from ...integrations.scraper import scrape_product_url as _scrape, detect_retailer
    try:
        result = await _scrape(payload.url)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"Scrape failed: {e}") from None
    return {
        "title": result.title,
        "price": result.price,
        "mrp": result.mrp,
        "primaryImageUrl": result.primaryImageUrl,
        "images": result.images or [],
        "color": result.color,
        "sizes": result.sizes or [],
        "material": result.material,
        "retailer": result.retailer or detect_retailer(payload.url),
    }


class QuickAddRequest(ApiModel):
    title: str = Field(min_length=1, max_length=200)
    rawUrl: str = Field(min_length=1, max_length=2048)
    retailer: str = Field(min_length=1, max_length=40)
    categoryId: str
    subcategoryId: str | None = None
    price: float
    brandId: str | None = None
    newBrandName: str | None = Field(default=None, max_length=120)
    color: str | None = None
    sizes: list[str] | None = Field(default=None, max_length=20)
    material: str | None = None
    description: str | None = None
    mrp: float | None = None
    tags: list[str] | None = Field(default=None, max_length=20)
    avatarImageUrl: str | None = None
    retailerImageUrl: str | None = None
    status: ProductStatusLit | None = None


@router.post("/quick-add", status_code=201, dependencies=AdminDeps)
async def quick_add(
    payload: QuickAddRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    """Atomic: brand upsert → product → variants from sizes → primary image →
    retailer listing → affiliate URL conversion (Amazon direct / Cuelinks)."""
    from ...db.models import AffiliateLink, Brand
    from ...integrations.amazon import tag_url
    from ...integrations.cuelinks import convert_url as cuelinks_convert
    from ...core.slug import ensure_unique_slug

    if not payload.brandId and not payload.newBrandName:
        raise HTTPException(400, "brandId or newBrandName required")

    now = _now()
    # 1. Brand upsert.
    if payload.brandId:
        brand_id = payload.brandId
    else:
        name = payload.newBrandName or ""
        slug_base = slugify(name)

        async def brand_slug_taken(cand: str) -> bool:
            return (await db.execute(
                select(Brand.id_).where(Brand.slug == cand)
            )).scalar_one_or_none() is not None

        slug = await ensure_unique_slug(slug_base, brand_slug_taken)
        brand_id = _cuid()
        db.add(Brand(
            id_=brand_id, slug=slug, name=name, status="ACTIVE",
            isFeatured=False, createdAt=now, updatedAt=now,
        ))
        await db.flush()

    # 2. Product.
    p_slug = await _unique_product_slug(db, slugify(payload.title))
    discount = _calc_discount(payload.price, payload.mrp)
    pid = _cuid()
    db.add(Product(
        id_=pid,
        brandId=brand_id,
        categoryId=payload.categoryId,
        subcategoryId=payload.subcategoryId,
        slug=p_slug,
        title=payload.title,
        description=payload.description,
        price=Decimal(str(payload.price)),
        mrp=Decimal(str(payload.mrp)) if payload.mrp is not None else None,
        discountPct=Decimal(str(discount)) if discount is not None else None,
        currency="INR",
        primaryRetailer=payload.retailer,
        status=payload.status or "ACTIVE",
        createdByAdminId=user.id,
        tags=payload.tags or [],
        reviewCount=0,
        createdAt=now,
        updatedAt=now,
    ))
    await db.flush()

    # 3. Variants (one per size).
    for s in payload.sizes or []:
        db.add(ProductVariant(
            id_=_cuid(), productId=pid, color=payload.color, size=s,
            isDefault=False, createdAt=now, updatedAt=now,
        ))

    # 4. Primary image.
    if payload.avatarImageUrl:
        db.add(ProductImage(
            id_=_cuid(), productId=pid, url=payload.avatarImageUrl,
            isPrimary=True, isAiGenerated=True, position=0,
            createdAt=now, updatedAt=now,
        ))

    # 5. Retailer listing.
    listing_id = _cuid()
    db.add(ProductRetailerListing(
        id_=listing_id, productId=pid, retailer=payload.retailer,
        retailerProductUrl=payload.rawUrl, retailerImageUrl=payload.retailerImageUrl,
        rawPrice=Decimal(str(payload.price)),
        availabilityStatus="IN_STOCK",
        syncFailedCount=0,
        createdAt=now, updatedAt=now,
    ))
    await db.flush()

    # 6. Affiliate URL conversion.
    if payload.retailer.lower() == "amazon" or "amazon" in payload.rawUrl.lower():
        converted_url = tag_url(payload.rawUrl)
        partner = "AMAZON"
        pending = False
        partner_link_id = None
    else:
        result = await cuelinks_convert(payload.rawUrl)
        converted_url = result.convertedUrl
        partner = "CUELINKS"
        pending = result.pending
        partner_link_id = result.partnerLinkId

    db.add(AffiliateLink(
        id_=_cuid(),
        productRetailerListingId=listing_id,
        partner=partner,
        rawUrl=payload.rawUrl,
        convertedUrl=converted_url,
        partnerLinkId=partner_link_id,
        pendingConversion=pending,
        lastValidatedAt=now if not pending else None,
        createdAt=now, updatedAt=now,
    ))

    await db.commit()
    await audit_service.record(
        actorId=user.id, action="product.quick_add",
        targetType="product", targetId=pid,
        metadata={"retailer": payload.retailer, "brandId": brand_id},
    )
    fresh = (await db.execute(select(Product).where(Product.id_ == pid))).scalar_one()
    return {
        "product": {
            "id": fresh.id_,
            "slug": fresh.slug,
            "title": fresh.title,
        },
        "affiliate": {
            "pendingConversion": pending,
            "partner": partner,
        }
    }


@router.get("", dependencies=AdminDeps)
async def admin_list(
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query()] = None,
    brandId: Annotated[str | None, Query()] = None,
    categoryId: Annotated[str | None, Query()] = None,
    status_: Annotated[ProductStatusLit | None, Query(alias="status")] = None,
) -> dict[str, Any]:
    conds = []
    if search:
        s = f"%{search.lower()}%"
        conds.append(or_(func.lower(Product.title).like(s), func.lower(Product.slug).like(s)))
    if brandId:
        conds.append(Product.brandId == brandId)
    if categoryId:
        conds.append(Product.categoryId == categoryId)
    if status_:
        conds.append(Product.status == status_)
    where = and_(*conds) if conds else True  # noqa: E712
    total = (await db.execute(select(func.count(Product.id_)).where(where))).scalar_one()
    rows = (await db.execute(
        select(Product).where(where).order_by(desc(Product.createdAt))
        .offset((page - 1) * pageSize).limit(pageSize)
    )).scalars().all()
    serialized_rows = await _serialize_admin_products(db, rows)
    return make_page(serialized_rows, total, page, pageSize)


@router.get("/{product_id}", dependencies=AdminDeps)
async def admin_get(product_id: str, db: DbDep) -> dict[str, Any]:
    p = (await db.execute(select(Product).where(Product.id_ == product_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Product not found")
    out_list = await _serialize_admin_products(db, [p])
    out = out_list[0]
    out["variants"] = [
        {"id": v.id_, "sku": v.sku, "attributes": v.attributes, "color": v.color,
         "size": v.size, "isDefault": v.isDefault}
        for v in (await db.execute(
            select(ProductVariant).where(ProductVariant.productId == product_id).order_by(ProductVariant.createdAt.asc())
        )).scalars().all()
    ]
    out["retailerListings"] = [
        {"id": l.id_, "retailer": l.retailer, "retailerProductUrl": l.retailerProductUrl,
         "retailerImageUrl": l.retailerImageUrl, "rawPrice": _dec(l.rawPrice),
         "availabilityStatus": l.availabilityStatus, "lastSyncedAt": _iso(l.lastSyncedAt)}
        for l in (await db.execute(
            select(ProductRetailerListing).where(ProductRetailerListing.productId == product_id)
        )).scalars().all()
    ]
    return out


@router.post("", status_code=201, dependencies=AdminDeps)
async def admin_create(
    payload: CreateProductRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    slug = await _unique_product_slug(db, slugify(payload.slug or payload.title))
    now = _now()
    pid = _cuid()
    featured_until = (
        now + timedelta(days=payload.featureDays) if payload.featureDays and payload.featureDays > 0 else None
    )
    db.add(Product(
        id_=pid,
        brandId=payload.brandId,
        categoryId=payload.categoryId,
        subcategoryId=payload.subcategoryId,
        slug=slug,
        title=payload.title,
        description=payload.description,
        price=Decimal(str(payload.price)),
        mrp=Decimal(str(payload.mrp)) if payload.mrp is not None else None,
        discountPct=Decimal(str(d)) if (d := _calc_discount(payload.price, payload.mrp)) is not None else None,
        currency="INR",
        primaryRetailer=payload.primaryRetailer,
        status=payload.status or "DRAFT",
        createdByAdminId=user.id,
        metaTitle=payload.metaTitle,
        metaDescription=payload.metaDescription,
        tags=payload.tags or [],
        avgRating=None,
        reviewCount=0,
        featuredUntil=featured_until,
        createdAt=now,
        updatedAt=now,
    ))
    await db.flush()
    for idx, img in enumerate(payload.images or []):
        db.add(ProductImage(
            id_=_cuid(), productId=pid, url=img.url,
            altText=img.altText, isPrimary=bool(img.isPrimary),
            isAiGenerated=bool(img.isAiGenerated),
            position=img.position if img.position is not None else idx,
            createdAt=now, updatedAt=now,
        ))
    for v in payload.variants or []:
        db.add(ProductVariant(
            id_=_cuid(), productId=pid, sku=v.sku, attributes=v.attributes,
            color=v.color, size=v.size, isDefault=bool(v.isDefault),
            createdAt=now, updatedAt=now,
        ))
    for l in payload.retailerListings or []:
        db.add(ProductRetailerListing(
            id_=_cuid(), productId=pid, retailer=l.retailer,
            retailerProductUrl=l.retailerProductUrl, retailerImageUrl=l.retailerImageUrl,
            rawPrice=Decimal(str(l.rawPrice)),
            availabilityStatus=l.availabilityStatus or "IN_STOCK",
            syncFailedCount=0,
            createdAt=now, updatedAt=now,
        ))
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.create", targetType="product", targetId=pid)
    fresh = (await db.execute(select(Product).where(Product.id_ == pid))).scalar_one()
    return _serialize_product(fresh)


@router.patch("/{product_id}", dependencies=AdminDeps)
async def admin_update(
    product_id: str,
    payload: UpdateProductRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    existing = (await db.execute(select(Product).where(Product.id_ == product_id))).scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Product not found")
    values: dict[str, Any] = {"updatedAt": _now()}
    if payload.slug and payload.slug != existing.slug:
        values["slug"] = await _unique_product_slug(db, slugify(payload.slug), exclude_id=product_id)
    for k in ("title", "brandId", "categoryId", "subcategoryId", "description",
              "primaryRetailer", "status", "metaTitle", "metaDescription", "tags"):
        v = getattr(payload, k)
        if v is not None:
            values[k] = v
    if payload.price is not None:
        values["price"] = Decimal(str(payload.price))
    if payload.mrp is not None:
        values["mrp"] = Decimal(str(payload.mrp))
    # Recompute discount if price/mrp moved.
    new_price = payload.price if payload.price is not None else float(existing.price)
    new_mrp = payload.mrp if payload.mrp is not None else (float(existing.mrp) if existing.mrp else None)
    d = _calc_discount(new_price, new_mrp)
    values["discountPct"] = Decimal(str(d)) if d is not None else None
    if payload.featureDays is not None:
        values["featuredUntil"] = (
            _now() + timedelta(days=payload.featureDays) if payload.featureDays > 0 else None
        )
    await db.execute(update(Product).where(Product.id_ == product_id).values(**values))
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.update", targetType="product", targetId=product_id)
    fresh = (await db.execute(select(Product).where(Product.id_ == product_id))).scalar_one()
    return _serialize_product(fresh)


@router.delete("/{product_id}", status_code=204, response_class=Response, dependencies=AdminDeps)
async def admin_delete(
    product_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    # Match Nest: archive instead of hard-delete (preserves click history).
    result = await db.execute(
        update(Product).where(Product.id_ == product_id)
        .values(status="ARCHIVED", archivedAt=_now(), updatedAt=_now())
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "Product not found")
    await audit_service.record(actorId=user.id, action="product.archive", targetType="product", targetId=product_id)
    return Response(status_code=204)


# ───────────── sub-resources ────────────────────────────────────────────────


@router.post("/{product_id}/images", dependencies=AdminDeps)
async def admin_add_image(
    product_id: str,
    payload: ImageInput,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    if not (await db.execute(select(Product.id_).where(Product.id_ == product_id))).scalar_one_or_none():
        raise HTTPException(404, "Product not found")
    now = _now()
    img_id = _cuid()
    db.add(ProductImage(
        id_=img_id, productId=product_id, url=payload.url, altText=payload.altText,
        isPrimary=bool(payload.isPrimary), isAiGenerated=bool(payload.isAiGenerated),
        position=payload.position or 0, createdAt=now, updatedAt=now,
    ))
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.image.add", targetType="product", targetId=product_id)
    return {"id": img_id, "url": payload.url}


class ReorderImagesRequest(ApiModel):
    ids: list[str] = Field(min_length=1, max_length=20)


@router.patch("/{product_id}/images/reorder", dependencies=AdminDeps)
async def admin_reorder_images(
    product_id: str,
    payload: ReorderImagesRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, list[str]]:
    now = _now()
    for idx, img_id in enumerate(payload.ids):
        await db.execute(
            update(ProductImage)
            .where(ProductImage.id_ == img_id, ProductImage.productId == product_id)
            .values(position=idx, updatedAt=now)
        )
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.image.reorder", targetType="product", targetId=product_id)
    return {"order": payload.ids}


@router.delete(
    "/{product_id}/images/{image_id}", status_code=204, response_class=Response, dependencies=AdminDeps
)
async def admin_delete_image(
    product_id: str, image_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    await db.execute(
        delete(ProductImage).where(ProductImage.id_ == image_id, ProductImage.productId == product_id)
    )
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.image.delete", targetType="product", targetId=product_id)
    return Response(status_code=204)


@router.post("/{product_id}/variants", dependencies=AdminDeps)
async def admin_add_variant(
    product_id: str,
    payload: VariantInput,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    now = _now()
    vid = _cuid()
    db.add(ProductVariant(
        id_=vid, productId=product_id, sku=payload.sku,
        attributes=payload.attributes, color=payload.color, size=payload.size,
        isDefault=bool(payload.isDefault), createdAt=now, updatedAt=now,
    ))
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.variant.add", targetType="product", targetId=product_id)
    return {"id": vid}


@router.delete(
    "/{product_id}/variants/{variant_id}", status_code=204, response_class=Response, dependencies=AdminDeps
)
async def admin_delete_variant(
    product_id: str, variant_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    await db.execute(
        delete(ProductVariant).where(ProductVariant.id_ == variant_id, ProductVariant.productId == product_id)
    )
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.variant.delete", targetType="product", targetId=product_id)
    return Response(status_code=204)


@router.post("/{product_id}/retailer-listings", dependencies=AdminDeps)
async def admin_add_listing(
    product_id: str,
    payload: RetailerListingInput,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    now = _now()
    lid = _cuid()
    db.add(ProductRetailerListing(
        id_=lid, productId=product_id, retailer=payload.retailer,
        retailerProductUrl=payload.retailerProductUrl, retailerImageUrl=payload.retailerImageUrl,
        rawPrice=Decimal(str(payload.rawPrice)),
        availabilityStatus=payload.availabilityStatus or "IN_STOCK",
        syncFailedCount=0,
        createdAt=now, updatedAt=now,
    ))
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.listing.add", targetType="product", targetId=product_id)
    return {"id": lid}


@router.delete(
    "/{product_id}/retailer-listings/{listing_id}", status_code=204, response_class=Response, dependencies=AdminDeps
)
async def admin_delete_listing(
    product_id: str, listing_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    await db.execute(
        delete(ProductRetailerListing).where(
            ProductRetailerListing.id_ == listing_id,
            ProductRetailerListing.productId == product_id,
        )
    )
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.listing.delete", targetType="product", targetId=product_id)
    return Response(status_code=204)
