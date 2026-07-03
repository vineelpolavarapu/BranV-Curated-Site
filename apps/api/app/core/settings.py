"""
Pydantic settings — reads the **exact** env var names from `apps/api`'s `.env.example`.

Hard rule from the migration playbook: **no renames**. Every name the NestJS app
already uses must work as-is so dev `.env` files and future deployment secrets
stay portable between the two backends during the parallel-run period.

The only names this Python service introduces:
    SCHEDULER_OWNER (fastapi|nest|none) — playbook §8 leader gate
    PY_LOG_LEVEL                        — structlog level
    API_INTERNAL_PORT                   — uvicorn port (Nest uses API_PORT for 4000)
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Repo-root .env for local dev. In the monorepo layout, this file lives at
# apps/api/app/core/settings.py so parents[4] is the repo root. In the Docker
# container it lives at /app/app/core/settings.py — fewer parents — and env vars
# come from Compose's `environment:` block instead, so falling back to no .env
# file is the correct behavior there.
_parents = Path(__file__).resolve().parents
_ENV_PATH: Path | None = _parents[4] / ".env" if len(_parents) > 4 else None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH) if _ENV_PATH and _ENV_PATH.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # silently ignore Nest-only or future vars
    )

    # ---- Core ----
    NODE_ENV: Literal["development", "production", "test"] = "development"
    API_PORT: int = 4000  # Nest's port; kept for parity, FastAPI uses API_INTERNAL_PORT
    WEB_ORIGIN: str = "http://localhost:3000"
    BASE_CURRENCY: str = "INR"

    # ---- Database ----
    DATABASE_URL: str

    # ---- Auth ----
    JWT_ACCESS_SECRET: str
    JWT_REFRESH_SECRET: str
    JWT_ACCESS_TTL_SECONDS: int = 900
    JWT_REFRESH_TTL_SECONDS: int = 604_800
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: str = ""  # empty means no Domain attribute
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    TOTP_ISSUER: str = "BranV"
    AUTH_LOCKOUT_MAX_ATTEMPTS: int = 5
    AUTH_LOCKOUT_WINDOW_MIN: int = 15
    AUTH_LOCKOUT_DURATION_MIN: int = 15
    AUTH_RATE_LIMIT_PER_MIN: int = 5

    # ---- Object storage (S3 / MinIO) ----
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_REGION: str = "us-east-1"
    S3_BUCKET: str = "branv-dev"
    S3_ACCESS_KEY: str = "branv"
    S3_SECRET_KEY: str = "branv-secret"
    S3_FORCE_PATH_STYLE: bool = True

    # ---- Integrations ----
    USE_MOCK_INTEGRATIONS: bool = True
    CUELINKS_API_KEY: str = ""
    CUELINKS_API_BASE: str = "https://www.cuelinks.com/api/v2"
    AMAZON_ASSOCIATES_TAG: str = "branv-21"
    AMAZON_ACCESS_KEY: str = ""
    AMAZON_SECRET_KEY: str = ""
    AMAZON_REGION: str = "IN"
    EARNKARO_API_KEY: str = ""
    MAIL_PROVIDER: str = "resend"
    MAIL_API_KEY: str = ""
    MAIL_FROM: str = "hello@branv.local"

    # ---- Sync tuning ----
    PRICE_SYNC_DRIFT_THRESHOLD_PCT: int = 5
    SCRAPER_USER_AGENT: str = (
        "Mozilla/5.0 (compatible; BranVBot/1.0; +https://branv.local/bot)"
    )

    # ---- Python-service-only (no Nest equivalent) ----
    SCHEDULER_OWNER: Literal["fastapi", "nest", "none"] = "none"
    PY_LOG_LEVEL: Literal["debug", "info", "warning", "error"] = "info"
    API_INTERNAL_PORT: int = 5000

    @property
    def cookie_domain_or_none(self) -> str | None:
        """Empty string means "do not emit a Domain attribute" (matches Nest)."""
        return self.COOKIE_DOMAIN or None


def get_settings() -> Settings:
    # Module-level instance avoids reading .env per-request. Cached implicitly
    # because Pydantic BaseSettings only re-reads on instantiation.
    global _SETTINGS_SINGLETON
    if _SETTINGS_SINGLETON is None:
        _SETTINGS_SINGLETON = Settings()  # type: ignore[call-arg]
    return _SETTINGS_SINGLETON


_SETTINGS_SINGLETON: Settings | None = None
