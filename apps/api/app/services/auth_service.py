"""
Auth business logic — port of `apps/api/src/auth/auth.service.ts`.

Each public method maps 1:1 to a Nest service method. Behavior parity rules:

  * Lockout: 5 attempts / 15-min window / 15-min lock (env-tunable).
    Reset rule mirrors Nest's: counter resets when EITHER the previous failure
    aged out of the window OR a prior lockout has expired.
  * Email-enumeration safety: register & forgot-password & resend-verification
    all return 'ok' regardless of whether the email exists.
  * Password reset invalidates ALL active refresh tokens for the user (forces
    re-login on every device).
  * Audit writes use fire-and-forget via FastAPI BackgroundTasks (caller-owned).
"""

from __future__ import annotations

import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy import func, select, update
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from ..core import security
from ..core.logging import get_logger
from ..core.security import AuthenticatedUser
from ..core.settings import get_settings
from ..db.models import (
    EmailVerification,
    MemberProfile,
    PasswordReset,
    RefreshToken,
    User,
)
from ..integrations.mail import get_mail_service
from . import audit_service
from . import token_service

log = get_logger("auth")

VERIFICATION_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)

# cuid format matches Prisma's @default(cuid())
_CUID_ALPHABET = string.ascii_lowercase + string.digits


def _mint_cuid() -> str:
    return "c" + "".join(secrets.choice(_CUID_ALPHABET) for _ in range(24))


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _normalize_email(e: str) -> str:
    return e.strip().lower()


class AuthError(Exception):
    """Internal — raised by services, mapped to HTTP errors in the router."""

    def __init__(self, code: int, message: str, extra: dict[str, Any] | None = None):
        self.code = code
        self.message = message
        self.extra = extra or {}
        super().__init__(message)


# ───────────── REGISTER ──────────────────────────────────────────────────────


async def register(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    firstName: str | None,
    lastName: str | None,
    ip: str | None,
    userAgent: str | None,
    background: BackgroundTasks,
) -> str:
    normalized = _normalize_email(email)
    existing = (await db.execute(
        select(User).where(User.email == normalized)
    )).scalar_one_or_none()
    if existing is not None:
        # Don't leak existence — same generic 400 NestJS returns.
        raise AuthError(
            400,
            "If this email is available, you will receive a verification message",
        )

    password_hash = await security.async_hash_password(password)
    user_id = _mint_cuid()
    now = _utcnow_naive()
    db.add(
        User(
            id_=user_id,
            email=normalized,
            passwordHash=password_hash,
            role="MEMBER",
            status="ACTIVE",
            createdAt=now,
            updatedAt=now,
        )
    )
    # Flush before the dependent insert — the SQLAlchemy models don't carry
    # ForeignKey() metadata (the generator emits scalar columns only), so the
    # unit-of-work would otherwise re-order these inserts and trip the
    # member_profiles_userId_fkey constraint.
    await db.flush()
    db.add(
        MemberProfile(
            id_=_mint_cuid(),
            userId=user_id,
            firstName=firstName,
            lastName=lastName,
            createdAt=now,
            updatedAt=now,
        )
    )
    await db.flush()

    # Persist the verification token WITH the user, then commit. The account is
    # now durably created regardless of what the mailer does.
    raw = await _issue_verification_token(db, user_id=user_id)

    await db.commit()

    # Send the verification email AFTER commit, best-effort. A mail failure
    # (provider outage, missing key, transient error) must never roll back or
    # fail a completed signup — the token is already stored, so the user can
    # request a resend. Runs as a background task so it never blocks the
    # response either.
    background.add_task(_send_verification_email_safe, normalized, raw)
    background.add_task(
        audit_service.record,
        actorId=user_id,
        action="auth.register",
        ip=ip,
        userAgent=userAgent,
    )
    return user_id


async def _issue_verification_token(db: AsyncSession, *, user_id: str) -> str:
    """Insert an email-verification token row and return its raw (unhashed)
    value for embedding in the verification link. Does NOT send anything."""
    raw = _nanoid(48)
    token_hash = _sha256(raw)
    now = _utcnow_naive()
    db.add(
        EmailVerification(
            id_=_mint_cuid(),
            userId=user_id,
            tokenHash=token_hash,
            expiresAt=now + VERIFICATION_TTL,
            createdAt=now,
        )
    )
    await db.flush()
    return raw


async def _send_verification_email_safe(email: str, raw_token: str) -> None:
    """Best-effort verification email — swallows and logs any failure so it can
    never break a signup that already committed."""
    try:
        s = get_settings()
        link = f"{s.WEB_ORIGIN}/verify-email?token={raw_token}"
        await get_mail_service().send_email_verification(email, link)
    except Exception as e:  # noqa: BLE001
        log.warning("verification_email_send_failed", email=email, error=str(e))


def _nanoid(length: int) -> str:
    # Match nanoid's default URL-safe alphabet (A-Za-z0-9_-) and length.
    alphabet = string.ascii_letters + string.digits + "_-"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ───────────── LOGIN ─────────────────────────────────────────────────────────


async def login(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    totpCode: str | None,
    expectedRole: str | None,
    ip: str | None,
    userAgent: str | None,
    background: BackgroundTasks,
) -> tuple[User, str, str]:
    normalized = _normalize_email(email)
    user = (await db.execute(
        select(User).where(func.lower(User.email) == normalized)
    )).scalar_one_or_none()

    # Generic-credential-error path (no user OR suspended/deleted account).
    is_active_account = (
        user is not None
        and (user.status is None or (user.status.value if hasattr(user.status, 'value') else str(user.status)).upper() in ("ACTIVE", "VERIFIED", "ENABLED", "OK"))
    )
    if not is_active_account or user is None:
        background.add_task(
            audit_service.record,
            action="auth.login.fail",
            ip=ip,
            userAgent=userAgent,
            metadata={"email": normalized, "reason": "unknown_user"},
        )
        raise AuthError(401, "Invalid credentials")

    locked_until_utc = _to_naive_utc(user.lockedUntil)
    if locked_until_utc is not None and locked_until_utc > _utcnow_naive():
        background.add_task(
            audit_service.record,
            actorId=user.id_,
            action="auth.login.locked",
            ip=ip,
            userAgent=userAgent,
        )
        raise AuthError(401, "Account temporarily locked. Try again later.")

    if not await security.async_verify_password(user.passwordHash, password):
        await _record_failed_attempt(db, user, ip=ip, userAgent=userAgent, background=background)
        raise AuthError(401, "Invalid credentials")

    if expectedRole and user.role != expectedRole:
        background.add_task(
            audit_service.record,
            actorId=user.id_,
            action="auth.login.wrong_portal",
            ip=ip,
            userAgent=userAgent,
        )
        raise AuthError(403, "Wrong sign-in portal for this account")

    # Success — reset counters, stamp last login (and upgrade legacy hash to Argon2id if needed).
    now = _utcnow_naive()
    update_values: dict[str, Any] = {
        "failedLoginCount": 0,
        "lockedUntil": None,
        "lastLoginAt": now,
        "updatedAt": now,
    }
    if security.needs_rehash(user.passwordHash):
        update_values["passwordHash"] = await security.async_hash_password(password)

    await db.execute(
        update(User)
        .where(User.id_ == user.id_)
        .values(**update_values)
    )

    # Re-load with the fresh values so the token reflects current state.
    fresh = (await db.execute(select(User).where(User.id_ == user.id_))).scalar_one()
    access_token = security.sign_access_token(_user_to_authed(fresh))
    refresh_token = await token_service.issue_refresh_token(
        db, fresh.id_, ip=ip, user_agent=userAgent
    )
    await db.commit()

    background.add_task(
        audit_service.record,
        actorId=user.id_,
        action="auth.login.success",
        ip=ip,
        userAgent=userAgent,
    )
    return fresh, access_token, refresh_token


async def _record_failed_attempt(
    db: AsyncSession,
    user: User,
    *,
    ip: str | None,
    userAgent: str | None,
    background: BackgroundTasks,
) -> None:
    s = get_settings()
    now = _utcnow_naive()
    window_start = now - timedelta(minutes=s.AUTH_LOCKOUT_WINDOW_MIN)
    user_locked_utc = _to_naive_utc(user.lockedUntil)
    user_updated_utc = _to_naive_utc(user.updatedAt)
    lockout_just_expired = user_locked_utc is not None and user_locked_utc < now
    counter_stale = user_updated_utc is not None and user_updated_utc < window_start
    should_reset = lockout_just_expired or counter_stale
    next_count = 1 if should_reset else user.failedLoginCount + 1
    should_lock = next_count >= s.AUTH_LOCKOUT_MAX_ATTEMPTS
    if should_lock:
        locked_until: datetime | None = now + timedelta(minutes=s.AUTH_LOCKOUT_DURATION_MIN)
    elif lockout_just_expired:
        locked_until = None
    else:
        locked_until = user.lockedUntil

    await db.execute(
        update(User)
        .where(User.id_ == user.id_)
        .values(failedLoginCount=next_count, lockedUntil=locked_until, updatedAt=now)
    )
    await db.commit()

    background.add_task(
        audit_service.record,
        actorId=user.id_,
        action="auth.login.lockout" if should_lock else "auth.login.fail",
        ip=ip,
        userAgent=userAgent,
        metadata={"failedCount": next_count},
    )


# ───────────── REFRESH / LOGOUT ──────────────────────────────────────────────


async def refresh(
    db: AsyncSession, *, presented_token: str, ip: str | None, userAgent: str | None
) -> tuple[str, str, User]:
    try:
        return await token_service.rotate(db, presented_token, ip=ip, user_agent=userAgent)
    except ValueError as e:
        raise AuthError(401, str(e))


async def logout(
    db: AsyncSession,
    *,
    presented_token: str | None,
    user_id: str | None,
    background: BackgroundTasks,
) -> None:
    if presented_token:
        await token_service.revoke_refresh_token(db, presented_token)
    if user_id:
        background.add_task(audit_service.record, actorId=user_id, action="auth.logout")


# ───────────── EMAIL VERIFICATION ────────────────────────────────────────────


async def verify_email(
    db: AsyncSession,
    *,
    token: str,
    ip: str | None,
    userAgent: str | None,
    background: BackgroundTasks,
) -> None:
    token_hash = _sha256(token)
    row = (await db.execute(
        select(EmailVerification).where(EmailVerification.tokenHash == token_hash)
    )).scalar_one_or_none()
    if row is None or row.usedAt is not None or row.expiresAt < _utcnow_naive():
        raise AuthError(400, "Invalid or expired verification token")
    now = _utcnow_naive()
    await db.execute(
        update(EmailVerification).where(EmailVerification.id_ == row.id_).values(usedAt=now)
    )
    await db.execute(
        update(User).where(User.id_ == row.userId).values(emailVerifiedAt=now, updatedAt=now)
    )
    await db.commit()
    background.add_task(
        audit_service.record,
        actorId=row.userId,
        action="auth.email.verified",
        ip=ip,
        userAgent=userAgent,
    )


async def resend_verification(db: AsyncSession, *, email: str) -> None:
    user = (await db.execute(
        select(User).where(User.email == _normalize_email(email))
    )).scalar_one_or_none()
    if user and user.emailVerifiedAt is None:
        raw = await _issue_verification_token(db, user_id=user.id_)
        await db.commit()
        # Best-effort send after commit — the token is already persisted.
        await _send_verification_email_safe(user.email, raw)
    # else: silent success to avoid enumeration


# ───────────── PASSWORD RESET ────────────────────────────────────────────────


async def forgot_password(
    db: AsyncSession,
    *,
    email: str,
    ip: str | None,
    userAgent: str | None,
    background: BackgroundTasks,
) -> None:
    s = get_settings()
    user = (await db.execute(
        select(User).where(User.email == _normalize_email(email))
    )).scalar_one_or_none()
    if user is None:
        return  # silent success

    raw = _nanoid(48)
    token_hash = _sha256(raw)
    now = _utcnow_naive()
    db.add(
        PasswordReset(
            id_=_mint_cuid(),
            userId=user.id_,
            tokenHash=token_hash,
            expiresAt=now + PASSWORD_RESET_TTL,
            createdAt=now,
        )
    )
    await db.flush()
    link = f"{s.WEB_ORIGIN}/reset-password?token={raw}"
    await get_mail_service().send_password_reset(user.email, link, totp_will_reset=user.totpEnabled)
    await db.commit()
    background.add_task(
        audit_service.record,
        actorId=user.id_,
        action="auth.password.reset_requested",
        ip=ip,
        userAgent=userAgent,
    )


async def reset_password(
    db: AsyncSession,
    *,
    token: str,
    newPassword: str,
    ip: str | None,
    userAgent: str | None,
    background: BackgroundTasks,
) -> bool:
    """Returns True if this reset also cleared an active TOTP enrollment."""
    token_hash = _sha256(token)
    row = (await db.execute(
        select(PasswordReset).where(PasswordReset.tokenHash == token_hash)
    )).scalar_one_or_none()
    if row is None or row.usedAt is not None or row.expiresAt < _utcnow_naive():
        raise AuthError(400, "Invalid or expired reset token")

    user = (await db.execute(select(User).where(User.id_ == row.userId))).scalar_one()
    had_totp = user.totpEnabled

    new_hash = await security.async_hash_password(newPassword)
    now = _utcnow_naive()
    await db.execute(
        update(PasswordReset).where(PasswordReset.id_ == row.id_).values(usedAt=now)
    )
    await db.execute(
        update(User)
        .where(User.id_ == row.userId)
        .values(
            passwordHash=new_hash,
            failedLoginCount=0,
            lockedUntil=None,
            # Proving email ownership is also our TOTP-recovery path: an admin who
            # lost their authenticator can't reach /2fa/setup without first logging
            # in, and login requires the (now-missing) code. Clearing it here lets
            # them log in and re-enroll via /admin/setup-2fa.
            totpEnabled=False,
            totpSecret=None,
            updatedAt=now,
        )
    )
    # Invalidate all sessions.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.userId == row.userId, RefreshToken.revokedAt.is_(None))
        .values(revokedAt=now)
    )
    await db.commit()
    background.add_task(
        audit_service.record,
        actorId=row.userId,
        action="auth.password.reset",
        ip=ip,
        userAgent=userAgent,
        metadata={"totpReset": had_totp},
    )
    return had_totp


# ───────────── 2FA ───────────────────────────────────────────────────────────


async def begin_two_factor_setup(db: AsyncSession, *, user_id: str) -> tuple[str, str]:
    """Returns (otpauthUrl, qrCodeDataUrl). Stores unconfirmed secret on the user row."""
    try:
        import qrcode  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError("The qrcode package is required for 2FA setup") from exc
    import io
    import base64

    user = (await db.execute(select(User).where(User.id_ == user_id))).scalar_one()
    secret_b32 = security.generate_totp_secret()
    otpauth = security.totp_uri(user.email, secret_b32)

    # QR as data URL — match Nest's qrcode.toDataURL() output shape.
    img = qrcode.make(otpauth)
    buf = io.BytesIO()
    img.save(buf)
    qr_data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    await db.execute(
        update(User)
        .where(User.id_ == user_id)
        .values(totpSecret=secret_b32, totpEnabled=False, updatedAt=_utcnow_naive())
    )
    await db.commit()
    return otpauth, qr_data_url


async def confirm_two_factor_setup(
    db: AsyncSession,
    *,
    user_id: str,
    code: str,
    ip: str | None,
    userAgent: str | None,
    background: BackgroundTasks,
) -> None:
    user = (await db.execute(select(User).where(User.id_ == user_id))).scalar_one()
    if not user.totpSecret:
        raise AuthError(400, "No 2FA setup in progress")
    if not security.verify_totp(code, user.totpSecret):
        raise AuthError(400, "Invalid 2FA code")
    await db.execute(
        update(User)
        .where(User.id_ == user_id)
        .values(totpEnabled=True, updatedAt=_utcnow_naive())
    )
    await db.commit()
    background.add_task(
        audit_service.record,
        actorId=user_id,
        action="auth.2fa.enabled",
        ip=ip,
        userAgent=userAgent,
    )


async def disable_two_factor(
    db: AsyncSession,
    *,
    user_id: str,
    password: str,
    code: str,
    ip: str | None,
    userAgent: str | None,
    background: BackgroundTasks,
) -> None:
    user = (await db.execute(select(User).where(User.id_ == user_id))).scalar_one()
    if user.role == "ADMIN":
        raise AuthError(403, "Admins cannot disable 2FA")
    if not await security.async_verify_password(user.passwordHash, password):
        raise AuthError(401, "Invalid password")
    if not user.totpEnabled or not user.totpSecret:
        raise AuthError(400, "2FA is not enabled")
    if not security.verify_totp(code, user.totpSecret):
        raise AuthError(400, "Invalid 2FA code")
    await db.execute(
        update(User)
        .where(User.id_ == user_id)
        .values(totpEnabled=False, totpSecret=None, updatedAt=_utcnow_naive())
    )
    await db.commit()
    background.add_task(
        audit_service.record,
        actorId=user_id,
        action="auth.2fa.disabled",
        ip=ip,
        userAgent=userAgent,
    )


# ───────────── ME ────────────────────────────────────────────────────────────


async def me(db: AsyncSession, *, user_id: str) -> dict[str, Any]:
    user = (await db.execute(
        select(User).options(joinedload(User.profile)).where(User.id_ == user_id)
    )).scalar_one()
    profile = user.profile
    return {
        "id": user.id_,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "emailVerified": user.emailVerifiedAt is not None,
        "totpEnabled": user.totpEnabled,
        "profile": (
            {
                "id": profile.id_,
                "userId": profile.userId,
                "firstName": profile.firstName,
                "lastName": profile.lastName,
                "phone": profile.phone,
                "dob": _iso_ms(profile.dob) if profile.dob else None,
                "avatarUrl": profile.avatarUrl,
                "tier": profile.tier,
                "createdAt": _iso_ms(profile.createdAt),
                "updatedAt": _iso_ms(profile.updatedAt),
            }
            if profile
            else None
        ),
        "createdAt": _iso_ms(user.createdAt),
    }


def _iso_ms(dt: datetime) -> str:
    """ISO 8601 with millisecond precision + 'Z' suffix — matches Nest's
    `new Date().toISOString()` exactly. Python's `.isoformat()` would emit
    microseconds (`.319000`), which would cause a one-character parity diff."""
    # Strip to milliseconds and append Z.
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


# ───────────── helpers ───────────────────────────────────────────────────────


def _user_to_authed(u: User) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=u.id_,
        email=u.email,
        role=u.role,  # type: ignore[arg-type]
        totpEnabled=u.totpEnabled,
        emailVerified=u.emailVerifiedAt is not None,
    )
