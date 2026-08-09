"""
CorrelationIdMiddleware - equivalent of NestJS's CorrelationIdMiddleware.

Reads the incoming `X-Request-Id` header (or generates a UUID4 if absent),
binds it to structlog's contextvars so every log line in the request carries it,
and echoes it back on the response.
"""

from __future__ import annotations

import uuid
from typing import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "x-request-id"


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming if incoming else str(uuid.uuid4())
        # Mirror Nest by exposing on request.state so downstream handlers can read it.
        request.state.request_id = request_id

        structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            response = await call_next(request)
        finally:
            structlog.contextvars.unbind_contextvars("request_id")

        response.headers[REQUEST_ID_HEADER] = request_id
        return response
