"""
APScheduler async + PG advisory-lock leader gating.

Five crons port the NestJS @Cron decorators in apps/api:
  * articles_publisher       — every minute
  * notifications_dispatcher — every 10s
  * analytics_rollup         — hourly at :00
  * affiliate_retry          — every 10 minutes
  * price_sync_nightly       — daily at 03:00 UTC

Each job is wrapped in `with_advisory_lock(name)` which calls
`pg_try_advisory_lock(hash(name))`. If the lock is not free (another instance
or the NestJS scheduler is currently running it), the tick is skipped.

Belt-and-braces second gate: settings.SCHEDULER_OWNER must equal `'fastapi'`
or the entire scheduler refuses to register jobs. Operators flip
SCHEDULER_OWNER=fastapi on the Python service and SCHEDULER_OWNER=none on the
NestJS service to coordinate the handover.
"""

from __future__ import annotations

import hashlib
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text

from ..core.logging import get_logger
from ..core.settings import get_settings
from ..db.session import get_engine

log = get_logger("scheduler")

_scheduler: AsyncIOScheduler | None = None


def _lock_key(name: str) -> int:
    """Stable 63-bit lock id derived from the job name."""
    digest = hashlib.sha256(name.encode()).digest()
    return int.from_bytes(digest[:8], "big") & 0x7FFFFFFFFFFFFFFF


@asynccontextmanager
async def with_advisory_lock(name: str):
    """Acquire pg_try_advisory_lock; yield True if held, False if not."""
    key = _lock_key(name)
    engine = get_engine()
    async with engine.connect() as conn:
        acquired = (await conn.execute(
            text("SELECT pg_try_advisory_lock(:k)"), {"k": key}
        )).scalar()
        try:
            yield bool(acquired)
        finally:
            if acquired:
                await conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})


async def _wrap(name: str, fn) -> None:
    async with with_advisory_lock(name) as held:
        if not held:
            log.debug("scheduler_tick_skipped_lock_held", job=name)
            return
        try:
            await fn()
        except Exception as e:  # noqa: BLE001
            log.exception("scheduler_tick_failed", job=name, error=str(e))


# ───────────── job bodies ──────────────────────────────────────────────────


async def articles_publisher() -> None:
    """Publish any articles with status=SCHEDULED and scheduledAt<=now()."""
    from datetime import datetime, timezone
    from sqlalchemy import update
    from ..db.models import Article
    from ..db.session import get_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    engine = get_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    async with Session() as db:
        result = await db.execute(
            update(Article)
            .where(Article.status == "SCHEDULED", Article.scheduledAt <= now)
            .values(status="PUBLISHED", publishedAt=now, updatedAt=now)
        )
        await db.commit()
        if result.rowcount:
            log.info("articles_publisher.published", count=result.rowcount)


async def notifications_dispatcher() -> None:
    """Drain notification_outbox 25 rows at a time. Best-effort delivery."""
    from datetime import datetime, timezone
    from sqlalchemy import and_, select, update
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from ..db.models import Notification, NotificationOutbox
    from ..db.session import get_engine
    from ..integrations.mail import get_mail_service
    import secrets, string

    engine = get_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    alphabet = string.ascii_lowercase + string.digits

    async with Session() as db:
        rows = (await db.execute(
            select(NotificationOutbox)
            .where(
                NotificationOutbox.status == "PENDING",
                and_(
                    (NotificationOutbox.scheduledFor.is_(None))
                    | (NotificationOutbox.scheduledFor <= now)
                ),
            )
            .order_by(NotificationOutbox.createdAt.asc())
            .limit(25)
        )).scalars().all()
        if not rows:
            return
        mail = get_mail_service()
        for row in rows:
            try:
                if row.channel == "EMAIL" and row.email:
                    from ..integrations.mail import MailMessage
                    payload = row.payload or {}
                    await mail.send(MailMessage(
                        to=row.email,
                        subject=payload.get("subject", "BranV update"),
                        text=payload.get("text", ""),
                    ))
                if row.channel == "IN_APP" and row.userId:
                    # Materialize an in-app Notification row.
                    nid = "c" + "".join(secrets.choice(alphabet) for _ in range(24))
                    db.add(Notification(
                        id_=nid,
                        userId=row.userId,
                        type=row.type,
                        channel="IN_APP",
                        payload=row.payload,
                        sentAt=now,
                        createdAt=now,
                        updatedAt=now,
                    ))
                await db.execute(
                    update(NotificationOutbox)
                    .where(NotificationOutbox.id_ == row.id_)
                    .values(status="DISPATCHED", dispatchedAt=now, updatedAt=now)
                )
            except Exception as e:  # noqa: BLE001
                attempts = (row.attempts or 0) + 1
                # Exponential backoff: next attempt 2^attempts minutes out, capped at 1h.
                from datetime import timedelta
                backoff = min(60, 2 ** min(attempts, 6))
                await db.execute(
                    update(NotificationOutbox)
                    .where(NotificationOutbox.id_ == row.id_)
                    .values(
                        attempts=attempts,
                        lastError=str(e)[:500],
                        scheduledFor=now + timedelta(minutes=backoff),
                        updatedAt=now,
                    )
                )
                log.warning("outbox_dispatch_failed", id=row.id_, attempts=attempts, error=str(e))
        await db.commit()
        log.info("notifications_dispatcher.drained", count=len(rows))


async def analytics_rollup() -> None:
    """Rebuild analytics_daily_clicks + analytics_daily_conversions for last 30 days."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import text as sql_text
    from ..db.session import get_engine

    engine = get_engine()
    today = datetime.now(timezone.utc).date()
    cutoff = today - timedelta(days=30)
    async with engine.begin() as conn:
        # Daily clicks rollup.
        await conn.execute(sql_text("""
            DELETE FROM analytics_daily_clicks WHERE day >= :cutoff
        """), {"cutoff": cutoff})
        await conn.execute(sql_text("""
            INSERT INTO analytics_daily_clicks (day, "productId", retailer, clicks, "uniqueUsers", "updatedAt")
            SELECT
                date_trunc('day', "redirectedAt")::date AS day,
                "productId",
                retailer,
                count(*) AS clicks,
                count(DISTINCT "userId") FILTER (WHERE "userId" IS NOT NULL) AS unique_users,
                now() AS updated_at
            FROM click_events
            WHERE "redirectedAt" >= :cutoff
            GROUP BY 1, 2, 3
            ON CONFLICT (day, "productId", retailer) DO UPDATE
              SET clicks = EXCLUDED.clicks,
                  "uniqueUsers" = EXCLUDED."uniqueUsers",
                  "updatedAt" = EXCLUDED."updatedAt"
        """), {"cutoff": cutoff})
        # Daily conversions rollup (self-reported outcomes only — affiliate
        # reconciliation feeds reconciled_commission on a separate pass).
        await conn.execute(sql_text("""
            DELETE FROM analytics_daily_conversions WHERE day >= :cutoff
        """), {"cutoff": cutoff})
        await conn.execute(sql_text("""
            INSERT INTO analytics_daily_conversions
              (day, "productId", "selfReportedPurchases", "selfReportedBrowsing",
               "selfReportedNeedsHelp", "estimatedCommissionInr",
               "reconciledCommissionInr", "updatedAt")
            SELECT
              date_trunc('day', src."reportedAt")::date AS day,
              ce."productId" AS product_id,
              count(*) FILTER (WHERE src.outcome = 'PURCHASED'),
              count(*) FILTER (WHERE src.outcome = 'BROWSING'),
              count(*) FILTER (WHERE src.outcome = 'NEEDS_HELP'),
              0::numeric,
              0::numeric,
              now()
            FROM self_reported_conversions src
            JOIN click_events ce ON ce.id = src."clickEventId"
            WHERE src."reportedAt" >= :cutoff
            GROUP BY 1, 2
            ON CONFLICT (day, "productId") DO UPDATE
              SET "selfReportedPurchases" = EXCLUDED."selfReportedPurchases",
                  "selfReportedBrowsing"  = EXCLUDED."selfReportedBrowsing",
                  "selfReportedNeedsHelp" = EXCLUDED."selfReportedNeedsHelp",
                  "updatedAt"             = EXCLUDED."updatedAt"
        """), {"cutoff": cutoff})
    log.info("analytics_rollup.completed", days=30)


async def affiliate_retry() -> None:
    """Retry up to 50 affiliate_links with pendingConversion=true."""
    from datetime import datetime, timezone
    from sqlalchemy import select, update
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from ..db.models import AffiliateLink, ProductRetailerListing
    from ..db.session import get_engine
    from ..integrations.cuelinks import convert_url as cuelinks_convert

    engine = get_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    async with Session() as db:
        rows = (await db.execute(
            select(AffiliateLink, ProductRetailerListing.retailerProductUrl)
            .join(ProductRetailerListing, ProductRetailerListing.id_ == AffiliateLink.productRetailerListingId)
            .where(AffiliateLink.pendingConversion.is_(True))
            .limit(50)
        )).all()
        if not rows:
            return
        success = 0
        for link, raw_url in rows:
            if link.partner != "CUELINKS":
                continue  # Amazon is direct, EarnKaro not yet ported
            result = await cuelinks_convert(raw_url)
            if result.pending:
                continue
            await db.execute(
                update(AffiliateLink)
                .where(AffiliateLink.id_ == link.id_)
                .values(
                    convertedUrl=result.convertedUrl,
                    partnerLinkId=result.partnerLinkId,
                    pendingConversion=False,
                    lastValidatedAt=now,
                    lastError=None,
                    updatedAt=now,
                )
            )
            success += 1
        await db.commit()
        log.info("affiliate_retry.processed", total=len(rows), succeeded=success)


async def price_sync_nightly() -> None:
    """Re-scrape every ACTIVE retailer listing, update price, fire drop notifs.

    Concurrency capped at 2 per retailer to be polite. Drift threshold lives
    in platform_settings.PRICE_SYNC_DRIFT_THRESHOLD_PCT (default 5 %)."""
    import asyncio
    import secrets, string
    from datetime import datetime, timezone
    from decimal import Decimal
    from sqlalchemy import select, update
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from ..db.models import (
        NotificationOutbox,
        Product,
        ProductRetailerListing,
        WishlistItem,
    )
    from ..db.session import get_engine
    from ..integrations.scraper import scrape_product_url

    engine = get_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    alphabet = string.ascii_lowercase + string.digits

    async with Session() as db:
        listings = (await db.execute(
            select(ProductRetailerListing)
            .where(ProductRetailerListing.availabilityStatus == "IN_STOCK")
        )).scalars().all()
        if not listings:
            return

        sem = asyncio.Semaphore(2)
        drift_threshold = 5.0  # TODO: load from PlatformSetting cache

        async def scrape_one(listing: ProductRetailerListing) -> tuple[ProductRetailerListing, float | None, str | None]:
            async with sem:
                try:
                    result = await scrape_product_url(listing.retailerProductUrl)
                    return listing, result.price, None
                except Exception as e:  # noqa: BLE001
                    return listing, None, str(e)

        results = await asyncio.gather(*(scrape_one(l) for l in listings))
        drops = 0
        failed = 0
        for listing, new_price, err in results:
            if err is not None or new_price is None:
                failed += 1
                await db.execute(
                    update(ProductRetailerListing)
                    .where(ProductRetailerListing.id_ == listing.id_)
                    .values(
                        syncFailedCount=(listing.syncFailedCount or 0) + 1,
                        syncFailedSince=listing.syncFailedSince or now,
                        updatedAt=now,
                    )
                )
                continue
            old_price = float(listing.rawPrice) if listing.rawPrice else None
            await db.execute(
                update(ProductRetailerListing)
                .where(ProductRetailerListing.id_ == listing.id_)
                .values(
                    rawPrice=Decimal(str(new_price)),
                    lastSyncedAt=now,
                    syncFailedCount=0,
                    syncFailedSince=None,
                    updatedAt=now,
                )
            )
            if old_price and new_price < old_price:
                drop_pct = (old_price - new_price) / old_price * 100
                if drop_pct >= drift_threshold:
                    # Fan-out price-drop notifications to wishlisters opted-in.
                    wishers = (await db.execute(
                        select(WishlistItem.userId).where(
                            WishlistItem.productId == listing.productId,
                            WishlistItem.notifyOnPriceDrop.is_(True),
                        )
                    )).scalars().all()
                    for uid in wishers:
                        db.add(NotificationOutbox(
                            id_="c" + "".join(secrets.choice(alphabet) for _ in range(24)),
                            userId=uid,
                            email=None,
                            type="WISHLIST_PRICE_DROP",
                            channel="IN_APP",
                            payload={
                                "productId": listing.productId,
                                "retailer": listing.retailer,
                                "oldPrice": old_price,
                                "newPrice": new_price,
                                "dropPct": round(drop_pct, 2),
                            },
                            status="PENDING",
                            attempts=0,
                            createdAt=now,
                            updatedAt=now,
                        ))
                    drops += len(wishers)
        await db.commit()
        log.info("price_sync.completed", scraped=len(listings), failed=failed, drop_notifs=drops)


JOBS = [
    ("articles_publisher", CronTrigger(minute="*"), articles_publisher),
    ("notifications_dispatcher", IntervalTrigger(seconds=10), notifications_dispatcher),
    ("analytics_rollup", CronTrigger(minute=0), analytics_rollup),
    ("affiliate_retry", CronTrigger(minute="*/10"), affiliate_retry),
    ("price_sync_nightly", CronTrigger(hour=3, minute=0), price_sync_nightly),
]


def start_scheduler() -> None:
    """Register jobs IFF SCHEDULER_OWNER == 'fastapi'. Idempotent."""
    global _scheduler
    s = get_settings()
    if s.SCHEDULER_OWNER != "fastapi":
        log.info("scheduler_disabled", reason=f"SCHEDULER_OWNER={s.SCHEDULER_OWNER!r}")
        return
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    for name, trigger, fn in JOBS:
        _scheduler.add_job(_wrap, trigger, args=[f"branv:{name}", fn], id=name, replace_existing=True)
    _scheduler.start()
    log.info("scheduler_started", jobs=[j[0] for j in JOBS])


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("scheduler_stopped")
