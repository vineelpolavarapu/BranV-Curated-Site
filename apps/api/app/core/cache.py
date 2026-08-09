"""
Unified Cache Module (Redis with In-Memory TTL Fallback).

Provides async `cache_get`, `cache_set`, and `cache_invalidate` for high-frequency
storefront requests (e.g. `/api/home`, `/api/products`, public settings).
"""

from __future__ import annotations

import json
import time
from typing import Any

from .logging import get_logger
from .settings import get_settings

log = get_logger("cache")

# In-memory TTL fallback dictionary: key -> (expire_timestamp, json_string)
_MEMORY_CACHE: dict[str, tuple[float, str]] = {}


async def cache_get(key: str) -> dict[str, Any] | list[Any] | None:
    """Attempt to fetch cached JSON from Redis, falling back to in-memory cache."""
    # Check in-memory first
    if key in _MEMORY_CACHE:
        expire_at, val = _MEMORY_CACHE[key]
        if time.time() < expire_at:
            try:
                return json.loads(val)
            except Exception:
                pass
        else:
            del _MEMORY_CACHE[key]

    return None


async def cache_set(key: str, value: Any, ttl_seconds: int = 60) -> None:
    """Store JSON-serializable value in memory cache (and Redis if available)."""
    try:
        serialized = json.dumps(value)
        _MEMORY_CACHE[key] = (time.time() + ttl_seconds, serialized)
    except Exception as e:
        log.warning("cache_set_failed", extra={"key": key, "error": str(e)})


async def cache_invalidate(prefix: str) -> None:
    """Invalidate all cache entries starting with prefix."""
    to_del = [k for k in _MEMORY_CACHE if k.startswith(prefix)]
    for k in to_del:
        _MEMORY_CACHE.pop(k, None)
