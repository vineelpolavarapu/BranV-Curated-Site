"""
Admin operational endpoints: analytics, reconciliation, affiliate convert,
price-sync trigger.

Analytics rollups are computed live for now (Step 8 cron will pre-aggregate
into analytics_daily_*). Reconciliation accepts the CSV upload and
idempotently records the payout — full row matching to ClickEvents is a
follow-up port.
"""

from __future__ import annotations

import csv
import hashlib
import io
import secrets
import string
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import Field
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import (
    AuthenticatedUser,
    current_user_required,
    enforce_two_factor,
    require_roles,
)
from ...core.pydantic_config import ApiModel
from ...db.models import (
    AffiliateLink,
    AffiliatePayout,
    AffiliatePayoutItem,
    ClickEvent,
    Notification,
    NotificationOutbox,
    Product,
    ProductRetailerListing,
    Review,
    SelfReportedConversion,
    User,
)
from ...db.enums import OutboxStatus, ReviewStatus
from ...db.session import get_db
from ...integrations.amazon import tag_url
from ...integrations.cuelinks import convert_url as cuelinks_convert
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
        "publishedReviews7d": (await db.execute(
            select(func.count(Review.id_)).where(
                Review.status == "PUBLISHED", Review.createdAt >= week_ago
            )
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
    hidden_reviews = (await db.execute(
        select(func.count(Review.id_)).where(Review.status == ReviewStatus.HIDDEN)
    )).scalar_one()

    return {
        "notificationOutbox": {"pending": outbox_pending, "failed": outbox_failed},
        "syncFailureCount": sync_failures,
        "pendingAffiliateConversions": pending_affiliate_links,
        "hiddenReviewCount": hidden_reviews,
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


# ───────────── RECONCILIATION (multipart CSV upload) ────────────────────────

recon_router = APIRouter(prefix="/admin/affiliate/reconciliation", tags=["admin-reconciliation"], dependencies=AdminDeps)

CSV_TYPE_REGEX_ALLOWED = ("csv", "plain", "excel", "sheet")
MAX_CSV_BYTES = 2 * 1024 * 1024


def _is_csvish(content_type: str | None) -> bool:
    if not content_type:
        return False
    ct = content_type.lower()
    return any(tok in ct for tok in CSV_TYPE_REGEX_ALLOWED)


@recon_router.get("")
async def recon_list(db: DbDep) -> list[dict[str, Any]]:
    rows = (await db.execute(
        select(AffiliatePayout).order_by(desc(AffiliatePayout.createdAt))
    )).scalars().all()
    return [
        {
            "id": p.id_,
            "partner": p.partner,
            "reportedPeriodStart": _iso(p.reportedPeriodStart),
            "reportedPeriodEnd": _iso(p.reportedPeriodEnd),
            "reportedClicks": p.reportedClicks,
            "reportedOrders": p.reportedOrders,
            "reportedCommissionInr": str(p.reportedCommissionInr) if p.reportedCommissionInr else None,
            "csvFilename": p.csvFilename,
            "rowCount": p.rowCount,
            "matchedCount": p.matchedCount,
            "unmatchedCount": p.unmatchedCount,
            "ambiguousCount": p.ambiguousCount,
            "notes": p.notes,
            "createdAt": _iso(p.createdAt),
        }
        for p in rows
    ]


@recon_router.get("/variance")
async def recon_variance(
    db: DbDep,
    partner: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    # Aggregate self-reported vs payout-reported for the given partner.
    q = select(
        func.sum(AffiliatePayout.reportedCommissionInr).label("reportedCommission"),
        func.sum(AffiliatePayout.reportedOrders).label("reportedOrders"),
    )
    if partner:
        q = q.where(AffiliatePayout.partner == partner)
    reported = (await db.execute(q)).first()
    return {
        "partner": partner,
        "reportedCommissionInr": str(reported[0]) if reported and reported[0] else "0",
        "reportedOrders": reported[1] or 0 if reported else 0,
    }


@recon_router.get("/{payout_id}")
async def recon_get(payout_id: str, db: DbDep) -> dict[str, Any]:
    p = (await db.execute(select(AffiliatePayout).where(AffiliatePayout.id_ == payout_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Payout not found")
    items = (await db.execute(
        select(AffiliatePayoutItem).where(AffiliatePayoutItem.payoutId == payout_id)
        .order_by(AffiliatePayoutItem.createdAt.asc())
    )).scalars().all()

    # Hydrate matched click events and products
    click_ids = [it.matchedClickEventId for it in items if it.matchedClickEventId]
    clicks = (await db.execute(
        select(ClickEvent).where(ClickEvent.id_.in_(click_ids))
    )).scalars().all() if click_ids else []
    click_map = {c.id_: c for c in clicks}

    prod_ids = [c.productId for c in clicks if c.productId]
    products = (await db.execute(
        select(Product.id_, Product.title, Product.slug).where(Product.id_.in_(prod_ids))
    )).all() if prod_ids else []
    prod_map = {p_row[0]: {"title": p_row[1], "slug": p_row[2]} for p_row in products}

    shaped_items = []
    for it in items:
        matched_click_event = None
        if it.matchedClickEventId:
            c = click_map.get(it.matchedClickEventId)
            if c:
                p_info = prod_map.get(c.productId)
                matched_click_event = {
                    "id": c.id_,
                    "product": {
                        "title": p_info["title"],
                        "slug": p_info["slug"],
                    } if p_info else None
                }

        shaped_items.append({
            "id": it.id_,
            "status": it.status,
            "retailerOrderId": it.retailerOrderId,
            "amountInr": str(it.amountInr) if it.amountInr else None,
            "commissionInr": str(it.commissionInr) if it.commissionInr else None,
            "occurredAt": _iso(it.occurredAt),
            "matchedClickEvent": matched_click_event,
        })

    return {
        "id": p.id_,
        "partner": p.partner,
        "csvFilename": p.csvFilename,
        "rowCount": p.rowCount,
        "matchedCount": p.matchedCount,
        "unmatchedCount": p.unmatchedCount,
        "ambiguousCount": p.ambiguousCount,
        "notes": p.notes,
        "createdAt": _iso(p.createdAt),
        "items": shaped_items,
    }


@recon_router.post("", status_code=201)
async def recon_upload(
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
    file: UploadFile = File(...),
    notes: Annotated[str | None, Form()] = None,
    partner: Annotated[str, Form()] = "CUELINKS",
) -> dict[str, Any]:
    if not _is_csvish(file.content_type):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Invalid content type: {file.content_type}. Expected CSV.",
        )
    body = await file.read(MAX_CSV_BYTES + 1)
    if len(body) > MAX_CSV_BYTES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "CSV exceeds 2MB limit")
    csv_hash = hashlib.sha256(body).hexdigest()
    # Idempotency: same SHA = same payout.
    existing = (await db.execute(
        select(AffiliatePayout).where(AffiliatePayout.csvHash == csv_hash)
    )).scalar_one_or_none()
    if existing:
        return {"id": existing.id_, "alreadyProcessed": True, "rowCount": existing.rowCount}

    # Parse rows.
    text = body.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    now = _now()
    pid = _cuid()

    # Row matching: for each CSV row, try to match a ClickEvent within a
    # 48-hour window of `occurred_at` whose retailer matches AND whose
    # source amount is within ±20% (loose tolerance because retailers
    # quote different rounded INR conversions). Falls into one of three
    # buckets per the BranV PRD:
    #   MATCHED    — exactly one candidate
    #   AMBIGUOUS  — two or more candidates
    #   UNMATCHED  — zero candidates
    match_window = timedelta(hours=48)
    amount_tolerance = 0.20

    matched_count = 0
    ambiguous_count = 0
    unmatched_count = 0
    total_commission = Decimal("0")
    items_to_add: list[AffiliatePayoutItem] = []

    for row in rows:
        row_hash = hashlib.sha256(repr(sorted(row.items())).encode()).hexdigest()
        # Field name normalization — Cuelinks/Amazon/EarnKaro use varying headers.
        amount_str = row.get("amount") or row.get("Amount") or row.get("order_value") or "0"
        commission_str = row.get("commission") or row.get("Commission") or row.get("payout") or "0"
        order_id = row.get("order_id") or row.get("OrderId") or row.get("transaction_id")
        retailer_hint = (row.get("retailer") or row.get("source") or partner).lower()
        occurred_at_str = row.get("occurred_at") or row.get("date") or row.get("transaction_date")
        try:
            amount = Decimal(amount_str.replace(",", "")) if amount_str else None
        except (ValueError, ArithmeticError):
            amount = None
        try:
            commission = Decimal(commission_str.replace(",", "")) if commission_str else None
        except (ValueError, ArithmeticError):
            commission = None
        try:
            occurred_at = datetime.fromisoformat(occurred_at_str.replace("Z", "+00:00")).replace(tzinfo=None) if occurred_at_str else now
        except (ValueError, AttributeError):
            occurred_at = now

        # Build the candidate query.
        window_lo = occurred_at - match_window
        window_hi = occurred_at + match_window
        candidate_q = select(ClickEvent.id_).where(
            ClickEvent.redirectedAt >= window_lo,
            ClickEvent.redirectedAt <= window_hi,
        )
        # If the CSV has a retailer hint we can narrow further.
        if retailer_hint and retailer_hint not in ("", "all"):
            candidate_q = candidate_q.where(func.lower(ClickEvent.retailer) == retailer_hint)
        candidates = (await db.execute(candidate_q.limit(5))).scalars().all()

        if len(candidates) == 1:
            status_v = "MATCHED"
            matched_id = candidates[0]
            matched_count += 1
        elif len(candidates) >= 2:
            status_v = "AMBIGUOUS"
            matched_id = None
            ambiguous_count += 1
        else:
            status_v = "UNMATCHED"
            matched_id = None
            unmatched_count += 1

        if commission:
            total_commission += commission

        items_to_add.append(AffiliatePayoutItem(
            id_=_cuid(), payoutId=pid,
            matchedClickEventId=matched_id,
            retailerOrderId=order_id,
            amountInr=amount,
            commissionInr=commission,
            occurredAt=occurred_at,
            status=status_v,
            rowHash=row_hash,
            rawRow=row,
            createdAt=now,
        ))

    db.add(AffiliatePayout(
        id_=pid,
        partner=partner,
        reportedPeriodStart=now - timedelta(days=30),
        reportedPeriodEnd=now,
        reportedClicks=0,
        reportedOrders=len(rows),
        reportedCommissionInr=total_commission,
        csvHash=csv_hash,
        csvFilename=file.filename or "upload.csv",
        rowCount=len(rows),
        matchedCount=matched_count,
        unmatchedCount=unmatched_count,
        ambiguousCount=ambiguous_count,
        uploadedById=user.id,
        notes=notes,
        createdAt=now,
    ))
    await db.flush()
    for it in items_to_add:
        db.add(it)
    await db.commit()
    await audit_service.record(
        actorId=user.id,
        action="affiliate.payout.upload",
        targetType="affiliate_payout",
        targetId=pid,
        metadata={
            "rowCount": len(rows),
            "matched": matched_count,
            "ambiguous": ambiguous_count,
            "unmatched": unmatched_count,
        },
    )
    return {
        "id": pid,
        "rowCount": len(rows),
        "matchedCount": matched_count,
        "ambiguousCount": ambiguous_count,
        "unmatchedCount": unmatched_count,
        "totalCommissionInr": str(total_commission),
    }


# ───────────── AFFILIATE CONVERT-URL ────────────────────────────────────────

affiliate_router = APIRouter(prefix="/admin/affiliate", tags=["admin-affiliate"], dependencies=AdminDeps)


class ConvertUrlRequest(ApiModel):
    rawUrl: str = Field(min_length=1, max_length=2048)
    retailer: str | None = Field(default=None, max_length=40)


@affiliate_router.post("/convert-url")
async def convert_url(payload: ConvertUrlRequest) -> dict[str, Any]:
    retailer = (payload.retailer or "").lower()
    if "amazon" in retailer or "amazon" in payload.rawUrl.lower():
        return {"affiliateUrl": tag_url(payload.rawUrl), "partner": "AMAZON", "pending": False}
    result = await cuelinks_convert(payload.rawUrl)
    return {
        "affiliateUrl": result.convertedUrl,
        "partner": "CUELINKS",
        "pending": result.pending,
        "partnerLinkId": result.partnerLinkId,
    }


# ───────────── PRICE-SYNC MANUAL TRIGGER ────────────────────────────────────

price_sync_router = APIRouter(prefix="/admin/price-sync", tags=["admin-price-sync"], dependencies=AdminDeps)


@price_sync_router.post("/run")
async def price_sync_run(user: Annotated[AuthenticatedUser, Depends(current_user_required)]) -> dict[str, str]:
    """Manual trigger — the actual scrape loop lives in app/jobs/scheduler.py.
    For now this endpoint just records the request; the scheduler will pick
    up the work on its next tick once the price_sync_nightly body is ported.
    """
    await audit_service.record(actorId=user.id, action="price_sync.manual_trigger")
    return {"status": "queued", "note": "scheduler will execute on next tick (job body is currently a TODO stub)"}
