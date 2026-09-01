"""APScheduler async jobs runner for BranV API.

Runs ONLY when SCHEDULER_OWNER == "fastapi" to satisfy the single-runner rule.
PG advisory lock guarantees only one FastAPI worker executes each job tick.
"""

from __future__ import annotations

import typing
from typing import Any, Callable, Coroutine

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from ..core.logging import get_logger
from ..core.settings import get_settings

if typing.TYPE_CHECKING:
    from apscheduler.triggers.base import BaseTrigger

log = get_logger("branv.scheduler")

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
            log.debug("job_skipped.lock_busy", extra={"job": job_name})
            return
        log.info("job_executing", extra={"job": job_name})
        try:
            await fn()
        except Exception:
            log.exception("job_failed", extra={"job": job_name})


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
            log.info("articles_published", extra={"count": res.rowcount})


JOBS: list[tuple[str, Any, Callable[[], Coroutine[Any, Any, None]]]] = [
    ("articles_publisher", CronTrigger(minute="*"), articles_publisher),
]


def start_scheduler() -> None:
    """Register jobs IFF SCHEDULER_OWNER == 'fastapi'. Idempotent."""
    global _scheduler
    s = get_settings()
    if s.SCHEDULER_OWNER != "fastapi":
        log.info("scheduler_disabled", extra={"reason": f"SCHEDULER_OWNER={s.SCHEDULER_OWNER!r}"})
        return
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    for name, trigger, fn in JOBS:
        _scheduler.add_job(_wrap, trigger, args=[f"branv:{name}", fn], id=name, replace_existing=True)
    _scheduler.start()
    log.info("scheduler_started", extra={"jobs": [j[0] for j in JOBS]})


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("scheduler_stopped")
