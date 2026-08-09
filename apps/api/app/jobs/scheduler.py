"""APScheduler async jobs runner for BranV API.

Runs ONLY when SCHEDULER_OWNER == "fastapi" to satisfy the single-runner rule.
PG advisory lock guarantees only one FastAPI worker executes each job tick.
"""

from __future__ import annotations

import logging
import typing
from typing import Any, Callable, Coroutine

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from ..core.settings import get_settings

if typing.TYPE_CHECKING:
    from apscheduler.triggers.base import BaseTrigger

log = logging.getLogger("branv.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _wrap(job_name: str, fn: Callable[[], Coroutine[Any, Any, None]]) -> None:
    """Acquire a Postgres advisory lock by job name, execute `fn`, release lock.

    If another worker already holds the lock, skip execution silently.
    """
    import zlib
    from sqlalchemy import text
    from ..db.session import get_engine

    lock_id = zlib.crc32(job_name.encode("utf-8")) & 0x7FFFFFFF
    engine = get_engine()
    async with engine.begin() as conn:
        res = await conn.execute(text(f"SELECT pg_try_advisory_xact_lock({lock_id})"))
        locked = res.scalar_one()
        if not locked:
            log.debug("job_skipped.lock_busy", job=job_name)
            return
        log.info("job_executing", job=job_name)
        try:
            await fn()
        except Exception:
            log.exception("job_failed", job=job_name)


async def articles_publisher() -> None:
    """Flip SCHEDULED articles to PUBLISHED once their scheduled_at has arrived."""
    from datetime import datetime, timezone
    from sqlalchemy import update
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from ..db.models import Article
    from ..db.session import get_engine

    engine = get_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    async with Session() as db:
        res = await db.execute(
            update(Article)
            .where(
                Article.status == "SCHEDULED",
                Article.scheduledAt.is_not(None),
                Article.scheduledAt <= now,
            )
            .values(status="PUBLISHED", publishedAt=now, updatedAt=now)
        )
        await db.commit()
        if res.rowcount > 0:
            log.info("articles_published", count=res.rowcount)


async def notifications_dispatcher() -> None:
    """Drain up to 50 PENDING notifications per tick."""
    from datetime import datetime, timezone
    from sqlalchemy import select, update
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from ..db.models import NotificationOutbox
    from ..db.session import get_engine
    from ..integrations.mail import send_email

    engine = get_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    async with Session() as db:
        items = (await db.execute(
            select(NotificationOutbox)
            .where(NotificationOutbox.status == "PENDING")
            .limit(50)
        )).scalars().all()
        if not items:
            return
        sent = 0
        failed = 0
        for item in items:
            try:
                if item.channel in ("EMAIL", "BOTH") and item.email:
                    subject = item.payload.get("subject", "BranV notification")
                    body = item.payload.get("body", "")
                    await send_email(to=item.email, subject=subject, body=body)
                await db.execute(
                    update(NotificationOutbox)
                    .where(NotificationOutbox.id_ == item.id_)
                    .values(status="SENT", processedAt=now, updatedAt=now)
                )
                sent += 1
            except Exception as e:  # noqa: BLE001
                failed += 1
                attempts = (item.attempts or 0) + 1
                new_status = "FAILED" if attempts >= 3 else "PENDING"
                await db.execute(
                    update(NotificationOutbox)
                    .where(NotificationOutbox.id_ == item.id_)
                    .values(
                        attempts=attempts,
                        lastError=str(e),
                        status=new_status,
                        updatedAt=now,
                    )
                )
        await db.commit()
        log.info("notifications_processed", total=len(items), sent=sent, failed=failed)


async def analytics_rollup() -> None:
    """Aggregate daily clicks/conversions into analytics_daily_clicks/analytics_daily_conversions."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from ..db.session import get_engine

    engine = get_engine()
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now - timedelta(days=30)
    async with Session() as db:
        await db.execute(text("""
            INSERT INTO analytics_daily_clicks (day, "productId", "partnerId", clicks, "uniqueUsers", "createdAt", "updatedAt")
            SELECT 
              date_trunc('day', "redirectedAt")::date AS day,
              "productId",
              partner AS "partnerId",
              count(*) AS clicks,
              count(DISTINCT "userId") FILTER (WHERE "userId" IS NOT NULL) AS "uniqueUsers",
              NOW() AS "createdAt",
              NOW() AS "updatedAt"
            FROM click_events
            WHERE "redirectedAt" >= :cutoff
            GROUP BY 1, 2, 3
            ON CONFLICT (day, "productId", "partnerId") DO UPDATE
              SET clicks = EXCLUDED.clicks,
                  "uniqueUsers" = EXCLUDED."uniqueUsers",
                  "updatedAt" = EXCLUDED."updatedAt"
        """), {"cutoff": cutoff})

        await db.execute(text("""
            INSERT INTO analytics_daily_conversions (day, "productId", "selfReportedPurchases", "selfReportedBrowsing", "selfReportedNeedsHelp", "createdAt", "updatedAt")
            SELECT 
              date_trunc('day', "createdAt")::date AS day,
              "productId",
              count(*) FILTER (WHERE intent = 'PURCHASED') AS "selfReportedPurchases",
              count(*) FILTER (WHERE intent = 'BROWSING') AS "selfReportedBrowsing",
              count(*) FILTER (WHERE intent = 'HELP_NEEDED') AS "selfReportedNeedsHelp",
              NOW() AS "createdAt",
              NOW() AS "updatedAt"
            FROM self_reported_conversions
            WHERE "createdAt" >= :cutoff
            GROUP BY 1, 2
            ON CONFLICT (day, "productId") DO UPDATE
              SET "selfReportedPurchases" = EXCLUDED."selfReportedPurchases",
                  "selfReportedBrowsing"  = EXCLUDED."selfReportedBrowsing",
                  "selfReportedNeedsHelp" = EXCLUDED."selfReportedNeedsHelp",
                  "updatedAt"             = EXCLUDED."updatedAt"
        """), {"cutoff": cutoff})
        await db.commit()
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
                continue
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


JOBS: list[tuple[str, Any, Callable[[], Coroutine[Any, Any, None]]]] = [
    ("articles_publisher", CronTrigger(minute="*"), articles_publisher),
    ("notifications_dispatcher", IntervalTrigger(seconds=10), notifications_dispatcher),
    ("analytics_rollup", CronTrigger(minute=0), analytics_rollup),
    ("affiliate_retry", CronTrigger(minute="*/10"), affiliate_retry),
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
