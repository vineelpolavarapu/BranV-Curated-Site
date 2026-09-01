"""
Engagement routes - wishlist, wardrobe, notifications.

These domains share a critical pattern: SOME routes are @Public but expect to
soft-read the access cookie and serve an anonymous-shaped payload when not
signed in (must NOT return 401). The Nest source for each is small enough that
we co-locate them here rather than spreading across 5 separate files.

Optional-auth surfaces ported here:
  GET  /api/me/wishlist/ids                    → [] when anon
  GET  /api/notifications/unread-count         → {count: 0} when anon
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
    Notification,
    NotificationPreference,
    Product,
    ProductImage,
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
        select(Product.id_, Brand.name, Brand.slug)
        .join(Brand, Brand.id_ == Product.brandId)
        .where(Product.id_.in_(all_prod_ids))
    )).all() if all_prod_ids else []
    prod_brand_map = {p[0]: {"brand_name": p[1], "brand_slug": p[2]} for p in all_products}

    total_spend = 0.0
    brand_counts = {}
    for w in all_items:
        p_info = prod_brand_map.get(w.productId)
        if not p_info:
            continue
        if w.selfReportedPrice:
            total_spend += float(w.selfReportedPrice)
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
