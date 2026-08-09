"""
structlog configuration - mirrors NestJS's pino setup:
  - JSON output in production, pretty console in dev
  - Redacts `authorization` and `cookie` headers
  - Binds the per-request correlation id (set by CorrelationIdMiddleware) into every event
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from .settings import get_settings


_REDACT_VALUE = "[redacted]"
_REDACT_KEYS = {"authorization", "cookie"}


def _redact_headers(_: Any, __: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    """Replace sensitive header values regardless of where they appear in the event."""
    if "headers" in event_dict and isinstance(event_dict["headers"], dict):
        headers = dict(event_dict["headers"])
        for k in list(headers.keys()):
            if k.lower() in _REDACT_KEYS:
                headers[k] = _REDACT_VALUE
        event_dict["headers"] = headers
    return event_dict


def configure_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.PY_LOG_LEVEL.upper(), logging.INFO)

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _redact_headers,
    ]

    if settings.NODE_ENV == "production":
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
