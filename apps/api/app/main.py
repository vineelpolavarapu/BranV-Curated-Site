"""
FastAPI bootstrap for the BranV Python port.

Parity targets from NestJS `apps/api/src/main.ts`:
  - Global `/api` prefix on every route
  - `GET /go/{tracking_id}` mounted OUTSIDE the `/api` prefix
  - CORS from WEB_ORIGIN, credentials enabled, methods restricted
  - cookie-parser equivalent (FastAPI parses cookies natively via request.cookies)
  - ValidationPipe equivalent (Pydantic v2 with ConfigDict(extra='forbid'))
  - Pino-style logger with redaction (structlog, see core/logging.py)
  - Correlation ID middleware reading + echoing `X-Request-Id`

The real domain routers are imported as each is ported in Step 6.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .jobs.scheduler import start_scheduler, stop_scheduler

from .api.v1 import (
    admin_ops,
    audit,
    auth,
    brands,
    categories,
    clicks,
    clicks_redirect,
    content,
    engagement,
    health,
    products_admin,
    simple_admin,
    storefront,
    uploads,
)
from .core.correlation import CorrelationIdMiddleware
from .core.exception_handlers import register_exception_handlers
from .core.logging import configure_logging, get_logger
from .core.settings import get_settings


@asynccontextmanager
async def _lifespan(_: FastAPI):
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    log = get_logger("bootstrap")

    app = FastAPI(
        title="BranV API (FastAPI port)",
        version="0.1.0",
        docs_url="/docs",
        redoc_url=None,
        lifespan=_lifespan,
    )

    # ---- Middleware (order matters: outer → inner) ----
    # Correlation must wrap CORS so the request_id is bound before CORS handlers run.
    app.add_middleware(CorrelationIdMiddleware)
    web_origins = [origin.strip() for origin in settings.WEB_ORIGIN.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=web_origins if web_origins else [settings.WEB_ORIGIN],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    # ---- Exception handlers - produce Nest-shape error payloads ----
    register_exception_handlers(app)

    # ---- Routers ----
    # Step 2 ships only the cross-cutting routers (health + root-mounted redirect).
    # Step 5 adds auth. Step 6 imports each domain router under /api/* as the port lands.
    app.include_router(health.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    app.include_router(audit.router, prefix="/api")
    app.include_router(uploads.router, prefix="/api")
    app.include_router(brands.admin_router, prefix="/api")
    app.include_router(brands.public_router, prefix="/api")
    app.include_router(categories.admin_router, prefix="/api")
    app.include_router(categories.public_router, prefix="/api")
    app.include_router(storefront.home_router, prefix="/api")
    app.include_router(storefront.products_router, prefix="/api")
    app.include_router(storefront.search_router, prefix="/api")
    app.include_router(clicks.router, prefix="/api")
    app.include_router(engagement.wishlist_router, prefix="/api")
    app.include_router(engagement.wardrobe_router, prefix="/api")
    app.include_router(engagement.reviews_router, prefix="/api")
    app.include_router(engagement.notifications_router, prefix="/api")
    app.include_router(engagement.newsletter_router, prefix="/api")
    # Real admin domain routers (Step 11a port).
    app.include_router(products_admin.router, prefix="/api")
    app.include_router(content.articles_admin_router, prefix="/api")
    app.include_router(content.articles_public_router, prefix="/api")
    app.include_router(content.edits_admin_router, prefix="/api")
    app.include_router(content.edits_public_router, prefix="/api")
    app.include_router(content.lookbooks_admin_router, prefix="/api")
    app.include_router(content.lookbooks_public_router, prefix="/api")
    app.include_router(simple_admin.avatars_router, prefix="/api")
    app.include_router(simple_admin.banners_router, prefix="/api")
    app.include_router(simple_admin.brand_story_admin_router, prefix="/api")
    app.include_router(simple_admin.brand_story_public_router, prefix="/api")
    app.include_router(simple_admin.settings_router, prefix="/api")
    app.include_router(simple_admin.public_settings_router, prefix="/api")
    app.include_router(admin_ops.analytics_router, prefix="/api")
    app.include_router(admin_ops.recon_router, prefix="/api")
    app.include_router(admin_ops.price_sync_router, prefix="/api")
    app.include_router(clicks_redirect.router)  # NO /api prefix - matches Nest exclusion

    log.info(
        "fastapi_booted",
        port=settings.API_INTERNAL_PORT,
        web_origin=settings.WEB_ORIGIN,
        node_env=settings.NODE_ENV,
        scheduler_owner=settings.SCHEDULER_OWNER,
    )
    return app


app = create_app()
