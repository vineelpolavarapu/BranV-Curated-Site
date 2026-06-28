"""
Pydantic v2 base config + reusable validators.

These map NestJS's class-validator decorators to Pydantic semantics:

  * `extra='forbid'` mirrors `forbidNonWhitelisted: true`. Unknown payload
    keys produce a 400 instead of being silently dropped.
  * `csv_or_array_str` mirrors the `@Transform(toStringArray)` pattern Nest
    uses on multi-select query params (e.g. ?brand=a,b OR ?brand=a&brand=b).
  * `loose_bool` mirrors the boolean-from-string coercion class-transformer
    does implicitly with `enableImplicitConversion: true`.

Routers should base request schemas on `ApiModel` so the strict-extra rule
applies uniformly.
"""

from __future__ import annotations

import re
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, ConfigDict


# Permissive regex matching validator.js / class-validator's @IsEmail() —
# Pydantic's default EmailStr (via email-validator) rejects reserved TLDs
# like `.local`, but NestJS accepts them so we must too during dev parity.
# Pattern: `local@domain.tld` where the domain has at least one dot and
# every label is 1+ alphanumerics with optional internal hyphens.
_EMAIL_RE = re.compile(
    r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)


def _validate_permissive_email(value: str) -> str:
    v = value.strip().lower()
    if len(v) > 254 or not _EMAIL_RE.match(v):
        raise ValueError("value is not a valid email address")
    return v


# Use this in place of `EmailStr` so the dev `.env` and seed data (which use
# *.branv.local) work end-to-end. Returns the normalized (trimmed + lowercased)
# form so AuthService's `_normalize_email` stays a no-op.
PermissiveEmailStr = Annotated[str, AfterValidator(_validate_permissive_email)]


class ApiModel(BaseModel):
    """
    Base class for request and response schemas.

    `extra='forbid'`            — reject unknown fields (= Nest forbidNonWhitelisted)
    `str_strip_whitespace=True` — class-validator's @IsString implicit trim
    `populate_by_name=True`     — allow both alias and python attribute names on input
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        populate_by_name=True,
    )


def csv_or_array_str(value: Any) -> list[str]:
    """
    `@Transform(toStringArray)` analog. Accepts:
      - a comma-separated string  ("a,b,c"  → ["a", "b", "c"])
      - a single string            ("a"      → ["a"])
      - an already-array value     (["a","b"] → ["a", "b"])
      - None                       (None     → [])

    Used as a Pydantic `field_validator(mode='before')`.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(value)]


def loose_bool(value: Any) -> bool:
    """
    Accepts `True`, `False`, `1`, `0`, `'true'`, `'false'`, `'1'`, `'0'`,
    case-insensitive. Anything else raises (Pydantic surfaces it as 400).
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        if value == 1:
            return True
        if value == 0:
            return False
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"true", "1", "yes", "y"}:
            return True
        if v in {"false", "0", "no", "n"}:
            return False
    raise ValueError("must be a boolean-coercible value")
