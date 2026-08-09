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
