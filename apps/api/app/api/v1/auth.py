"""
POST   /api/auth/register                — public, rate-limited
POST   /api/auth/login                   — public, rate-limited, sets cookies, HTTP 200
POST   /api/auth/admin/login             — public, rate-limited, sets cookies, HTTP 200
POST   /api/auth/refresh                 — public, sets cookies, HTTP 200
POST   /api/auth/logout                  — public, clears cookies, HTTP 200
POST   /api/auth/verify-email            — public, HTTP 200
POST   /api/auth/resend-verification     — public, rate-limited, HTTP 200
POST   /api/auth/forgot-password         — public, rate-limited, HTTP 200
POST   /api/auth/reset-password          — public, HTTP 200
POST   /api/auth/2fa/setup               — authenticated (Skip2FA), HTTP 200
POST   /api/auth/2fa/verify              — authenticated (Skip2FA), HTTP 200
POST   /api/auth/2fa/disable             — authenticated, MEMBER only, HTTP 200
GET    /api/auth/me                      — authenticated (Skip2FA)

Mirrors `apps/api/src/auth/auth.controller.ts` byte-for-byte where the wire
contract is concerned. Captured fixtures live under tests/parity/fixtures/auth-*.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.auth_deps import current_user_required
from ...core.rate_limit import rate_limit
from ...core.security import (
    REFRESH_COOKIE,
    AuthenticatedUser,
    clear_auth_cookies,
    set_auth_cookies,
)
from ...db.session import get_db
from ...schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MeProfile,
    MeResponse,
    PublicUser,
    RegisterRequest,
    ResetPasswordRequest,
    StatusOk,
    TwoFactorDisableRequest,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
)
from ...services import auth_service
from ...services.auth_service import AuthError

router = APIRouter(prefix="/auth", tags=["auth"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


def _client_ip_and_ua(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    if ip and ip.startswith("::ffff:"):
        ip = ip[len("::ffff:"):]
    return ip, request.headers.get("user-agent")


def _to_public_user(
    u, access_token: str | None = None, refresh_token: str | None = None
) -> PublicUser:
    return PublicUser(
        id=u.id_,
        email=u.email,
        role=u.role,
        totpEnabled=u.totpEnabled,
        emailVerified=u.emailVerifiedAt is not None,
        accessToken=access_token,
        refreshToken=refresh_token,
    )


def _raise_auth_error(e: AuthError) -> None:
    detail: object
    if e.extra:
        detail = {"message": e.message, **e.extra}
    else:
        detail = e.message
    raise HTTPException(status_code=e.code, detail=detail)


# ───────────── REGISTER ──────────────────────────────────────────────────────


@router.post(
    "/register",
    response_model=StatusOk,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(limit=5, window=60, prefix="auth-register"))],
)
async def register(
    payload: RegisterRequest,
    request: Request,
    background: BackgroundTasks,
    db: DbDep,
) -> StatusOk:
    ip, ua = _client_ip_and_ua(request)
    try:
        await auth_service.register(
            db,
            email=payload.email,
            password=payload.password,
            firstName=payload.firstName,
            lastName=payload.lastName,
            ip=ip,
            userAgent=ua,
            background=background,
        )
    except AuthError as e:
        _raise_auth_error(e)
    return StatusOk(status="ok", message="Account created. Check your email to verify.")


# ───────────── LOGIN (member) ────────────────────────────────────────────────


@router.post(
    "/login",
    response_model=PublicUser,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limit(limit=5, window=60, prefix="auth-login"))],
)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    background: BackgroundTasks,
    db: DbDep,
) -> PublicUser:
    ip, ua = _client_ip_and_ua(request)
    try:
        user, access, refresh = await auth_service.login(
            db,
            email=payload.email,
            password=payload.password,
            totpCode=payload.totpCode,
            expectedRole="MEMBER",
            ip=ip,
            userAgent=ua,
            background=background,
        )
    except AuthError as e:
        _raise_auth_error(e)
    set_auth_cookies(response, access, refresh)
    return _to_public_user(user, access_token=access, refresh_token=refresh)


# ───────────── LOGIN (admin) ─────────────────────────────────────────────────


@router.post(
    "/admin/login",
    response_model=PublicUser,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limit(limit=5, window=60, prefix="auth-admin-login"))],
)
async def admin_login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    background: BackgroundTasks,
    db: DbDep,
) -> PublicUser:
    ip, ua = _client_ip_and_ua(request)
    try:
        user, access, refresh = await auth_service.login(
            db,
            email=payload.email,
            password=payload.password,
            totpCode=payload.totpCode,
            expectedRole="ADMIN",
            ip=ip,
            userAgent=ua,
            background=background,
        )
    except AuthError as e:
        _raise_auth_error(e)
    set_auth_cookies(response, access, refresh)
    return _to_public_user(user, access_token=access, refresh_token=refresh)


# ───────────── REFRESH ───────────────────────────────────────────────────────


@router.post("/refresh", response_model=PublicUser, status_code=status.HTTP_200_OK)
async def refresh(
    request: Request,
    response: Response,
    db: DbDep,
) -> PublicUser:
    presented = request.cookies.get(REFRESH_COOKIE)
    if not presented:
        raise HTTPException(status_code=401, detail="No refresh token")
    ip, ua = _client_ip_and_ua(request)
    try:
        access, new_refresh, user = await auth_service.refresh(
            db, presented_token=presented, ip=ip, userAgent=ua
        )
    except AuthError as e:
        _raise_auth_error(e)
    set_auth_cookies(response, access, new_refresh)
    return _to_public_user(user, access_token=access, refresh_token=new_refresh)


# ───────────── LOGOUT ────────────────────────────────────────────────────────


@router.post("/logout", response_model=StatusOk, status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    response: Response,
    background: BackgroundTasks,
    db: DbDep,
) -> StatusOk:
    presented = request.cookies.get(REFRESH_COOKIE)
    # The user may or may not be authenticated. Soft-read for audit purposes only.
    from ...core.auth_deps import _read_user_from_request
    user = _read_user_from_request(request)
    await auth_service.logout(
        db,
        presented_token=presented,
        user_id=user.id if user else None,
        background=background,
    )
    clear_auth_cookies(response)
    return StatusOk(status="ok")


# ───────────── EMAIL VERIFICATION ────────────────────────────────────────────


@router.post("/verify-email", response_model=StatusOk, status_code=status.HTTP_200_OK)
async def verify_email(
    payload: dict,  # uses raw dict so VerifyEmailRequest's extra='forbid' shape is enforced via .model_validate below
    request: Request,
    background: BackgroundTasks,
    db: DbDep,
) -> StatusOk:
    from ...schemas.auth import VerifyEmailRequest as _VEReq
    validated = _VEReq.model_validate(payload)
    ip, ua = _client_ip_and_ua(request)
    try:
        await auth_service.verify_email(
            db, token=validated.token, ip=ip, userAgent=ua, background=background
        )
    except AuthError as e:
        _raise_auth_error(e)
    return StatusOk(status="ok")


@router.post(
    "/resend-verification",
    response_model=StatusOk,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limit(limit=3, window=60, prefix="auth-resend"))],
)
async def resend_verification(payload: ForgotPasswordRequest, db: DbDep) -> StatusOk:
    await auth_service.resend_verification(db, email=payload.email)
    return StatusOk(status="ok")


# ───────────── PASSWORD RESET ────────────────────────────────────────────────


@router.post(
    "/forgot-password",
    response_model=StatusOk,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limit(limit=3, window=60, prefix="auth-forgot"))],
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    background: BackgroundTasks,
    db: DbDep,
) -> StatusOk:
    ip, ua = _client_ip_and_ua(request)
    await auth_service.forgot_password(
        db, email=payload.email, ip=ip, userAgent=ua, background=background
    )
    return StatusOk(status="ok")


@router.post("/reset-password", response_model=StatusOk, status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    background: BackgroundTasks,
    db: DbDep,
) -> StatusOk:
    ip, ua = _client_ip_and_ua(request)
    try:
        totp_reset = await auth_service.reset_password(
            db,
            token=payload.token,
            newPassword=payload.newPassword,
            ip=ip,
            userAgent=ua,
            background=background,
        )
    except AuthError as e:
        _raise_auth_error(e)
    if totp_reset:
        return StatusOk(
            status="ok",
            message="Two-factor authentication was also turned off — re-enroll after signing in.",
        )
    return StatusOk(status="ok")


# ───────────── 2FA ───────────────────────────────────────────────────────────


@router.post(
    "/2fa/setup",
    response_model=TwoFactorSetupResponse,
    status_code=status.HTTP_200_OK,
)
async def setup_2fa(
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> TwoFactorSetupResponse:
    otpauth, qr = await auth_service.begin_two_factor_setup(db, user_id=user.id)
    return TwoFactorSetupResponse(otpauthUrl=otpauth, qrCodeDataUrl=qr)


@router.post("/2fa/verify", response_model=StatusOk, status_code=status.HTTP_200_OK)
async def verify_2fa(
    payload: TwoFactorVerifyRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    request: Request,
    background: BackgroundTasks,
    db: DbDep,
) -> StatusOk:
    ip, ua = _client_ip_and_ua(request)
    try:
        await auth_service.confirm_two_factor_setup(
            db, user_id=user.id, code=payload.code, ip=ip, userAgent=ua, background=background
        )
    except AuthError as e:
        _raise_auth_error(e)
    return StatusOk(status="ok")


@router.post("/2fa/disable", response_model=StatusOk, status_code=status.HTTP_200_OK)
async def disable_2fa(
    payload: TwoFactorDisableRequest,
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    request: Request,
    background: BackgroundTasks,
    db: DbDep,
) -> StatusOk:
    # Mirror NestJS: only MEMBER role can disable.
    if user.role != "MEMBER":
        raise HTTPException(status_code=403, detail="Insufficient role")
    ip, ua = _client_ip_and_ua(request)
    try:
        await auth_service.disable_two_factor(
            db,
            user_id=user.id,
            password=payload.password,
            code=payload.code,
            ip=ip,
            userAgent=ua,
            background=background,
        )
    except AuthError as e:
        _raise_auth_error(e)
    return StatusOk(status="ok")


# ───────────── ME ────────────────────────────────────────────────────────────


@router.get("/me", response_model=MeResponse)
async def me(
    user: Annotated[AuthenticatedUser, Depends(current_user_required)],
    db: DbDep,
) -> MeResponse:
    body = await auth_service.me(db, user_id=user.id)
    return MeResponse(
        id=body["id"],
        email=body["email"],
        role=body["role"],
        status=body["status"],
        emailVerified=body["emailVerified"],
        totpEnabled=body["totpEnabled"],
        profile=MeProfile(**body["profile"]) if body["profile"] else None,
        createdAt=body["createdAt"],
    )
