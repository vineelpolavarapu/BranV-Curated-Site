"""
GET /api/health  → 200 liveness probe.
GET /api/ready   → 200 if DB + S3 reachable, 503 otherwise.

Mirrors `apps/api/src/health/health.{controller,service}.ts` byte-for-byte.
Captured fixture: tests/parity/fixtures/health/*.http.json
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Response, status

from ...core.logging import get_logger
from ...core.settings import get_settings

log = get_logger("health")
router = APIRouter()

# Monotonic anchor for the `uptime` field; matches Node's process.uptime() semantics.
_BOOTED_AT = time.monotonic()


def _now_iso() -> str:
    # Nest emits new Date().toISOString() = '2025-...Z' with millisecond precision.
    # Match that exactly so the parity-test diff stays at zero.
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


@router.get("/health", status_code=200)
async def liveness() -> dict[str, Any]:
    return {
        "status": "ok",
        "uptime": time.monotonic() - _BOOTED_AT,
        "version": "0.1.0",
        "timestamp": _now_iso(),
    }


@router.get("/ready")
async def readiness(response: Response) -> dict[str, Any]:
    settings = get_settings()
    checks: dict[str, dict[str, Any]] = {
        "db": await _check_db(),
        "storage": await _check_s3(settings.S3_BUCKET),
    }
    ok = all(c.get("ok") is True for c in checks.values())
    response.status_code = status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if ok else "not_ready",
        "checks": checks,
        "timestamp": _now_iso(),
    }


@router.get("/scraper-selftest")
async def scraper_selftest(response: Response, token: str = "") -> dict[str, Any]:
    """TEMPORARY diagnostic — proves the deployed scraper works from the VM's IP.

    Token-gated (SCRAPER_SELFTEST_TOKEN) so it isn't a public endpoint. Takes NO
    user URL input — it scrapes a FIXED set of retailer links, so there's no SSRF
    surface. Returns only booleans/counts (never image URLs or secrets). Remove
    after production verification.
    """
    settings = get_settings()
    expected = getattr(settings, "SCRAPER_SELFTEST_TOKEN", "") or ""
    if not expected or token != expected:
        response.status_code = status.HTTP_404_NOT_FOUND
        return {"detail": "Not Found"}

    from ...integrations.scraper import scrape_product_url

    fixed = {
        "amazon_affiliate": "https://link.amazon/B09lgPKwW",
        "amazon_direct": "https://amzn.in/d/0aC2gMj0",
        "flipkart_earnkaro": "https://fktr.in/2rQ04Ew",
        "myntra_direct": "https://www.myntra.com/tshirts/blackberrys/blackberrys-brand-logo-polo-collar-t-shirt/45224312/buy",
        "ajio_direct": "https://www.ajio.com/flying-machine-slim-tapered-whiskered-jeans/p/442821739_indigo",
    }
    results: dict[str, Any] = {}
    for name, url in fixed.items():
        try:
            r = await scrape_product_url(url)
            imgs = len(r.images or [])
            blocked = bool((r.debug or {}).get("blocked"))
            results[name] = {
                "images": imgs,
                "blocked": blocked,
                "has_title": bool(r.title),
                # This is exactly what QuickAddModal:351 checks — false is the good case.
                "modal_would_block": blocked or imgs == 0,
            }
        except Exception as e:  # noqa: BLE001
            results[name] = {"error": type(e).__name__}
    return {
        "firecrawl_configured": bool(settings.FIRECRAWL_API_KEY),
        "managed_scraper_configured": bool(settings.SCRAPER_API_KEY),
        "mock_mode": settings.USE_MOCK_INTEGRATIONS,
        "results": results,
        "timestamp": _now_iso(),
    }


async def _check_db() -> dict[str, Any]:
    # Step 3 wires a real SQLAlchemy ping. Until then, attempt asyncpg connect
    # so /ready means something even pre-ORM. Best-effort - failures are reported,
    # not raised.
    started = time.monotonic()
    try:
        import asyncpg

        settings = get_settings()
        # asyncpg wants "postgresql://"; Prisma uses the same scheme. Strip query string.
        url = settings.DATABASE_URL.split("?")[0]
        conn = await asyncpg.connect(url, timeout=2)
        try:
            await conn.fetchval("SELECT 1")
        finally:
            await conn.close()
        return {"ok": True, "latencyMs": int((time.monotonic() - started) * 1000)}
    except Exception as e:  # noqa: BLE001  parity with Nest's catch-all
        return {"ok": False, "error": str(e)}


async def _check_s3(bucket: str) -> dict[str, Any]:
    started = time.monotonic()
    try:
        import aioboto3

        settings = get_settings()
        session = aioboto3.Session()
        async with session.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
        ) as s3:
            await s3.head_bucket(Bucket=bucket)
        return {"ok": True, "latencyMs": int((time.monotonic() - started) * 1000)}
    except Exception as e:  # noqa: BLE001  parity with Nest's catch-all
        return {"ok": False, "error": str(e)}
