"""
Pydantic schemas for /api/auth/* - mirrors `apps/api/src/auth/dto/auth.dto.ts`.

Validator parity table:
    @IsEmail          → EmailStr
    @MaxLength(254)   → max_length=254 on the field
    @MinLength(N)     → min_length=N
    @IsString         → automatic (Pydantic str)
    @IsOptional       → Optional[T] = None
    @Matches(re)      → pattern=...
    @Length(6,6)      → min_length=6, max_length=6
    @IsNotEmpty       → min_length=1
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from ..core.pydantic_config import ApiModel, PermissiveEmailStr as EmailStr

_TOTP_PATTERN = r"^\d{6}$"


# ───────────── requests ──────────────────────────────────────────────────────


class RegisterRequest(ApiModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    firstName: str | None = Field(default=None, max_length=80)
    lastName: str | None = Field(default=None, max_length=80)


class LoginRequest(ApiModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)
    totpCode: str | None = Field(default=None, pattern=_TOTP_PATTERN)


class VerifyEmailRequest(ApiModel):
    token: str = Field(min_length=1)


class ForgotPasswordRequest(ApiModel):
    email: EmailStr


class ResetPasswordRequest(ApiModel):
    token: str = Field(min_length=1)
    newPassword: str = Field(min_length=8, max_length=128)


class TwoFactorVerifyRequest(ApiModel):
    code: str = Field(pattern=_TOTP_PATTERN)


class TwoFactorDisableRequest(ApiModel):
    password: str = Field(min_length=1)
    code: str = Field(min_length=6, max_length=6)


class RefreshRequest(ApiModel):
    refreshToken: str | None = Field(default=None)


class LogoutRequest(ApiModel):
    refreshToken: str | None = Field(default=None)


# ───────────── responses ─────────────────────────────────────────────────────


class PublicUser(ApiModel):
    """Body returned by /login, /admin/login, /refresh."""

    id: str
    email: str
    role: Literal["MEMBER", "ADMIN"]
    totpEnabled: bool
    emailVerified: bool
    accessToken: str | None = None
    refreshToken: str | None = None


class StatusOk(ApiModel):
    """Most auth mutations return {status, message?}. Mirrors Nest exactly."""

    status: Literal["ok"] = "ok"
    message: str | None = None


class TwoFactorSetupResponse(ApiModel):
    otpauthUrl: str
    qrCodeDataUrl: str


class MeProfile(ApiModel):
    # Matches the raw `member_profiles` row shape Nest serializes via Prisma -
    # the captured fixture includes id, userId, dob, createdAt, updatedAt.
    id: str
    userId: str
    firstName: str | None = None
    lastName: str | None = None
    phone: str | None = None
    dob: str | None = None
    avatarUrl: str | None = None
    tier: str | None = None
    createdAt: str
    updatedAt: str


class MeResponse(ApiModel):
    id: str
    email: str
    role: Literal["MEMBER", "ADMIN"]
    status: Literal["ACTIVE", "SUSPENDED", "DELETED"]
    emailVerified: bool
    totpEnabled: bool
    profile: MeProfile | None
    createdAt: str  # ISO 8601 string, matches Nest's JSON serialization of Date
