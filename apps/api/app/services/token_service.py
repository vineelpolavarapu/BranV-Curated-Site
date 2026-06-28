"""
Refresh-token issuance + rotation — port of `apps/api/src/auth/token.service.ts`.

Reuse-detection rule (critical): if a revoked token is replayed, EVERY
refresh token belonging to that user is revoked. The replay-attacker and
the legit user both get logged out, which forces a fresh interactive login.
This is the same behavior NestJS implements.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.security import (
    AuthenticatedUser,
    hash_refresh_token,
    mint_refresh_token,
    sign_access_token,
)
from ..core.settings import get_settings
from ..db.models import RefreshToken, User


# cuid prefix matches Prisma's `@default(cuid())` — they're sortable, URL-safe,
# 25 chars total ("c" + 24 lowercase alnum). Used for newly-minted refresh-token
# row ids since the DB has no auto-generation trigger.
_CUID_ALPHABET = string.ascii_lowercase + string.digits


def _mint_cuid() -> str:
    return "c" + "".join(secrets.choice(_CUID_ALPHABET) for _ in range(24))


def _utcnow_naive() -> datetime:
    # PG TIMESTAMP (no tz) returns naive datetimes; keep writes naive to match
    # what Prisma stores so reads round-trip cleanly.
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def issue_refresh_token(
    db: AsyncSession,
    user_id: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> str:
    """Mint a new opaque refresh token, store SHA-256 hash, return raw token."""
    s = get_settings()
    raw = mint_refresh_token()
    token_hash = hash_refresh_token(raw)
    expires_at = _utcnow_naive() + timedelta(seconds=s.JWT_REFRESH_TTL_SECONDS)
    db.add(
        RefreshToken(
            id_=_mint_cuid(),
            userId=user_id,
            tokenHash=token_hash,
            expiresAt=expires_at,
            ip=ip,
            userAgent=user_agent,
            createdAt=_utcnow_naive(),
        )
    )
    await db.flush()
    return raw


async def rotate(
    db: AsyncSession,
    presented_token: str,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, str, User]:
    """
    Validate, rotate, return (access_token, refresh_token, user).
    Raises ValueError on any failure (caller converts to 401).
    """
    presented_hash = hash_refresh_token(presented_token)

    row = (await db.execute(
        select(RefreshToken).where(RefreshToken.tokenHash == presented_hash)
    )).scalar_one_or_none()
    if row is None:
        raise ValueError("Invalid refresh token")

    if row.revokedAt is not None:
        # Reuse detection — revoke the entire family.
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.userId == row.userId, RefreshToken.revokedAt.is_(None))
            .values(revokedAt=_utcnow_naive())
        )
        await db.commit()
        raise ValueError("Refresh token reuse detected")

    if row.expiresAt < _utcnow_naive():
        raise ValueError("Refresh token expired")

    # Load the user — needed to mint the new access token.
    user_row = (await db.execute(
        select(User).where(User.id_ == row.userId)
    )).scalar_one()

    new_raw = await issue_refresh_token(db, row.userId, ip=ip, user_agent=user_agent)
    new_hash = hash_refresh_token(new_raw)
    new_row = (await db.execute(
        select(RefreshToken).where(RefreshToken.tokenHash == new_hash)
    )).scalar_one()

    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.id_ == row.id_)
        .values(revokedAt=_utcnow_naive(), replacedById=new_row.id_)
    )
    await db.commit()

    access = sign_access_token(_user_to_authed(user_row))
    return access, new_raw, user_row


async def revoke_refresh_token(db: AsyncSession, presented_token: str) -> None:
    th = hash_refresh_token(presented_token)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.tokenHash == th, RefreshToken.revokedAt.is_(None))
        .values(revokedAt=_utcnow_naive())
    )
    await db.commit()


async def revoke_all_for_user(db: AsyncSession, user_id: str) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.userId == user_id, RefreshToken.revokedAt.is_(None))
        .values(revokedAt=_utcnow_naive())
    )
    await db.commit()


def _user_to_authed(u: User) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=u.id_,
        email=u.email,
        role=u.role,  # type: ignore[arg-type]
        totpEnabled=u.totpEnabled,
        emailVerified=u.emailVerifiedAt is not None,
    )
