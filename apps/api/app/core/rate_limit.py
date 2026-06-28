"""
In-process fixed-window rate limiter — port of `apps/api/src/common/guards/rate-limit.guard.ts`.

Wire as a FastAPI dependency factory:

    from app.core.rate_limit import rate_limit

    @router.post(
        "/auth/login",
        dependencies=[Depends(rate_limit(limit=5, window=60, prefix='auth-login'))],
    )

Behaviour (parity with Nest):
  * Key: `{prefix}:{ip}:{METHOD:path}`.
  * IP comes from the connection's remote address; `::ffff:` IPv4-mapping prefix stripped.
  * Window is fixed (resets on edge), not sliding.
  * 429 body: `{statusCode: 429, message: 'Too many requests', retryAfterSeconds: N}`
    — exception_handlers.py preserves dict bodies on HTTPException.
  * Bucket map is bounded at 10 000 entries with on-overflow eviction of expired
    buckets (same logic as Nest).
  * No Redis. The dev/prod parity here is "one bucket per process" — same as
    Nest today. If we ever scale horizontally we'll need Redis, but that is a
    deliberate later decision per the playbook's "no new infra" rule.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Lock
from typing import Callable

from fastapi import HTTPException, Request, status

_MAX_BUCKETS = 10_000


@dataclass(slots=True)
class _Bucket:
    count: int
    reset_at_monotonic: float  # seconds since arbitrary epoch — monotonic time


_buckets: dict[str, _Bucket] = {}
_lock = Lock()  # the limiter is sync; guard against rare async-thread reentry


def _client_ip(request: Request) -> str:
    # Honor `X-Forwarded-For` only if the runtime is behind a trusted proxy.
    # For dev parity, mirror Nest which uses req.ip || req.socket.remoteAddress
    # and strips the IPv4-mapped-IPv6 prefix.
    client = request.client
    raw = client.host if client else "unknown"
    if raw.startswith("::ffff:"):
        raw = raw[len("::ffff:"):]
    return raw or "unknown"


def _evict_expired(now: float) -> None:
    expired = [k for k, b in _buckets.items() if b.reset_at_monotonic <= now]
    for k in expired:
        _buckets.pop(k, None)


def rate_limit(*, limit: int, window: int, prefix: str | None = None) -> Callable[[Request], None]:
    """Dependency factory. Returns a callable suitable for `Depends(...)`."""

    def _dep(request: Request) -> None:
        ip = _client_ip(request)
        route = f"{request.method}:{request.url.path}"
        key = f"{prefix or 'global'}:{ip}:{route}"
        now = time.monotonic()
        window_seconds = float(window)

        with _lock:
            bucket = _buckets.get(key)
            if bucket is None or bucket.reset_at_monotonic <= now:
                bucket = _Bucket(count=0, reset_at_monotonic=now + window_seconds)
                _buckets[key] = bucket
                if len(_buckets) > _MAX_BUCKETS:
                    _evict_expired(now)
            bucket.count += 1
            current_count = bucket.count
            reset_at = bucket.reset_at_monotonic

        if current_count > limit:
            retry_after = max(1, int(reset_at - now + 0.999))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": "Too many requests",
                    "retryAfterSeconds": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

    return _dep


def reset_for_tests() -> None:
    """Test helper — clears all buckets so per-test state stays isolated."""
    with _lock:
        _buckets.clear()
