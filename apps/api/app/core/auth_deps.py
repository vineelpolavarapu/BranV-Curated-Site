"""
FastAPI dependencies - port of NestJS's JwtAuthGuard / RolesGuard /
tryReadUserId(), expressed as FastAPI `Depends(...)`.

Parity notes:
  * `current_user_required` raises 401 with Nest's `{statusCode, message, error}` shape
    (the exception handler in core/exception_handlers.py normalizes it).
  * `current_user_optional` is the analog of Nest's `tryReadUserId()`. It MUST NOT
    raise on missing or invalid tokens - the @Public endpoints in wishlist,
    notifications, reviews, newsletter, and clicks rely on it returning None to
    serve an anonymous-shaped payload.
  * `require_roles(*roles)` returns 403 with Nest's RolesGuard message text
    ('Insufficient role' / 'Authentication required').

NestJS applies JwtAuthGuard globally via APP_GUARD. FastAPI's equivalent is a
thin app-level middleware OR a dependency baked into every router include -
we use the dependency approach because it shows up in the auto-generated
OpenAPI docs.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from .security import (
    AuthenticatedUser,
    decode_access_token,
    extract_access_token,
    payload_to_authenticated_user,
)


def _read_user_from_request(request: Request) -> AuthenticatedUser | None:
    """Pure function - reads cookies + Authorization header, returns user or None."""
    token = extract_access_token(
        cookies=request.cookies,
        authorization_header=request.headers.get("authorization"),
    )
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    return payload_to_authenticated_user(payload)


def current_user_optional(request: Request) -> AuthenticatedUser | None:
    """`tryReadUserId` analog - non-raising. Stash on request.state for log context."""
    user = _read_user_from_request(request)
    if user:
        request.state.user = user
    return user


def current_user_required(request: Request) -> AuthenticatedUser:
    """JwtAuthGuard analog - raises 401 on missing / invalid token."""
    token = extract_access_token(
        cookies=request.cookies,
        authorization_header=request.headers.get("authorization"),
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
        )
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )
    user = payload_to_authenticated_user(payload)
    request.state.user = user
    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(current_user_required)]
OptionalUser = Annotated[AuthenticatedUser | None, Depends(current_user_optional)]


def require_roles(*roles: str):
    """
    Dependency factory - RolesGuard analog.

        @router.get("/admin/things", dependencies=[Depends(require_roles('ADMIN'))])

    Empty `roles` is a no-op (matches NestJS - no @Roles() decorator = no check).
    """
    allowed = set(roles)

    def _enforce(user: CurrentUser) -> AuthenticatedUser:
        if not allowed:
            return user
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return user

    return _enforce


def require_email_verified(user: CurrentUser) -> AuthenticatedUser:
    """Used by member-only mutation endpoints that gate behind verified email."""
    if not user.emailVerified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required",
        )
    return user
