"""
Exception handlers - reproduce NestJS's error-response shapes byte-for-byte.

NestJS's `ValidationPipe` (with `whitelist + transform + forbidNonWhitelisted`) and
default `HttpException` filter both emit `{statusCode, message, error}` payloads:

    400:  {"statusCode":400, "message":[ "<field> must be ...", ... ], "error":"Bad Request"}
    401:  {"statusCode":401, "message":"Unauthorized", "error":"Unauthorized"}
    403:  {"statusCode":403, "message":"Forbidden", "error":"Forbidden"}
    404:  {"statusCode":404, "message":"Cannot GET /missing", "error":"Not Found"}
    422:  {"statusCode":422, "message":"...", "error":"Unprocessable Entity"}
    429:  {"statusCode":429, "message":"Too many requests", "retryAfterSeconds":N}
    500:  {"statusCode":500, "message":"Internal server error"}

These handlers normalize FastAPI's defaults (which return `{"detail": ...}`) to
the Nest shapes so the parity test harness diffs zero.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .logging import get_logger
from .settings import get_settings

log = get_logger("exception_handlers")


def _with_cors(request: Request, response: JSONResponse) -> JSONResponse:
    """Echo the CORS headers onto a response.

    Starlette handles bare-``Exception`` (500) responses in its outermost
    ServerErrorMiddleware, which sits ABOVE CORSMiddleware - so those 500s
    ship without an ``Access-Control-Allow-Origin`` header and the browser
    masks the real error as an opaque "CORS error". Re-add the header here
    (mirroring the CORS middleware's allow-list) so genuine server errors
    surface as 500s in the browser instead of misleading CORS failures.
    """
    origin = request.headers.get("origin")
    if origin and origin == get_settings().WEB_ORIGIN:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


def _http_status_label(code: int) -> str:
    try:
        return HTTPStatus(code).phrase
    except ValueError:
        return "Error"


async def request_validation_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Nest's ValidationPipe emits a flat list of human-readable messages.
    # Pydantic gives us a list of dicts; flatten to one string per field error.
    messages: list[str] = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err.get("loc", []) if p not in ("body", "query", "path"))
        msg = err.get("msg", "invalid value")
        messages.append(f"{loc}: {msg}" if loc else msg)

    body: dict[str, Any] = {
        "statusCode": status.HTTP_400_BAD_REQUEST,
        "message": messages,
        "error": "Bad Request",
    }
    return JSONResponse(status_code=400, content=body)


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    # NestJS HttpException(payload, status) preserves the payload as-is when
    # it's a dict. We mirror: dict detail → use as body; string detail → wrap.
    detail = exc.detail
    if isinstance(detail, dict):
        body = {"statusCode": exc.status_code, **detail}
        body.setdefault("error", _http_status_label(exc.status_code))
    else:
        body = {
            "statusCode": exc.status_code,
            "message": detail,
            "error": _http_status_label(exc.status_code),
        }
    headers = exc.headers or None
    return JSONResponse(status_code=exc.status_code, content=body, headers=headers)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled_exception", path=str(request.url), error=str(exc))
    body = {
        "statusCode": 500,
        "message": "Internal server error",
        "error": "Internal Server Error",
    }
    return _with_cors(request, JSONResponse(status_code=500, content=body))


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, request_validation_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
