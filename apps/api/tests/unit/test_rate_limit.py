"""Unit tests for app.core.rate_limit - 6th request in window must be 429."""

from __future__ import annotations

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.exception_handlers import register_exception_handlers


@pytest.fixture
def client_with_rate_limited_route():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get(
        "/test/limited",
        dependencies=[Depends(rate_limit.rate_limit(limit=5, window=60, prefix="test-suite"))],
    )
    def limited():
        return {"ok": True}

    rate_limit.reset_for_tests()
    return TestClient(app)


def test_first_five_succeed_sixth_429(client_with_rate_limited_route):
    c = client_with_rate_limited_route
    for _ in range(5):
        r = c.get("/test/limited")
        assert r.status_code == 200
    r = c.get("/test/limited")
    assert r.status_code == 429
    body = r.json()
    # Parity shape with Nest: {statusCode:429, message, retryAfterSeconds, error}.
    assert body["statusCode"] == 429
    assert body["message"] == "Too many requests"
    assert "retryAfterSeconds" in body
    assert isinstance(body["retryAfterSeconds"], int)
    assert body["retryAfterSeconds"] >= 1
    assert "error" in body  # handler tacks on the HTTP status phrase
    assert r.headers.get("retry-after") is not None


def test_separate_routes_have_independent_buckets():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/a", dependencies=[Depends(rate_limit.rate_limit(limit=2, window=60, prefix="sep"))])
    def a():
        return {"ok": "a"}

    @app.get("/b", dependencies=[Depends(rate_limit.rate_limit(limit=2, window=60, prefix="sep"))])
    def b():
        return {"ok": "b"}

    rate_limit.reset_for_tests()
    c = TestClient(app)
    for _ in range(2):
        assert c.get("/a").status_code == 200
    # /a is now exhausted, but /b still has its own bucket.
    assert c.get("/a").status_code == 429
    assert c.get("/b").status_code == 200
    assert c.get("/b").status_code == 200
    assert c.get("/b").status_code == 429
