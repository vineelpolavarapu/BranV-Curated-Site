"""Validation error responses must match NestJS's ValidationPipe shape."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import EmailStr, Field

from app.core.exception_handlers import register_exception_handlers
from app.core.pydantic_config import ApiModel


class _RegisterPayload(ApiModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


def test_validation_error_shape_matches_nest_validationpipe():
    app = FastAPI()
    register_exception_handlers(app)

    @app.post("/test/register")
    def register(body: _RegisterPayload):  # noqa: ARG001 — validation alone
        return {"ok": True}

    client = TestClient(app)
    r = client.post("/test/register", json={"email": "not-an-email", "password": "short"})
    assert r.status_code == 400
    body = r.json()
    assert body["statusCode"] == 400
    assert body["error"] == "Bad Request"
    assert isinstance(body["message"], list)
    assert len(body["message"]) >= 2
    assert any("email" in m for m in body["message"])
    assert any("password" in m for m in body["message"])


def test_extra_fields_rejected():
    app = FastAPI()
    register_exception_handlers(app)

    @app.post("/test/register")
    def register(body: _RegisterPayload):  # noqa: ARG001
        return {"ok": True}

    client = TestClient(app)
    r = client.post(
        "/test/register",
        json={"email": "a@b.test", "password": "long-enough-pw", "rogue": "x"},
    )
    # Pydantic emits a 'extra_forbidden' error; our handler normalises to 400 + Nest shape.
    assert r.status_code == 400
    body = r.json()
    assert body["statusCode"] == 400
    assert any("rogue" in m for m in body["message"])
