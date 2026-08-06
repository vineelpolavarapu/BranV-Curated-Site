"""Unit tests for app.core.security — Argon2, JWT, refresh tokens, TOTP."""

from __future__ import annotations

import base64
import time

import jwt
import pyotp
import pytest
from fastapi import Response

from app.core import security
from app.core.settings import get_settings


def test_argon2_roundtrip():
    h = security.hash_password("hunter2-very-strong-PW")
    assert h.startswith("$argon2id$")
    assert security.verify_password(h, "hunter2-very-strong-PW") is True
    assert security.verify_password(h, "wrong") is False
    assert security.needs_rehash(h) is False


def test_legacy_bcrypt_verification():
    import bcrypt
    bcrypt_hash = bcrypt.hashpw(b"legacy-secret-password", bcrypt.gensalt()).decode("ascii")
    assert bcrypt_hash.startswith(("$2a$", "$2b$", "$2y$"))
    assert security.verify_password(bcrypt_hash, "legacy-secret-password") is True
    assert security.verify_password(bcrypt_hash, "wrong-password") is False
    assert security.needs_rehash(bcrypt_hash) is True


def test_argon2_verify_wrong_hash_format_returns_false():
    # Defensive parity with Nest's `.catch(() => false)` on argon2.verify.
    assert security.verify_password("not-an-argon2-hash", "anything") is False


def test_jwt_payload_shape_matches_nest():
    user = security.AuthenticatedUser(
        id="user-abc",
        email="a@b.test",
        role="ADMIN",
        totpEnabled=True,
        emailVerified=False,
    )
    token = security.sign_access_token(user)
    s = get_settings()
    raw = jwt.decode(token, s.JWT_ACCESS_SECRET, algorithms=["HS256"])
    assert set(raw.keys()) == {"sub", "email", "role", "totp", "ev", "iat", "exp"}
    assert raw["sub"] == "user-abc"
    assert raw["email"] == "a@b.test"
    assert raw["role"] == "ADMIN"
    assert raw["totp"] is True
    assert raw["ev"] is False
    # exp ≈ iat + TTL.
    assert abs((raw["exp"] - raw["iat"]) - s.JWT_ACCESS_TTL_SECONDS) <= 1


def test_jwt_signed_by_python_decodable_by_python():
    user = security.AuthenticatedUser(
        id="x", email="x@y.z", role="MEMBER", totpEnabled=False, emailVerified=True
    )
    token = security.sign_access_token(user)
    decoded = security.decode_access_token(token)
    assert decoded is not None
    assert decoded.sub == "x"
    assert decoded.role == "MEMBER"
    assert decoded.totp is False
    assert decoded.ev is True


def test_jwt_decode_returns_none_on_garbage():
    assert security.decode_access_token("not.a.jwt") is None
    assert security.decode_access_token("") is None


def test_sign_access_token_from_dict_handles_emailVerifiedAt_null():
    # The fresh-login path passes the raw DB row; the JWT 'ev' must reflect
    # `user.emailVerifiedAt !== null` exactly like the Nest implementation.
    t1 = security.sign_access_token(
        {"id": "u1", "email": "u@v.w", "role": "MEMBER", "totpEnabled": False, "emailVerifiedAt": None}
    )
    p1 = security.decode_access_token(t1)
    assert p1 is not None and p1.ev is False

    t2 = security.sign_access_token(
        {"id": "u1", "email": "u@v.w", "role": "MEMBER", "totpEnabled": False, "emailVerifiedAt": "2026-01-01T00:00:00Z"}
    )
    p2 = security.decode_access_token(t2)
    assert p2 is not None and p2.ev is True


def test_refresh_token_mint_and_hash():
    a = security.mint_refresh_token()
    b = security.mint_refresh_token()
    assert a != b
    # 48 bytes → ~64-char base64url string.
    assert len(a) >= 60
    # base64url decodable.
    base64.urlsafe_b64decode(a + "=" * (-len(a) % 4))

    h = security.hash_refresh_token(a)
    assert len(h) == 64  # sha256 hex
    assert all(c in "0123456789abcdef" for c in h)
    assert security.hash_refresh_token(a) == h  # deterministic


def test_totp_secret_and_verify():
    secret = security.generate_totp_secret()
    # otplib + pyotp both use base32; length 32 by default.
    assert len(secret) == 32
    assert set(secret).issubset(set("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"))
    code = pyotp.TOTP(secret).now()
    assert security.verify_totp(code, secret) is True
    assert security.verify_totp("000000", secret) is False
    assert security.verify_totp("not-numeric", secret) is False


def test_totp_window_tolerance():
    # ±1 30-second window should be honored. Generate a code one step in the
    # past and confirm it still verifies — matches `authenticator.options = {window:1}`.
    secret = security.generate_totp_secret()
    totp = pyotp.TOTP(secret)
    prev_code = totp.at(int(time.time()) - 30)
    assert security.verify_totp(prev_code, secret) is True


def test_totp_uri_includes_issuer_and_email():
    s = get_settings()
    uri = security.totp_uri("vineel@example.com", "JBSWY3DPEHPK3PXP")
    assert uri.startswith("otpauth://totp/")
    assert f"issuer={s.TOTP_ISSUER}" in uri
    assert "vineel%40example.com" in uri or "vineel@example.com" in uri


def test_set_auth_cookies_emits_both_with_expected_attrs():
    resp = Response()
    security.set_auth_cookies(resp, "AT-VAL", "RT-VAL")
    cookies = resp.headers.getlist("set-cookie")
    assert len(cookies) == 2
    by_name = {c.split("=", 1)[0]: c for c in cookies}
    assert security.ACCESS_COOKIE in by_name
    assert security.REFRESH_COOKIE in by_name
    for c in cookies:
        # HttpOnly + Path=/ + SameSite present — exact parity with Nest's clearCookie/setCookie.
        assert "HttpOnly" in c
        assert "Path=/" in c
        assert "SameSite=" in c


def test_clear_auth_cookies_sets_both_with_max_age_zero():
    resp = Response()
    security.clear_auth_cookies(resp)
    cookies = resp.headers.getlist("set-cookie")
    assert len(cookies) == 2
    for c in cookies:
        # FastAPI's delete_cookie emits Max-Age=0; that's the browser's eviction signal.
        assert "Max-Age=0" in c
        assert "Path=/" in c


def test_extract_access_token_prefers_cookie_over_bearer():
    tok = security.extract_access_token(
        cookies={security.ACCESS_COOKIE: "from-cookie"},
        authorization_header="Bearer from-header",
    )
    assert tok == "from-cookie"


def test_extract_access_token_falls_back_to_bearer():
    tok = security.extract_access_token(
        cookies={},
        authorization_header="Bearer just-the-header",
    )
    assert tok == "just-the-header"


def test_extract_access_token_returns_none_when_neither_present():
    assert security.extract_access_token(cookies={}, authorization_header=None) is None
    assert security.extract_access_token(cookies={}, authorization_header="Basic xyz") is None


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
