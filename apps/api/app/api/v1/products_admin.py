"""
Products admin CRUD - port of apps/api/src/products/products.controller.ts.

This batch ships the core CRUD + sub-resource endpoints (images, variants,
retailer-listings). The Quick Add atomic transaction is intentionally stubbed
because it depends on the scrape + affiliate-convert integrations which are
themselves mock-only in this turn - adding it without those would lie about
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
    Edit,
    EditProduct,
    Product,
    ProductCategoryLink,
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
ManualAffiliatePartnerLit = Literal["EARNKARO", "MEESHO", "DIRECT"]


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
    retailerDisplayName: str | None = Field(default=None, max_length=60)
    retailerProductUrl: str
    retailerImageUrl: str | None = None
    rawPrice: float | None = Field(default=None)
    availabilityStatus: AvailabilityLit | None = None


class ProductBase(ApiModel):
    title: str = Field(min_length=1, max_length=200)
    brandId: str
    categoryId: str
    subcategoryId: str | None = None
    slug: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20_000)
    primaryRetailer: str | None = None
    status: ProductStatusLit | None = None
    metaTitle: str | None = None
    metaDescription: str | None = None
    featureDays: int | None = Field(default=None, ge=0, le=365)
    tags: list[str] | None = Field(default=None, max_length=20)
    variants: list[VariantInput] | None = Field(default=None, max_length=20)
    images: list[ImageInput] | None = Field(default=None, max_length=20)
    retailerListings: list[RetailerListingInput] | None = Field(default=None, max_length=20)
    editIds: list[str] | None = Field(default=None, max_length=20)
    # Extra category/collection landing pages this product should also appear
    # on (the admin "Product Visibility" checkboxes). Slugs, e.g. ["trendy-wear"].
    visibilityCategorySlugs: list[str] | None = Field(default=None, max_length=40)


class CreateProductRequest(ProductBase):
    pass


class UpdateProductRequest(ApiModel):
    title: str | None = None
    brandId: str | None = None
    categoryId: str | None = None
    subcategoryId: str | None = None
    slug: str | None = None
    description: str | None = None
    primaryRetailer: str | None = None
    status: ProductStatusLit | None = None
    metaTitle: str | None = None
    metaDescription: str | None = None
    featureDays: int | None = None
    tags: list[str] | None = None
    editIds: list[str] | None = Field(default=None, max_length=20)
    visibilityCategorySlugs: list[str] | None = Field(default=None, max_length=40)


def _serialize_product(p: Product) -> dict[str, Any]:
    return {
        "id": p.id_,
        "slug": p.slug,
        "title": p.title,
        "brandId": p.brandId,
        "categoryId": p.categoryId,
        "subcategoryId": p.subcategoryId,
        "description": p.description,
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

    # Batch query edits (collections) a product belongs to
    edit_rows = (await db.execute(
        select(EditProduct.productId, Edit.id_, Edit.slug, Edit.title)
        .join(Edit, Edit.id_ == EditProduct.editId)
        .where(EditProduct.productId.in_(product_ids))
    )).all() if product_ids else []
    edits_by_prod: dict[str, list[dict[str, Any]]] = {}
    for pid_, eid, eslug, etitle in edit_rows:
        edits_by_prod.setdefault(pid_, []).append({"id": eid, "slug": eslug, "title": etitle})

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
            "edits": edits_by_prod.get(p.id_) or [],
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
    retailerDisplayName: str | None = Field(default=None, max_length=60)
    categoryId: str
    subcategoryId: str | None = None
    brandId: str | None = None
    newBrandName: str | None = Field(default=None, max_length=120)
    color: str | None = None
    sizes: list[str] | None = Field(default=None, max_length=20)
    material: str | None = None
    description: str | None = None
    tags: list[str] | None = Field(default=None, max_length=20)
    avatarImageUrl: str | None = None
    retailerImageUrl: str | None = None
    imageUrls: list[str] | None = Field(default=None)
    status: ProductStatusLit | None = None
    affiliatePartner: ManualAffiliatePartnerLit | None = None


@router.post("/quick-add", status_code=201, dependencies=AdminDeps)
async def quick_add(
    payload: QuickAddRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    """Atomic: brand upsert → product → variants from sizes → primary image →
    retailer listing → affiliate link (Amazon auto-tagged / everything else
    stored exactly as pasted - the admin brings an already-affiliate-wrapped
    URL from EarnKaro, Meesho, etc.)."""
    from ...db.models import AffiliateLink, Brand
    from ...integrations.amazon import tag_url
    from ...core.slug import ensure_unique_slug

    brand_id = payload.brandId.strip() if payload.brandId and payload.brandId.strip() else None
    cat_id = payload.categoryId.strip() if payload.categoryId and payload.categoryId.strip() else None
    subcat_id = payload.subcategoryId.strip() if payload.subcategoryId and payload.subcategoryId.strip() else None

    if not brand_id and not (payload.newBrandName and payload.newBrandName.strip()):
        raise HTTPException(400, "brandId or newBrandName required")

    if not cat_id:
        raise HTTPException(400, "categoryId is required")

    now = _now()
    try:
        # 1. Brand upsert.
        if not brand_id:
            name = payload.newBrandName.strip() if payload.newBrandName else ""
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
        from ...db.enums import AffiliatePartner, AvailabilityStatus, ProductStatus
        p_slug = await _unique_product_slug(db, slugify(payload.title))
        pid = _cuid()

        try:
            status_enum = ProductStatus((payload.status or "ACTIVE").upper())
        except Exception:
            status_enum = ProductStatus.ACTIVE

        db.add(Product(
            id_=pid,
            brandId=brand_id,
            categoryId=cat_id,
            subcategoryId=subcat_id,
            slug=p_slug,
            title=payload.title,
            description=payload.description,
            primaryRetailer=payload.retailer,
            status=status_enum,
            createdByAdminId=user.id,
            tags=payload.tags or [],
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

        # 4. Images (supports multiple gallery images).
        all_image_urls: list[str] = []
        if payload.imageUrls:
            for u in payload.imageUrls:
                if u and u not in all_image_urls:
                    all_image_urls.append(u)
        if payload.avatarImageUrl and payload.avatarImageUrl not in all_image_urls:
            all_image_urls.insert(0, payload.avatarImageUrl)
        if not all_image_urls and payload.retailerImageUrl:
            all_image_urls.append(payload.retailerImageUrl)

        for idx, img_url in enumerate(all_image_urls):
            db.add(ProductImage(
                id_=_cuid(), productId=pid, url=img_url,
                isPrimary=(idx == 0), isAiGenerated=False, position=idx,
                createdAt=now,
            ))

        # 5. Retailer listing.
        listing_id = _cuid()
        db.add(ProductRetailerListing(
            id_=listing_id, productId=pid, retailer=payload.retailer,
            retailerDisplayName=payload.retailerDisplayName,
            retailerProductUrl=payload.rawUrl, retailerImageUrl=payload.retailerImageUrl,
            availabilityStatus=AvailabilityStatus.IN_STOCK,
            syncFailedCount=0,
            createdAt=now, updatedAt=now,
        ))
        await db.flush()

        # 6. Affiliate link. Amazon gets your Associates tag appended
        # automatically; every other retailer is stored exactly as pasted - the
        # admin already has the affiliate-wrapped URL from EarnKaro/Meesho/etc.
        if payload.retailer.lower() == "amazon" or "amazon" in payload.rawUrl.lower():
            converted_url = tag_url(payload.rawUrl)
            partner_name = "AMAZON"
        else:
            converted_url = payload.rawUrl
            partner_name = payload.affiliatePartner or "DIRECT"
        
        try:
            partner_enum = AffiliatePartner(partner_name.upper())
        except Exception:
            partner_enum = AffiliatePartner.DIRECT

        pending = False
        partner_link_id = None

        db.add(AffiliateLink(
            id_=_cuid(),
            productRetailerListingId=listing_id,
            partner=partner_enum,
            rawUrl=payload.rawUrl,
            convertedUrl=converted_url,
            partnerLinkId=partner_link_id,
            pendingConversion=pending,
            lastValidatedAt=now if not pending else None,
            createdAt=now, updatedAt=now,
        ))

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(400, f"Product creation failed: {str(e)}") from None

    try:
        await audit_service.record(
            actorId=user.id, action="product.quick_add",
            targetType="product", targetId=pid,
            metadata={"retailer": payload.retailer, "brandId": brand_id},
        )
    except Exception:
        pass

    fresh = (await db.execute(select(Product).where(Product.id_ == pid))).scalar_one()
    return {
        "product": {
            "id": fresh.id_,
            "slug": fresh.slug,
            "title": fresh.title,
        },
        "affiliate": {
            "pendingConversion": pending,
            "partner": partner_name,
        }
    }


@router.get("", dependencies=AdminDeps)
async def admin_list(
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=1000)] = 20,
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
        {"id": l.id_, "retailer": l.retailer, "retailerDisplayName": l.retailerDisplayName,
         "retailerProductUrl": l.retailerProductUrl,
         "retailerImageUrl": l.retailerImageUrl, "rawPrice": _dec(l.rawPrice),
         "availabilityStatus": l.availabilityStatus, "lastSyncedAt": _iso(l.lastSyncedAt)}
        for l in (await db.execute(
            select(ProductRetailerListing).where(ProductRetailerListing.productId == product_id)
        )).scalars().all()
    ]
    return out


async def _sync_visibility_links(
    db: AsyncSession, *, product_id: str, slugs: list[str] | None, now: datetime
) -> None:
    """Replace a product's extra category-visibility links to match `slugs`.

    Backs the admin "Product Visibility" checkboxes. `None` means "leave links
    untouched" (field not sent); an empty list clears them. Unknown slugs are
    ignored silently so a stale option can never 500 the save.
    """
    if slugs is None:
        return
    wanted_ids: set[str] = set()
    if slugs:
        wanted_ids = set((await db.execute(
            select(Category.id_).where(Category.slug.in_(slugs))
        )).scalars().all())
    await db.execute(
        delete(ProductCategoryLink).where(
            ProductCategoryLink.productId == product_id,
            ProductCategoryLink.categoryId.notin_(wanted_ids) if wanted_ids else True,
        )
    )
    if wanted_ids:
        existing = set((await db.execute(
            select(ProductCategoryLink.categoryId).where(ProductCategoryLink.productId == product_id)
        )).scalars().all())
        for cid in wanted_ids - existing:
            db.add(ProductCategoryLink(productId=product_id, categoryId=cid, createdAt=now))


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
        primaryRetailer=payload.primaryRetailer,
        status=payload.status or "DRAFT",
        createdByAdminId=user.id,
        metaTitle=payload.metaTitle,
        metaDescription=payload.metaDescription,
        tags=payload.tags or [],
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
            createdAt=now,
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
            retailerDisplayName=l.retailerDisplayName,
            retailerProductUrl=l.retailerProductUrl, retailerImageUrl=l.retailerImageUrl,
            rawPrice=Decimal(str(l.rawPrice)) if l.rawPrice is not None else None,
            availabilityStatus=l.availabilityStatus or "IN_STOCK",
            syncFailedCount=0,
            createdAt=now, updatedAt=now,
        ))
    for idx, eid in enumerate(payload.editIds or []):
        db.add(EditProduct(id_=_cuid(), editId=eid, productId=pid, position=idx,
                           createdAt=now, updatedAt=now))
    await _sync_visibility_links(db, product_id=pid, slugs=payload.visibilityCategorySlugs, now=now)
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
    if payload.featureDays is not None:
        values["featuredUntil"] = (
            _now() + timedelta(days=payload.featureDays) if payload.featureDays > 0 else None
        )
    await db.execute(update(Product).where(Product.id_ == product_id).values(**values))
    if payload.editIds is not None:
        await db.execute(delete(EditProduct).where(
            EditProduct.productId == product_id,
            EditProduct.editId.notin_(payload.editIds) if payload.editIds else True,
        ))
        existing_edit_ids = set((await db.execute(
            select(EditProduct.editId).where(EditProduct.productId == product_id)
        )).scalars().all())
        now2 = _now()
        for eid in payload.editIds:
            if eid not in existing_edit_ids:
                pos = (await db.execute(
                    select(func.count(EditProduct.id_)).where(EditProduct.editId == eid)
                )).scalar_one()
                db.add(EditProduct(id_=_cuid(), editId=eid, productId=product_id, position=pos,
                                   createdAt=now2, updatedAt=now2))
    await _sync_visibility_links(
        db, product_id=product_id, slugs=payload.visibilityCategorySlugs, now=_now()
    )
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
    existing_count = (await db.execute(
        select(func.count(ProductImage.id_)).where(ProductImage.productId == product_id)
    )).scalar() or 0
    is_primary = bool(payload.isPrimary) or (existing_count == 0)
    if is_primary:
        await db.execute(
            update(ProductImage)
            .where(ProductImage.productId == product_id)
            .values(isPrimary=False)
        )
    db.add(ProductImage(
        id_=img_id, productId=product_id, url=payload.url, altText=payload.altText,
        isPrimary=is_primary, isAiGenerated=bool(payload.isAiGenerated),
        position=payload.position or 0, createdAt=now,
    ))
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.image.add", targetType="product", targetId=product_id)
    return {"id": img_id, "url": payload.url}


class BatchImagesInput(ApiModel):
    urls: list[str] = Field(min_length=1, max_length=50)


@router.post("/{product_id}/images/batch", dependencies=AdminDeps)
async def admin_add_images_batch(
    product_id: str,
    payload: BatchImagesInput,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    if not (await db.execute(select(Product.id_).where(Product.id_ == product_id))).scalar_one_or_none():
        raise HTTPException(404, "Product not found")
    now = _now()
    existing_count = (await db.execute(
        select(func.count(ProductImage.id_)).where(ProductImage.productId == product_id)
    )).scalar() or 0

    added = []
    for idx, url in enumerate(payload.urls):
        img_id = _cuid()
        is_primary = (existing_count == 0 and idx == 0)
        db.add(ProductImage(
            id_=img_id, productId=product_id, url=url,
            isPrimary=is_primary, isAiGenerated=False,
            position=existing_count + idx, createdAt=now,
        ))
        added.append({"id": img_id, "url": url})
    await db.commit()
    await audit_service.record(actorId=user.id, action="product.image.batch_add", targetType="product", targetId=product_id)
    return {"added": added}


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
        retailerDisplayName=payload.retailerDisplayName,
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
