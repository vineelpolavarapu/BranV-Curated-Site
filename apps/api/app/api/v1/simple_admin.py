"""
Simple-CRUD admin domains consolidated into a single module.

These all follow the same brands-style pattern: list / get / create / patch /
delete + audit. They're combined here to save router-file overhead since each
one is small (~50 lines of logic).

Domains:
  - /api/admin/avatars               (avatars)
  - /api/admin/banners               (home_banners - with start/end time window)
  - /api/admin/brands/{id}/story     (brand_stories - PUT upsert)
  - /api/brands/{slug}/story         (public read of published story)
  - /api/admin/settings              (platform_setting - PUT upsert, in-process cache)
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import Field
from sqlalchemy import and_, delete, desc, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import (
    AuthenticatedUser,
    current_user_required,
    enforce_two_factor,
    require_roles,
)
from ...core.pydantic_config import ApiModel
from ...db.models import Avatar, Brand, BrandStory, HomeBanner, PlatformSetting
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


# ───────────── AVATARS ──────────────────────────────────────────────────────

avatars_router = APIRouter(prefix="/admin/avatars", tags=["admin-avatars"], dependencies=AdminDeps)


class CreateAvatarRequest(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    referenceImageUrl: str
    promptTemplate: str = Field(min_length=1, max_length=4000)
    tags: list[str] | None = Field(default=None, max_length=20)


class UpdateAvatarRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    referenceImageUrl: str | None = None
    promptTemplate: str | None = Field(default=None, min_length=1, max_length=4000)
    tags: list[str] | None = Field(default=None, max_length=20)


def _serialize_avatar(a: Avatar) -> dict[str, Any]:
    return {
        "id": a.id_,
        "name": a.name,
        "referenceImageUrl": a.referenceImageUrl,
        "promptTemplate": a.promptTemplate,
        "tags": a.tags or [],
        "createdAt": _iso(a.createdAt),
        "updatedAt": _iso(a.updatedAt),
    }


@avatars_router.get("")
async def avatars_list(db: DbDep) -> list[dict[str, Any]]:
    rows = (await db.execute(select(Avatar).order_by(desc(Avatar.createdAt)))).scalars().all()
    return [_serialize_avatar(a) for a in rows]


@avatars_router.get("/{avatar_id}")
async def avatars_get(avatar_id: str, db: DbDep) -> dict[str, Any]:
    a = (await db.execute(select(Avatar).where(Avatar.id_ == avatar_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Avatar not found")
    return _serialize_avatar(a)


@avatars_router.post("", status_code=201)
async def avatars_create(
    payload: CreateAvatarRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    now = _now()
    a = Avatar(
        id_=_cuid(),
        name=payload.name,
        referenceImageUrl=payload.referenceImageUrl,
        promptTemplate=payload.promptTemplate,
        tags=payload.tags or [],
        createdAt=now,
        updatedAt=now,
    )
    db.add(a)
    await db.commit()
    await audit_service.record(actorId=user.id, action="avatar.create", targetType="avatar", targetId=a.id_)
    return _serialize_avatar(a)


@avatars_router.patch("/{avatar_id}")
async def avatars_update(
    avatar_id: str,
    payload: UpdateAvatarRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    existing = (await db.execute(select(Avatar).where(Avatar.id_ == avatar_id))).scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Avatar not found")
    values: dict[str, Any] = {"updatedAt": _now()}
    for k in ("name", "referenceImageUrl", "promptTemplate", "tags"):
        v = getattr(payload, k)
        if v is not None:
            values[k] = v
    await db.execute(update(Avatar).where(Avatar.id_ == avatar_id).values(**values))
    await db.commit()
    await audit_service.record(actorId=user.id, action="avatar.update", targetType="avatar", targetId=avatar_id)
    fresh = (await db.execute(select(Avatar).where(Avatar.id_ == avatar_id))).scalar_one()
    return _serialize_avatar(fresh)


@avatars_router.delete("/{avatar_id}", status_code=204, response_class=Response)
async def avatars_delete(
    avatar_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    result = await db.execute(delete(Avatar).where(Avatar.id_ == avatar_id))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "Avatar not found")
    await audit_service.record(actorId=user.id, action="avatar.delete", targetType="avatar", targetId=avatar_id)
    return Response(status_code=204)


# ───────────── BANNERS ──────────────────────────────────────────────────────

banners_router = APIRouter(prefix="/admin/banners", tags=["admin-banners"], dependencies=AdminDeps)


class CreateBannerRequest(ApiModel):
    imageUrl: str
    headline: str | None = Field(default=None, max_length=140)
    ctaLabel: str | None = Field(default=None, max_length=40)
    ctaLink: str | None = Field(default=None, max_length=500)
    displayOrder: int | None = None
    startsAt: str | None = None
    endsAt: str | None = None
    status: Literal["ACTIVE", "HIDDEN"] | None = None


class UpdateBannerRequest(CreateBannerRequest):
    imageUrl: str | None = None  # all optional on update


def _parse_dt(s: str | None) -> datetime | None:
    if s is None:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)


def _validate_window(start: str | None, end: str | None) -> None:
    if start and end and _parse_dt(end) <= _parse_dt(start):  # type: ignore[operator]
        raise HTTPException(400, "endsAt must be after startsAt")


def _serialize_banner(b: HomeBanner) -> dict[str, Any]:
    return {
        "id": b.id_,
        "imageUrl": b.imageUrl,
        "headline": b.headline,
        "ctaLabel": b.ctaLabel,
        "ctaLink": b.ctaLink,
        "displayOrder": b.displayOrder,
        "startsAt": _iso(b.startsAt),
        "endsAt": _iso(b.endsAt),
        "status": b.status,
        "createdAt": _iso(b.createdAt),
        "updatedAt": _iso(b.updatedAt),
    }


@banners_router.get("")
async def banners_list(db: DbDep) -> list[dict[str, Any]]:
    rows = (await db.execute(
        select(HomeBanner).order_by(HomeBanner.displayOrder.asc(), desc(HomeBanner.createdAt))
    )).scalars().all()
    return [_serialize_banner(b) for b in rows]


@banners_router.get("/{banner_id}")
async def banners_get(banner_id: str, db: DbDep) -> dict[str, Any]:
    b = (await db.execute(select(HomeBanner).where(HomeBanner.id_ == banner_id))).scalar_one_or_none()
    if not b:
        raise HTTPException(404, "Banner not found")
    return _serialize_banner(b)


@banners_router.post("", status_code=201)
async def banners_create(
    payload: CreateBannerRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    _validate_window(payload.startsAt, payload.endsAt)
    now = _now()
    b = HomeBanner(
        id_=_cuid(),
        imageUrl=payload.imageUrl,
        headline=payload.headline,
        ctaLabel=payload.ctaLabel,
        ctaLink=payload.ctaLink,
        displayOrder=payload.displayOrder or 0,
        startsAt=_parse_dt(payload.startsAt),
        endsAt=_parse_dt(payload.endsAt),
        status=payload.status or "ACTIVE",
        createdAt=now,
        updatedAt=now,
    )
    db.add(b)
    await db.commit()
    await audit_service.record(actorId=user.id, action="banner.create", targetType="home_banner", targetId=b.id_)
    return _serialize_banner(b)


@banners_router.patch("/{banner_id}")
async def banners_update(
    banner_id: str,
    payload: UpdateBannerRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    existing = (await db.execute(select(HomeBanner).where(HomeBanner.id_ == banner_id))).scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Banner not found")
    _validate_window(payload.startsAt, payload.endsAt)
    values: dict[str, Any] = {"updatedAt": _now()}
    for k in ("imageUrl", "headline", "ctaLabel", "ctaLink", "displayOrder", "status"):
        v = getattr(payload, k)
        if v is not None:
            values[k] = v
    if payload.startsAt is not None:
        values["startsAt"] = _parse_dt(payload.startsAt)
    if payload.endsAt is not None:
        values["endsAt"] = _parse_dt(payload.endsAt)
    await db.execute(update(HomeBanner).where(HomeBanner.id_ == banner_id).values(**values))
    await db.commit()
    await audit_service.record(actorId=user.id, action="banner.update", targetType="home_banner", targetId=banner_id)
    fresh = (await db.execute(select(HomeBanner).where(HomeBanner.id_ == banner_id))).scalar_one()
    return _serialize_banner(fresh)


@banners_router.delete("/{banner_id}", status_code=204, response_class=Response)
async def banners_delete(
    banner_id: str,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> Response:
    result = await db.execute(delete(HomeBanner).where(HomeBanner.id_ == banner_id))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "Banner not found")
    await audit_service.record(actorId=user.id, action="banner.delete", targetType="home_banner", targetId=banner_id)
    return Response(status_code=204)


# ───────────── BRAND STORIES ────────────────────────────────────────────────

brand_story_admin_router = APIRouter(prefix="/admin/brands", tags=["admin-brand-stories"], dependencies=AdminDeps)
brand_story_public_router = APIRouter(prefix="/brands", tags=["brand-stories"])


class UpsertBrandStoryRequest(ApiModel):
    heroUrl: str | None = None
    bodyMd: str | None = Field(default=None, max_length=50000)
    status: Literal["DRAFT", "PUBLISHED"] | None = None


def _serialize_story(s: BrandStory) -> dict[str, Any]:
    return {
        "id": s.id_,
        "brandId": s.brandId,
        "heroUrl": s.heroUrl,
        "bodyMd": s.bodyMd,
        "status": s.status,
        "createdAt": _iso(s.createdAt),
        "updatedAt": _iso(s.updatedAt),
    }


@brand_story_admin_router.get("/{brand_id}/story")
async def story_admin_get(brand_id: str, db: DbDep) -> dict[str, Any] | None:
    if not (await db.execute(select(Brand.id_).where(Brand.id_ == brand_id))).scalar_one_or_none():
        raise HTTPException(404, "Brand not found")
    s = (await db.execute(select(BrandStory).where(BrandStory.brandId == brand_id))).scalar_one_or_none()
    return _serialize_story(s) if s else None


@brand_story_admin_router.put("/{brand_id}/story")
async def story_admin_upsert(
    brand_id: str,
    payload: UpsertBrandStoryRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    if not (await db.execute(select(Brand.id_).where(Brand.id_ == brand_id))).scalar_one_or_none():
        raise HTTPException(404, "Brand not found")
    existing = (await db.execute(select(BrandStory).where(BrandStory.brandId == brand_id))).scalar_one_or_none()
    now = _now()
    if existing:
        values: dict[str, Any] = {"updatedAt": now}
        if payload.heroUrl is not None:
            values["heroUrl"] = payload.heroUrl
        if payload.bodyMd is not None:
            values["bodyMd"] = payload.bodyMd
        if payload.status is not None:
            values["status"] = payload.status
        await db.execute(update(BrandStory).where(BrandStory.id_ == existing.id_).values(**values))
        sid = existing.id_
    else:
        sid = _cuid()
        db.add(BrandStory(
            id_=sid,
            brandId=brand_id,
            heroUrl=payload.heroUrl,
            bodyMd=payload.bodyMd or "",
            status=payload.status or "DRAFT",
            createdAt=now,
            updatedAt=now,
        ))
    await db.commit()
    await audit_service.record(actorId=user.id, action="brand_story.upsert", targetType="brand_story", targetId=sid, metadata={"brandId": brand_id})
    fresh = (await db.execute(select(BrandStory).where(BrandStory.id_ == sid))).scalar_one()
    return _serialize_story(fresh)


@brand_story_public_router.get("/{slug}/story")
async def story_public(slug: str, db: DbDep) -> dict[str, Any] | None:
    brand = (await db.execute(select(Brand).where(Brand.slug == slug))).scalar_one_or_none()
    if not brand:
        return None
    s = (await db.execute(select(BrandStory).where(BrandStory.brandId == brand.id_))).scalar_one_or_none()
    if not s or s.status != "PUBLISHED":
        return None
    return {"heroUrl": s.heroUrl, "bodyMd": s.bodyMd}


# ───────────── SETTINGS ─────────────────────────────────────────────────────

settings_router = APIRouter(prefix="/admin/settings", tags=["admin-settings"], dependencies=AdminDeps)

SETTING_DEFAULTS: dict[str, Any] = {
    "PRICE_SYNC_DRIFT_THRESHOLD_PCT": 5,
    "NEW_ARRIVAL_DAYS": 30,
    "BASE_CURRENCY": "INR",
    "ANALYTICS_ESTIMATED_RATE_PCT": 5,
    "GOOGLE_OAUTH_ENABLED": False,
    "WEB_PUSH_ENABLED": False,
    "SMS_ENABLED": False,
    "AFFILIATE_DISCLOSURE_TEXT": (
        "BranV is a curated affiliate platform. We never hold inventory, never "
        "process payments, never fulfill orders. When you click Buy Now, you are "
        "redirected to the retailer's site to complete your purchase. We earn a "
        "small commission on qualifying sales, at no extra cost to you."
    ),
}

# Keys exposed to the public (unauthenticated) storefront. Keep this list
# short and content-only; feature flags / numeric tunables stay admin-only.
PUBLIC_SETTING_KEYS = {"AFFILIATE_DISCLOSURE_TEXT"}


class UpdateSettingRequest(ApiModel):
    key: str = Field(min_length=1, max_length=80)
    value: Any  # free-form JSON


@settings_router.get("")
async def settings_list(db: DbDep) -> dict[str, Any]:
    rows = (await db.execute(select(PlatformSetting))).scalars().all()
    merged = dict(SETTING_DEFAULTS)
    for r in rows:
        merged[r.key] = r.valueJson
    return merged


@settings_router.put("")
async def settings_upsert(
    payload: UpdateSettingRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> dict[str, Any]:
    if payload.key not in SETTING_DEFAULTS:
        raise HTTPException(400, f"Unknown setting key: {payload.key}")
    existing = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == payload.key))).scalar_one_or_none()
    now = _now()
    if existing:
        await db.execute(
            update(PlatformSetting)
            .where(PlatformSetting.key == payload.key)
            .values(valueJson=payload.value, updatedById=user.id, updatedAt=now)
        )
    else:
        db.add(PlatformSetting(
            key=payload.key,
            valueJson=payload.value,
            updatedById=user.id,
            createdAt=now,
            updatedAt=now,
        ))
    await db.commit()
    await audit_service.record(
        actorId=user.id,
        action="settings.update",
        targetType="platform_setting",
        targetId=payload.key,
        metadata={"key": payload.key, "value": payload.value},
    )
    return {"key": payload.key, "value": payload.value}


# ───────────── PUBLIC SETTINGS (unauthenticated storefront) ─────────────────

public_settings_router = APIRouter(prefix="/settings", tags=["settings"])


@public_settings_router.get("/public")
async def public_settings(db: DbDep) -> dict[str, Any]:
    rows = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key.in_(PUBLIC_SETTING_KEYS))
    )).scalars().all()
    merged = {k: SETTING_DEFAULTS[k] for k in PUBLIC_SETTING_KEYS}
    for r in rows:
        merged[r.key] = r.valueJson
    return merged
