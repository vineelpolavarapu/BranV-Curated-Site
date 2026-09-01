"""
Admin operational endpoints: analytics.

Analytics are computed live from click_events / self_reported_conversions.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import (
    AuthenticatedUser,
    current_user_required,
    enforce_two_factor,
    require_roles,
)
from ...db.models import (
    AffiliateLink,
    ClickEvent,
    NotificationOutbox,
    Product,
    ProductRetailerListing,
    SelfReportedConversion,
    User,
)
from ...db.enums import OutboxStatus
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


# ───────────── ANALYTICS ────────────────────────────────────────────────────

analytics_router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"], dependencies=AdminDeps)


async def _overview_data(db: AsyncSession) -> dict[str, Any]:
    now = _now()
    week_ago = now - timedelta(days=7)
    return {
        "totalProducts": (await db.execute(
            select(func.count(Product.id_)).where(Product.status == "ACTIVE")
        )).scalar_one(),
        "totalMembers": (await db.execute(
            select(func.count(User.id_)).where(User.role == "MEMBER", User.status == "ACTIVE")
        )).scalar_one(),
        "clickEvents7d": (await db.execute(
            select(func.count(ClickEvent.id_)).where(ClickEvent.redirectedAt >= week_ago)
        )).scalar_one(),
        "selfReportedConversions7d": (await db.execute(
            select(func.count(SelfReportedConversion.id_)).where(SelfReportedConversion.reportedAt >= week_ago)
        )).scalar_one(),
        "asOf": _iso(now),
    }


@analytics_router.get("/overview")
async def overview(db: DbDep) -> dict[str, Any]:
    return await _overview_data(db)


@analytics_router.get("/clicks")
async def clicks_breakdown(db: DbDep) -> dict[str, Any]:
    week_ago = _now() - timedelta(days=7)
    rows = (await db.execute(
        select(ClickEvent.retailer, func.count(ClickEvent.id_).label("clicks"))
        .where(ClickEvent.redirectedAt >= week_ago)
        .group_by(ClickEvent.retailer)
        .order_by(desc("clicks"))
    )).all()
    return {"byRetailer": [{"retailer": r[0], "clicks": r[1]} for r in rows]}


@analytics_router.get("/content")
async def content_breakdown(db: DbDep) -> dict[str, Any]:
    # Top 10 products by click volume in the last 7 days.
    week_ago = _now() - timedelta(days=7)
    rows = (await db.execute(
        select(ClickEvent.productId, func.count(ClickEvent.id_).label("clicks"))
        .where(ClickEvent.redirectedAt >= week_ago)
        .group_by(ClickEvent.productId)
        .order_by(desc("clicks"))
        .limit(10)
    )).all()
    return {"topProducts7d": [{"productId": r[0], "clicks": r[1]} for r in rows]}


@analytics_router.get("/members")
async def members_breakdown(db: DbDep) -> dict[str, Any]:
    week_ago = _now() - timedelta(days=7)
    new_members = (await db.execute(
        select(func.count(User.id_)).where(User.createdAt >= week_ago)
    )).scalar_one()
    total = (await db.execute(
        select(func.count(User.id_)).where(User.role == "MEMBER")
    )).scalar_one()
    return {"newMembers7d": new_members, "totalMembers": total}


@analytics_router.get("/system")
async def system_health(db: DbDep) -> dict[str, Any]:
    outbox_pending = (await db.execute(
        select(func.count(NotificationOutbox.id_)).where(NotificationOutbox.status == OutboxStatus.PENDING)
    )).scalar_one()
    outbox_failed = (await db.execute(
        select(func.count(NotificationOutbox.id_)).where(NotificationOutbox.status == OutboxStatus.FAILED)
    )).scalar_one()
    sync_failures = (await db.execute(
        select(func.count(ProductRetailerListing.id_)).where(ProductRetailerListing.syncFailedCount >= 3)
    )).scalar_one()
    pending_affiliate_links = (await db.execute(
        select(func.count(AffiliateLink.id_)).where(AffiliateLink.pendingConversion == True)
    )).scalar_one()

    return {
        "notificationOutbox": {"pending": outbox_pending, "failed": outbox_failed},
        "syncFailureCount": sync_failures,
        "pendingAffiliateConversions": pending_affiliate_links,
        "apiP95Ms": None,
        "errorRatePct": None,
    }


@analytics_router.get("/dashboard")
async def dashboard(db: DbDep) -> dict[str, Any]:
    overview = await _overview_data(db)
    clicks = await clicks_breakdown(db)
    content = await content_breakdown(db)
    members = await members_breakdown(db)
    system = await system_health(db)
    return {
        "overview": overview,
        "clicks": clicks,
        "content": content,
        "members": members,
        "system": system,
    }
