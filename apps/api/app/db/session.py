"""
Async SQLAlchemy session - one engine per process, sessions per request via `get_db`.

Reads `DATABASE_URL` from settings (the same URL Prisma uses). Coerces the
`postgresql://` scheme to `postgresql+asyncpg://` so SQLAlchemy picks the
async driver. Drops Prisma's `?schema=public` query param which asyncpg
doesn't understand.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..core.settings import get_settings


def _to_async_url(url: str) -> str:
    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme == "postgresql":
        scheme = "postgresql+asyncpg"
    elif scheme.startswith("postgresql+"):
        pass
    else:
        raise RuntimeError(f"Unexpected DB scheme: {scheme}")
    # asyncpg rejects ?schema=...; Prisma uses it as a hint only.
    query = "&".join(p for p in parts.query.split("&") if not p.startswith("schema="))
    return urlunsplit((scheme, parts.netloc, parts.path, query, parts.fragment))


_engine = None
_SessionLocal: async_sessionmaker[AsyncSession] | None = None


def _ensure_engine() -> None:
    global _engine, _SessionLocal
    if _engine is None:
        settings = get_settings()
        # Postgres on the 1 GB Oracle VM runs with max_connections=20 (see
        # deploy/docker-compose.yml). The old pool_size=20 + max_overflow=20
        # let this single API process open up to 40 connections and, in
        # practice, hold 20 *idle* ones permanently (QueuePool never closes
        # pooled connections) - saturating the entire server. That starved
        # the one-shot `migrate` service on every deploy ("FATAL: sorry, too
        # many clients already") and locked out admin psql. Cap the API well
        # below max_connections so migrate, nightly backups and admin sessions
        # always have headroom: 10 pooled + up to 5 overflow = 15 peak, leaving
        # 5 free. pool_timeout raised so brief bursts queue instead of erroring.
        _engine = create_async_engine(
            _to_async_url(settings.DATABASE_URL),
            pool_size=10,
            max_overflow=5,
            pool_timeout=30,
            pool_recycle=1800,
            pool_pre_ping=True,
            echo=False,
        )
        _SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    _ensure_engine()
    assert _SessionLocal is not None
    async with _SessionLocal() as session:
        yield session


def get_engine():
    _ensure_engine()
    return _engine
