"""
Cross-cutting security primitives - port of `apps/api/src/auth/{password,token}.service.ts`
plus the cookie helpers from `apps/api/src/auth/auth.controller.ts`.

Exact parity rules (do not change without re-running the parity suite):

  * Argon2id, OWASP defaults: memoryCost 19 MiB, timeCost 2, parallelism 1.
  * JWT HS256. Access payload: {sub, email, role, ev, iat, exp}.
  * Refresh token: 48 bytes of entropy, base64url-encoded, SHA-256 hashed in DB.
  * Cookie names: `branv_access` and `branv_refresh`.
  * Cookie options honor COOKIE_SECURE / COOKIE_SAMESITE / COOKIE_DOMAIN env vars.
  * Path='/' always, HttpOnly=True always.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from fastapi import Response
from passlib.context import CryptContext

from .settings import get_settings

# ───────────── constants kept in sync with apps/api ──────────────────────────

ACCESS_COOKIE = "branv_access"
REFRESH_COOKIE = "branv_refresh"

# Argon2id parameters - match apps/api/src/auth/password.service.ts exactly.
_PASSWORD_HASHER = PasswordHasher(
    time_cost=2,
    memory_cost=19 * 1024,
    parallelism=1,
)

# Multi-scheme Passlib context for comprehensive legacy hash support
_PWD_CONTEXT = CryptContext(
    schemes=["argon2", "bcrypt", "bcrypt_sha256", "pbkdf2_sha256", "scrypt", "sha512_crypt", "sha256_crypt", "md5_crypt"],
    deprecated="auto",
)

# ───────────── data types ────────────────────────────────────────────────────

UserRole = Literal["MEMBER", "ADMIN"]


@dataclass(slots=True)
class AccessTokenPayload:
    """Mirror of `AccessTokenPayload` in jwt-auth.guard.ts."""

    sub: str
    email: str
    role: UserRole
    ev: bool     # emailVerified (i.e. emailVerifiedAt is not null)
    iat: int | None = None
    exp: int | None = None


@dataclass(slots=True)
class AuthenticatedUser:
    """Mirror of `AuthenticatedUser` (current-user.decorator.ts).

    Note the field rename: JWT payload uses short keys (`ev`);
    the resolved request user uses descriptive names (`emailVerified`).
    """

    id: str
    email: str
    role: UserRole
    emailVerified: bool


# ───────────── password hashing ──────────────────────────────────────────────


def hash_password(plaintext: str) -> str:
    return _PASSWORD_HASHER.hash(plaintext)


def verify_password(stored_hash: str, plaintext: str) -> bool:
    if not stored_hash or not plaintext:
        return False

    s_hash = stored_hash.strip()
    p_text = plaintext

    # Strategy 1: Direct Argon2id verification
    if s_hash.startswith(("$argon2id$", "$argon2i$", "$argon2d$")):
        try:
            return _PASSWORD_HASHER.verify(s_hash, p_text)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            pass
        # Fallback: Try with SHA256 pre-hashed password
        try:
            sha_prehash = hashlib.sha256(p_text.encode("utf-8")).hexdigest()
            return _PASSWORD_HASHER.verify(s_hash, sha_prehash)
        except Exception:
            pass

    # Strategy 2: Direct Bcrypt verification ($2a$, $2b$, $2y$, $2x$, $2$)
    if s_hash.startswith(("$2a$", "$2b$", "$2y$", "$2x$", "$2$")):
        try:
            if bcrypt.checkpw(p_text.encode("utf-8"), s_hash.encode("utf-8")):
                return True
        except Exception:
            pass
        # Fallback 2a: Try with SHA256 hex pre-hashed password
        try:
            sha_hex = hashlib.sha256(p_text.encode("utf-8")).hexdigest().encode("utf-8")
            if bcrypt.checkpw(sha_hex, s_hash.encode("utf-8")):
                return True
        except Exception:
            pass
        # Fallback 2b: Try with SHA256 raw binary pre-hashed password
        try:
            sha_bin = hashlib.sha256(p_text.encode("utf-8")).digest()
            if bcrypt.checkpw(sha_bin, s_hash.encode("utf-8")):
                return True
        except Exception:
            pass

    # Strategy 3: Passlib multi-scheme context
    try:
        if _PWD_CONTEXT.verify(p_text, s_hash):
            return True
    except Exception:
        pass

    # Strategy 4: Raw SHA-256 hex digest
    if len(s_hash) == 64:
        if hashlib.sha256(p_text.encode("utf-8")).hexdigest().lower() == s_hash.lower():
            return True

    # Strategy 5: Raw MD5 hex digest
    if len(s_hash) == 32:
        if hashlib.md5(p_text.encode("utf-8")).hexdigest().lower() == s_hash.lower():
            return True

    return False


def needs_rehash(stored_hash: str) -> bool:
    """Returns True if stored_hash is from a legacy algorithm (e.g. bcrypt) and should be updated to Argon2id upon successful authentication."""
    if not stored_hash:
        return False
    return not stored_hash.startswith(("$argon2id$", "$argon2i$", "$argon2d$"))


async def async_hash_password(plaintext: str) -> str:
    import asyncio
    return await asyncio.to_thread(hash_password, plaintext)


async def async_verify_password(stored_hash: str, plaintext: str) -> bool:
    import asyncio
    return await asyncio.to_thread(verify_password, stored_hash, plaintext)


# ───────────── JWT access tokens ─────────────────────────────────────────────


def sign_access_token(user: AuthenticatedUser | dict[str, Any]) -> str:
    """Sign a JWT with the exact shape NestJS emits.

    Accepts either an `AuthenticatedUser` dataclass or a raw dict so the
    caller can sign before the DB row is wrapped into the request-scoped
    type (e.g. fresh-login flow).
    """
    s = get_settings()
    if isinstance(user, AuthenticatedUser):
        sub, email, role = user.id, user.email, user.role
        ev = user.emailVerified
    else:
        sub = user["id"]
        email = user["email"]
        role = user["role"]
        # Match Nest's `user.emailVerifiedAt !== null` check.
        ev_at = user.get("emailVerifiedAt")
        ev = ev_at is not None

    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "ev": ev,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=s.JWT_ACCESS_TTL_SECONDS)).timestamp()),
    }
    return jwt.encode(payload, s.JWT_ACCESS_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> AccessTokenPayload | None:
    """Verify + decode. Returns None on any failure (caller decides the error path)."""
    s = get_settings()
    try:
        raw = jwt.decode(token, s.JWT_ACCESS_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return AccessTokenPayload(
        sub=raw["sub"],
        email=raw["email"],
        role=raw["role"],
        ev=bool(raw["ev"]),
        iat=raw.get("iat"),
        exp=raw.get("exp"),
    )


def payload_to_authenticated_user(p: AccessTokenPayload) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=p.sub,
        email=p.email,
        role=p.role,  # type: ignore[arg-type]
        emailVerified=p.ev,
    )


# ───────────── refresh tokens (opaque, sha256-hashed in DB) ──────────────────


def mint_refresh_token() -> str:
    """48 bytes of entropy, base64url - matches Node's randomBytes(48).toString('base64url')."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """SHA-256 hex digest. Identical bytes to Node's createHash('sha256').digest('hex')."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ───────────── cookie helpers ────────────────────────────────────────────────


def _cookie_opts(max_age_seconds: int) -> dict[str, Any]:
    """
    Build the kwargs FastAPI's Response.set_cookie wants. Field names map:
        Nest httpOnly  → httponly
        Nest sameSite  → samesite ('lax'|'strict'|'none')
        Nest secure    → secure
        Nest domain    → domain  (None means "do not emit a Domain attribute")
        Nest maxAge ms → max_age seconds  (FastAPI takes seconds, not ms)
    """
    s = get_settings()
    is_secure = s.COOKIE_SECURE or (s.COOKIE_SAMESITE == "none")
    opts: dict[str, Any] = {
        "httponly": True,
        "secure": is_secure,
        "samesite": s.COOKIE_SAMESITE,
        "path": "/",
        "max_age": max_age_seconds,
    }
    if s.cookie_domain_or_none:
        opts["domain"] = s.cookie_domain_or_none
    return opts


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    s = get_settings()
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        **_cookie_opts(s.JWT_ACCESS_TTL_SECONDS),
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        **_cookie_opts(s.JWT_REFRESH_TTL_SECONDS),
    )


def clear_auth_cookies(response: Response) -> None:
    """
    Nest calls `res.clearCookie(name, opts)` which emits the cookie with
    Max-Age=0 and the original attributes (sans Max-Age). FastAPI's
    delete_cookie does the same - set path/domain so the browser actually
    matches and evicts the right cookie.
    """
    s = get_settings()
    delete_kwargs: dict[str, Any] = {"path": "/"}
    if s.cookie_domain_or_none:
        delete_kwargs["domain"] = s.cookie_domain_or_none
    response.delete_cookie(ACCESS_COOKIE, **delete_kwargs)
    response.delete_cookie(REFRESH_COOKIE, **delete_kwargs)


# ───────────── helper for extracting the bearer/cookie token ─────────────────


def extract_access_token(cookies: dict[str, str], authorization_header: str | None) -> str | None:
    """Authorization: Bearer token wins (LocalStorage/Memory strategy), then cookie fallback."""
    if authorization_header and authorization_header.startswith("Bearer "):
        return authorization_header[len("Bearer "):]
    from_cookie = cookies.get(ACCESS_COOKIE)
    if from_cookie:
        return from_cookie
    return None
