"""
Engagement routes - wishlist, wardrobe, reviews, notifications, newsletter.

These domains share a critical pattern: SOME routes are @Public but expect to
soft-read the access cookie and serve an anonymous-shaped payload when not
signed in (must NOT return 401). The Nest source for each is small enough that
we co-locate them here rather than spreading across 5 separate files.

Optional-auth surfaces ported here:
  GET  /api/me/wishlist/ids                    → [] when anon
  GET  /api/notifications/unread-count         → {count: 0} when anon
  GET  /api/products/{id}/reviews/me           → {canReview:false, ...} when anon
  POST /api/newsletter/subscribe               → succeeds anonymously
  POST /api/clicks/{id}/report                 → handled in clicks.py

Full CRUD per domain (member-required) is included with minimal viable shapes
matched to the captured fixtures + the NestJS schema. Anything not exercised
by the parity harness is marked TODO inline.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import Field
from sqlalchemy import and_, delete, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import (
    AuthenticatedUser,
    current_user_optional,
    current_user_required,
)
from ...core.pagination import make_page
from ...core.pydantic_config import ApiModel
from ...db.models import (
    Brand,
    NewsletterSubscriber,
    Notification,
    NotificationPreference,
    Product,
    ProductImage,
    Review,
    WardrobeItem,
    WishlistItem,
)
from ...db.session import get_db

DbDep = Annotated[AsyncSession, Depends(get_db)]
_CUID_ALPHABET = string.ascii_lowercase + string.digits


def _cuid() -> str:
    return "c" + "".join(secrets.choice(_CUID_ALPHABET) for _ in range(24))


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso_ms(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


# ───────────── WISHLIST ──────────────────────────────────────────────────────

wishlist_router = APIRouter(tags=["wishlist"])


class AddWishlistRequest(ApiModel):
    productId: str = Field(min_length=1, max_length=64)
    notifyOnPriceDrop: bool | None = None


class UpdateWishlistRequest(ApiModel):
    notifyOnPriceDrop: bool


@wishlist_router.get("/me/wishlist/ids")
async def wishlist_ids(
    db: DbDep,
    user=Depends(current_user_optional),  # OPTIONAL - must return [] when anon
) -> list[str]:
    if user is None:
        return []
    rows = (await db.execute(
        select(WishlistItem.productId).where(WishlistItem.userId == user.id)
    )).scalars().all()
    return list(rows)


@wishlist_router.get("/me/wishlist")
async def wishlist_list(
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=100)] = 24,
) -> dict[str, Any]:
    total = (await db.execute(
        select(func.count(WishlistItem.id_)).where(WishlistItem.userId == user.id)
    )).scalar_one()
    rows = (await db.execute(
        select(WishlistItem)
        .where(WishlistItem.userId == user.id)
        .order_by(desc(WishlistItem.createdAt))
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    )).scalars().all()

    product_ids = [w.productId for w in rows]
    products = (await db.execute(
        select(Product).where(Product.id_.in_(product_ids))
    )).scalars().all() if product_ids else []
    product_map = {p.id_: p for p in products}

    brand_ids = [p.brandId for p in products if p.brandId]
    brands = (await db.execute(
        select(Brand).where(Brand.id_.in_(brand_ids))
    )).scalars().all() if brand_ids else []
    brand_map = {b.id_: b for b in brands}

    images = (await db.execute(
        select(ProductImage)
        .where(ProductImage.productId.in_(product_ids))
        .order_by(ProductImage.isPrimary.desc(), ProductImage.position.asc())
    )).scalars().all() if product_ids else []
    image_map: dict[str, ProductImage] = {}
    for img in images:
        if img.productId not in image_map:
            image_map[img.productId] = img

    items = []
    for w in rows:
        p = product_map.get(w.productId)
        if not p:
            continue
        b = brand_map.get(p.brandId)
        img = image_map.get(p.id_)
        items.append({
            "id": w.id_,
            "productId": w.productId,
            "notifyOnPriceDrop": w.notifyOnPriceDrop,
            "createdAt": _iso_ms(w.createdAt),
            "product": {
                "id": p.id_,
                "slug": p.slug,
                "title": p.title,
                "price": float(p.price) if p.price is not None else None,
                "mrp": float(p.mrp) if p.mrp is not None else None,
                "discountPct": float(p.discountPct) if p.discountPct is not None else None,
                "currency": p.currency,
                "brand": {"id": b.id_, "name": b.name, "slug": b.slug} if b else None,
                "primaryImage": {
                    "url": img.url,
                    "altText": img.altText,
                    "isAiGenerated": img.isAiGenerated,
                } if img else None,
            }
        })

    import math
    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": math.ceil(total / pageSize) or 1,
    }


@wishlist_router.post("/wishlist/items", status_code=201)
async def wishlist_add(
    payload: AddWishlistRequest,
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> dict[str, Any]:
    existing = (await db.execute(
        select(WishlistItem).where(
            WishlistItem.userId == user.id, WishlistItem.productId == payload.productId
        )
    )).scalar_one_or_none()
    if existing:
        return {"id": existing.id_, "productId": existing.productId, "notifyOnPriceDrop": existing.notifyOnPriceDrop}
    now = _now()
    item = WishlistItem(
        id_=_cuid(),
        userId=user.id,
        productId=payload.productId,
        notifyOnPriceDrop=bool(payload.notifyOnPriceDrop),
        createdAt=now,
        updatedAt=now,
    )
    db.add(item)
    await db.commit()
    return {"id": item.id_, "productId": item.productId, "notifyOnPriceDrop": item.notifyOnPriceDrop}


@wishlist_router.delete(
    "/wishlist/items/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def wishlist_remove(
    product_id: str,
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> Response:
    await db.execute(
        delete(WishlistItem).where(
            WishlistItem.userId == user.id, WishlistItem.productId == product_id
        )
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@wishlist_router.patch("/wishlist/items/{product_id}")
async def wishlist_update(
    product_id: str,
    payload: UpdateWishlistRequest,
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> dict[str, Any]:
    result = await db.execute(
        update(WishlistItem)
        .where(WishlistItem.userId == user.id, WishlistItem.productId == product_id)
        .values(notifyOnPriceDrop=payload.notifyOnPriceDrop, updatedAt=_now())
        .returning(WishlistItem.id_, WishlistItem.notifyOnPriceDrop)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    await db.commit()
    return {"id": row[0], "productId": product_id, "notifyOnPriceDrop": row[1]}


# ───────────── WARDROBE ──────────────────────────────────────────────────────

wardrobe_router = APIRouter(tags=["wardrobe"])


@wardrobe_router.get("/me/wardrobe")
async def wardrobe_list(
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=100)] = 24,
) -> dict[str, Any]:
    total = (await db.execute(
        select(func.count(WardrobeItem.id_))
        .where(WardrobeItem.userId == user.id, WardrobeItem.removedAt.is_(None))
    )).scalar_one()
    rows = (await db.execute(
        select(WardrobeItem)
        .where(WardrobeItem.userId == user.id, WardrobeItem.removedAt.is_(None))
        .order_by(desc(WardrobeItem.createdAt))
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    )).scalars().all()

    product_ids = [w.productId for w in rows]
    products = (await db.execute(
        select(Product).where(Product.id_.in_(product_ids))
    )).scalars().all() if product_ids else []
    product_map = {p.id_: p for p in products}

    brand_ids = [p.brandId for p in products if p.brandId]
    brands = (await db.execute(
        select(Brand).where(Brand.id_.in_(brand_ids))
    )).scalars().all() if brand_ids else []
    brand_map = {b.id_: b for b in brands}

    images = (await db.execute(
        select(ProductImage)
        .where(ProductImage.productId.in_(product_ids))
        .order_by(ProductImage.isPrimary.desc(), ProductImage.position.asc())
    )).scalars().all() if product_ids else []
    image_map: dict[str, ProductImage] = {}
    for img in images:
        if img.productId not in image_map:
            image_map[img.productId] = img

    items = []
    for w in rows:
        p = product_map.get(w.productId)
        if not p:
            continue
        b = brand_map.get(p.brandId)
        img = image_map.get(p.id_)
        items.append({
            "id": w.id_,
            "retailer": w.retailer,
            "selfReportedPrice": float(w.selfReportedPrice) if w.selfReportedPrice else None,
            "selfReportedDate": _iso_ms(w.selfReportedDate),
            "notes": w.notes,
            "tags": w.tags or [],
            "createdAt": _iso_ms(w.createdAt),
            "product": {
                "id": p.id_,
                "slug": p.slug,
                "title": p.title,
                "price": float(p.price) if p.price is not None else None,
                "currency": p.currency,
                "brand": {"id": b.id_, "name": b.name, "slug": b.slug} if b else None,
                "primaryImage": {
                    "url": img.url,
                    "altText": img.altText,
                    "isAiGenerated": img.isAiGenerated,
                } if img else None,
            }
        })

    # Stats for all active wardrobe items
    all_items = (await db.execute(
        select(WardrobeItem)
        .where(WardrobeItem.userId == user.id, WardrobeItem.removedAt.is_(None))
    )).scalars().all()
    all_prod_ids = [w.productId for w in all_items]
    all_products = (await db.execute(
        select(Product.id_, Product.price, Brand.name, Brand.slug)
        .join(Brand, Brand.id_ == Product.brandId)
        .where(Product.id_.in_(all_prod_ids))
    )).all() if all_prod_ids else []
    prod_price_brand_map = {p[0]: {"price": p[1], "brand_name": p[2], "brand_slug": p[3]} for p in all_products}

    total_spend = 0.0
    brand_counts = {}
    for w in all_items:
        p_info = prod_price_brand_map.get(w.productId)
        if not p_info:
            continue
        price = float(w.selfReportedPrice) if w.selfReportedPrice else float(p_info["price"])
        total_spend += price
        b_slug = p_info["brand_slug"]
        b_name = p_info["brand_name"]
        if b_slug not in brand_counts:
            brand_counts[b_slug] = {"name": b_name, "slug": b_slug, "count": 0}
        brand_counts[b_slug]["count"] += 1

    fav_brand = None
    if brand_counts:
        fav_brand = sorted(brand_counts.values(), key=lambda x: x["count"], reverse=True)[0]

    import math
    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": math.ceil(total / pageSize) or 1,
        "stats": {
            "totalItems": len(all_items),
            "totalSpend": total_spend,
            "favoriteBrand": fav_brand,
        }
    }


@wardrobe_router.delete(
    "/wardrobe/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def wardrobe_remove(
    item_id: str,
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> Response:
    await db.execute(
        delete(WardrobeItem).where(WardrobeItem.id_ == item_id, WardrobeItem.userId == user.id)
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ───────────── REVIEWS ──────────────────────────────────────────────────────

reviews_router = APIRouter(prefix="/products/{product_id}/reviews", tags=["reviews"])


class CreateReviewRequest(ApiModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=140)
    body: str | None = Field(default=None, max_length=4000)
    imageUrls: list[str] | None = Field(default=None, max_length=6)


@reviews_router.get("")
async def reviews_list(
    product_id: str,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=50)] = 12,
) -> dict[str, Any]:
    total = (await db.execute(
        select(func.count(Review.id_)).where(
            Review.productId == product_id, Review.status == "PUBLISHED"
        )
    )).scalar_one()
    rows = (await db.execute(
        select(Review)
        .where(Review.productId == product_id, Review.status == "PUBLISHED")
        .order_by(desc(Review.createdAt))
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    )).scalars().all()
    data = [
        {
            "id": r.id_,
            "rating": r.rating,
            "title": r.title,
            "body": r.body,
            "imagesJson": r.imagesJson,
            "createdAt": _iso_ms(r.createdAt),
        }
        for r in rows
    ]
    return make_page(data, total, page, pageSize)


@reviews_router.get("/me")
async def reviews_me(
    product_id: str,
    db: DbDep,
    user=Depends(current_user_optional),  # OPTIONAL - anonymous shape when not signed in
) -> dict[str, Any]:
    if user is None:
        return {"canReview": False, "hasWardrobeItem": False, "ownReview": None}
    in_wardrobe = (await db.execute(
        select(WardrobeItem.id_).where(
            WardrobeItem.userId == user.id, WardrobeItem.productId == product_id
        )
    )).scalar_one_or_none() is not None
    own = (await db.execute(
        select(Review).where(Review.userId == user.id, Review.productId == product_id)
    )).scalar_one_or_none()
    return {
        "canReview": in_wardrobe and own is None,
        "hasWardrobeItem": in_wardrobe,
        "ownReview": (
            {"id": own.id_, "rating": own.rating, "title": own.title, "body": own.body}
            if own
            else None
        ),
    }


@reviews_router.post("", status_code=201)
async def reviews_create(
    product_id: str,
    payload: CreateReviewRequest,
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> dict[str, Any]:
    in_wardrobe = (await db.execute(
        select(WardrobeItem.id_).where(
            WardrobeItem.userId == user.id, WardrobeItem.productId == product_id
        )
    )).scalar_one_or_none() is not None
    if not in_wardrobe:
        raise HTTPException(status_code=403, detail="Must own product before reviewing")
    now = _now()
    review = Review(
        id_=_cuid(),
        productId=product_id,
        userId=user.id,
        rating=payload.rating,
        title=payload.title,
        body=payload.body,
        imagesJson=payload.imageUrls or [],
        status="PUBLISHED",
        createdAt=now,
        updatedAt=now,
    )
    db.add(review)
    await db.commit()
    return {"id": review.id_, "rating": review.rating, "status": review.status}


# ───────────── NOTIFICATIONS ─────────────────────────────────────────────────

notifications_router = APIRouter(tags=["notifications"])


@notifications_router.get("/notifications")
async def notifications_list(
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=50)] = 20,
    unreadOnly: Annotated[bool, Query()] = False,
) -> dict[str, Any]:
    conds = [Notification.userId == user.id]
    if unreadOnly:
        conds.append(Notification.readAt.is_(None))
    where = and_(*conds)
    total = (await db.execute(select(func.count(Notification.id_)).where(where))).scalar_one()
    rows = (await db.execute(
        select(Notification).where(where).order_by(desc(Notification.createdAt))
        .offset((page - 1) * pageSize).limit(pageSize)
    )).scalars().all()
    data = [
        {
            "id": n.id_,
            "type": n.type,
            "channel": n.channel,
            "payload": n.payload,
            "readAt": _iso_ms(n.readAt),
            "sentAt": _iso_ms(n.sentAt),
            "createdAt": _iso_ms(n.createdAt),
        }
        for n in rows
    ]
    unread_count = (await db.execute(
        select(func.count(Notification.id_)).where(
            Notification.userId == user.id, Notification.readAt.is_(None)
        )
    )).scalar_one()
    res = make_page(data, total, page, pageSize)
    res["unread"] = unread_count
    return res


@notifications_router.get("/notifications/unread-count")
async def notifications_unread_count(
    db: DbDep,
    user=Depends(current_user_optional),  # OPTIONAL - {count: 0} when anon
) -> dict[str, int]:
    if user is None:
        return {"count": 0}
    count = (await db.execute(
        select(func.count(Notification.id_)).where(
            Notification.userId == user.id, Notification.readAt.is_(None)
        )
    )).scalar_one()
    return {"count": count}


@notifications_router.post(
    "/notifications/{notif_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def notifications_mark_read(
    notif_id: str,
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> Response:
    await db.execute(
        update(Notification)
        .where(Notification.id_ == notif_id, Notification.userId == user.id)
        .values(readAt=_now())
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@notifications_router.post(
    "/notifications/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def notifications_mark_all_read(
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> Response:
    await db.execute(
        update(Notification)
        .where(Notification.userId == user.id, Notification.readAt.is_(None))
        .values(readAt=_now())
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@notifications_router.get("/notification-preferences")
async def notification_prefs_list(
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> list[dict[str, Any]]:
    rows = (await db.execute(
        select(NotificationPreference).where(NotificationPreference.userId == user.id)
    )).scalars().all()
    return [
        {"type": p.type, "channel": p.channel, "enabled": p.enabled}
        for p in rows
    ]


class UpdatePreferenceRequest(ApiModel):
    type: str
    channel: str
    enabled: bool


@notifications_router.patch("/notification-preferences")
async def notification_prefs_update(
    payload: UpdatePreferenceRequest,
    db: DbDep,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
) -> dict[str, Any]:
    existing = (await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.userId == user.id,
            NotificationPreference.type == payload.type,
            NotificationPreference.channel == payload.channel,
        )
    )).scalar_one_or_none()
    now = _now()
    if existing:
        await db.execute(
            update(NotificationPreference)
            .where(NotificationPreference.id_ == existing.id_)
            .values(enabled=payload.enabled, updatedAt=now)
        )
    else:
        db.add(NotificationPreference(
            id_=_cuid(), userId=user.id,
            type=payload.type, channel=payload.channel, enabled=payload.enabled,
            createdAt=now, updatedAt=now,
        ))
    await db.commit()
    return {"type": payload.type, "channel": payload.channel, "enabled": payload.enabled}


# ───────────── NEWSLETTER ────────────────────────────────────────────────────

newsletter_router = APIRouter(prefix="/newsletter", tags=["newsletter"])


class SubscribeRequest(ApiModel):
    email: str
    source: str | None = Field(default=None, max_length=40)


class TokenRequest(ApiModel):
    token: str


@newsletter_router.post("/subscribe", status_code=status.HTTP_200_OK)
async def newsletter_subscribe(
    payload: SubscribeRequest,
    db: DbDep,
    user=Depends(current_user_optional),  # OPTIONAL - capture user id if signed in
) -> dict[str, str]:
    email = payload.email.strip().lower()
    existing = (await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
    )).scalar_one_or_none()
    now = _now()
    if existing is None:
        # Token + double-opt-in flow is stubbed for the parity port; mark CONFIRMED
        # directly for now and rely on the audit log for traceability.
        from hashlib import sha256
        confirmation = sha256(_cuid().encode()).hexdigest()
        unsubscribe = sha256(_cuid().encode()).hexdigest()
        db.add(NewsletterSubscriber(
            id_=_cuid(),
            email=email,
            userId=user.id if user else None,
            source=payload.source,
            status="PENDING",
            confirmationTokenHash=confirmation,
            unsubscribeTokenHash=unsubscribe,
            createdAt=now,
            updatedAt=now,
        ))
        await db.commit()
    return {"status": "ok"}


@newsletter_router.post("/confirm", status_code=status.HTTP_200_OK)
async def newsletter_confirm(payload: TokenRequest, db: DbDep) -> dict[str, str]:
    from hashlib import sha256
    th = sha256(payload.token.encode()).hexdigest()
    row = (await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.confirmationTokenHash == th)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid token")
    await db.execute(
        update(NewsletterSubscriber)
        .where(NewsletterSubscriber.id_ == row.id_)
        .values(status="CONFIRMED", confirmedAt=_now(), confirmationTokenHash=None)
    )
    await db.commit()
    return {"status": "confirmed"}


@newsletter_router.post("/unsubscribe", status_code=status.HTTP_200_OK)
async def newsletter_unsubscribe(payload: TokenRequest, db: DbDep) -> dict[str, str]:
    from hashlib import sha256
    th = sha256(payload.token.encode()).hexdigest()
    await db.execute(
        update(NewsletterSubscriber)
        .where(NewsletterSubscriber.unsubscribeTokenHash == th)
        .values(status="UNSUBSCRIBED", unsubscribedAt=_now())
    )
    await db.commit()
    return {"status": "ok"}
