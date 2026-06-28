"""
Click tracking — port of apps/api/src/clicks/clicks.service.ts.

Flow:
  1. POST /api/clicks/track → mint a tracking_id, store ClickIntent.
  2. GET  /go/{tracking_id} → consume intent, write ClickEvent, 302 to affiliate URL.
  3. POST /api/clicks/{tracking_id}/report → record SelfReportedConversion;
     auto-insert WardrobeItem if outcome=PURCHASED and the caller is signed in.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import (
    AffiliateLink,
    ClickEvent,
    ClickIntent,
    ProductRetailerListing,
    SelfReportedConversion,
    WardrobeItem,
)

TRACK_TTL_SECONDS = 60 * 60  # 1 hour

_CUID_ALPHABET = string.ascii_lowercase + string.digits
_NANOID_ALPHABET = string.ascii_letters + string.digits + "_-"


def _cuid() -> str:
    return "c" + "".join(secrets.choice(_CUID_ALPHABET) for _ in range(24))


def _nanoid(n: int = 16) -> str:
    return "".join(secrets.choice(_NANOID_ALPHABET) for _ in range(n))


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def mint_from_product(
    db: AsyncSession, *, product_id: str, retailer: str, source_page_url: str | None
) -> str | None:
    """Mint a tracking_id for the most recent in-stock listing of (product, retailer).
    Returns None if no in-stock listing exists (caller falls back to raw URL).
    """
    listing = (await db.execute(
        select(ProductRetailerListing).where(
            and_(
                ProductRetailerListing.productId == product_id,
                ProductRetailerListing.retailer == retailer,
                ProductRetailerListing.availabilityStatus == "IN_STOCK",
            )
        )
    )).scalar_one_or_none()
    if listing is None:
        return None

    affiliate = (await db.execute(
        select(AffiliateLink)
        .where(
            AffiliateLink.productRetailerListingId == listing.id_,
            AffiliateLink.pendingConversion.is_(False),
        )
        .order_by(desc(AffiliateLink.createdAt))
        .limit(1)
    )).scalar_one_or_none()
    partner_url = (affiliate.convertedUrl if affiliate else None) or listing.retailerProductUrl

    tracking_id = _nanoid(16)
    now = _now()
    db.add(
        ClickIntent(
            trackingId=tracking_id,
            productId=product_id,
            retailer=retailer,
            partner=affiliate.partner if affiliate else None,
            partnerUrl=partner_url,
            sourcePageUrl=source_page_url,
            expiresAt=now + timedelta(seconds=TRACK_TTL_SECONDS),
            createdAt=now,
        )
    )
    await db.commit()
    return tracking_id


class TrackingGone(Exception):
    pass


async def consume_redirect(
    db: AsyncSession,
    *,
    tracking_id: str,
    user_id: str | None,
    session_id: str | None,
    user_agent: str | None,
    ip_country: str | None,
    utm: dict[str, str] | None,
) -> str:
    intent = (await db.execute(
        select(ClickIntent).where(ClickIntent.trackingId == tracking_id)
    )).scalar_one_or_none()
    now = _now()
    if intent is None or intent.expiresAt < now:
        raise TrackingGone("Tracking link expired or invalid")

    db.add(
        ClickEvent(
            id_=_cuid(),
            trackingId=tracking_id,
            productId=intent.productId,
            retailer=intent.retailer,
            partner=intent.partner,
            partnerUrl=intent.partnerUrl,
            sourcePageUrl=intent.sourcePageUrl,
            userId=user_id,
            sessionId=session_id,
            userAgent=user_agent,
            ipCountry=ip_country,
            utm=utm,
            redirectedAt=now,
            createdAt=now,
        )
    )
    await db.execute(delete(ClickIntent).where(ClickIntent.trackingId == tracking_id))
    await db.commit()
    return intent.partnerUrl


async def report_outcome(
    db: AsyncSession, *, tracking_id: str, outcome: str, user_id: str | None
) -> None:
    event = (await db.execute(
        select(ClickEvent).where(ClickEvent.trackingId == tracking_id)
    )).scalar_one_or_none()
    if event is None:
        return  # silent — matches Nest's behavior (event may have been GC'd)

    now = _now()
    db.add(
        SelfReportedConversion(
            id_=_cuid(),
            clickEventId=event.id_,
            userId=user_id,
            outcome=outcome,
            reportedAt=now,
            createdAt=now,
        )
    )

    # Auto-insert into wardrobe on PURCHASED if authenticated.
    if outcome == "PURCHASED" and user_id:
        existing = (await db.execute(
            select(WardrobeItem.id_).where(
                WardrobeItem.userId == user_id, WardrobeItem.productId == event.productId
            )
        )).scalar_one_or_none()
        if existing is None:
            db.add(
                WardrobeItem(
                    id_=_cuid(),
                    userId=user_id,
                    productId=event.productId,
                    retailer=event.retailer,
                    clickEventId=event.id_,
                    selfReportedPrice=None,
                    selfReportedDate=now,
                    notes=None,
                    tags=[],
                    createdAt=now,
                    updatedAt=now,
                )
            )
    await db.commit()
