"""
Parity harness - replays HTTP fixtures captured from NestJS (Step 1b) and
asserts FastAPI returns the same status + body + headers.

How it works:
  1. Loads every `*.http.json` under `tests/parity/fixtures/`.
  2. For each, sends the request to BOTH backends (NestJS on 4000, FastAPI on 5000).
  3. Normalizes volatile fields (timestamps, ids, JWTs, opaque tokens) on both
     responses using the SAME rules `capture-fixtures.ts` applied, then diffs.

Skipped fixtures: the auth-member journey makes stateful writes that mutate
the DB; replaying it against both backends in parallel creates conflicts.
Those go through the dedicated auth-crosswalk test instead.

Usage:
    # Both backends running locally first:
    #   pnpm --filter @branv/api run start          # NestJS on 4000
    #   uv run uvicorn app.main:app --port 5000     # FastAPI on 5000
    uv run pytest tests/parity/test_parity_runner.py -v
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import httpx
import pytest
from deepdiff import DeepDiff

REPO_ROOT = Path(__file__).resolve().parents[4]
FIXTURES_ROOT = REPO_ROOT / "tests" / "parity" / "fixtures"

NEST_BASE = os.environ.get("PARITY_NEST_URL", "http://127.0.0.1:4000")
PY_BASE = os.environ.get("PARITY_PY_URL", "http://127.0.0.1:5000")

# Endpoints whose state mutates between calls - covered by dedicated tests.
SKIP_DIRS = {"auth-member"}

VOLATILE_PATTERNS = [
    (re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z"), "<iso-datetime>"),
    (re.compile(r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT"), "<http-date>"),
    (re.compile(r"\bc[a-z0-9]{24}\b"), "<cuid>"),
    (re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b"), "<uuid>"),
    (re.compile(r"eyJ[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+"), "<jwt>"),
]
VOLATILE_HEADERS = {"date", "etag", "content-length", "keep-alive", "connection", "x-powered-by", "server"}
VOLATILE_FIELDS = {"latencyMs", "uptime", "duration", "durationMs", "tookMs"}


def _normalize(obj: Any) -> Any:
    j = json.dumps(obj)
    for pat, repl in VOLATILE_PATTERNS:
        j = pat.sub(repl, j)
    parsed = json.loads(j)
    return _strip_volatile_fields(parsed)


def _strip_volatile_fields(obj: Any) -> Any:
    if isinstance(obj, list):
        return [_strip_volatile_fields(v) for v in obj]
    if isinstance(obj, dict):
        return {k: ("<volatile>" if k in VOLATILE_FIELDS else _strip_volatile_fields(v)) for k, v in obj.items()}
    return obj


def _normalize_headers(headers: dict) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in VOLATILE_HEADERS}


def _discover_fixtures() -> list[tuple[str, Path]]:
    out: list[tuple[str, Path]] = []
    if not FIXTURES_ROOT.exists():
        return out
    for p in sorted(FIXTURES_ROOT.rglob("*.http.json")):
        if p.parent.name in SKIP_DIRS:
            continue
        out.append((f"{p.parent.name}/{p.stem}", p))
    return out


FIXTURES = _discover_fixtures()


@pytest.mark.parametrize("fixture_id,fixture_path", FIXTURES, ids=[f[0] for f in FIXTURES] or ["no-fixtures"])
@pytest.mark.asyncio
async def test_fixture_parity(fixture_id: str, fixture_path: Path | None):
    if fixture_path is None:
        pytest.skip("no fixtures discovered - run `pnpm --filter @branv/api run migration:capture-fixtures` first")
    fixture = json.loads(fixture_path.read_text())
    req = fixture["request"]
    async with httpx.AsyncClient(timeout=15.0) as client:
        nest = await _send(client, NEST_BASE, req)
        py = await _send(client, PY_BASE, req)

    assert nest.status_code == py.status_code, (
        f"{fixture_id}: status {nest.status_code} (nest) vs {py.status_code} (py)"
    )

    nest_body = _normalize(_parse_body(nest))
    py_body = _normalize(_parse_body(py))
    diff = DeepDiff(nest_body, py_body, ignore_order=False)
    assert not diff, f"{fixture_id} body diff:\n{diff.pretty()}"

    nest_headers = _normalize_headers({k.lower(): v for k, v in nest.headers.items()})
    py_headers = _normalize_headers({k.lower(): v for k, v in py.headers.items()})
    # Only compare a small set of contract-relevant headers; everything else is allowed to differ.
    for h in ("content-type", "cache-control", "location"):
        if h in nest_headers or h in py_headers:
            assert nest_headers.get(h) == py_headers.get(h), f"{fixture_id} header {h}: nest={nest_headers.get(h)} vs py={py_headers.get(h)}"


async def _send(client: httpx.AsyncClient, base: str, req: dict) -> httpx.Response:
    url = f"{base.rstrip('/')}{req['path']}"
    method = req["method"].upper()
    headers = {k: v for k, v in (req.get("headers") or {}).items() if k.lower() != "host"}
    body = req.get("body")
    if body is None:
        return await client.request(method, url, headers=headers)
    return await client.request(method, url, headers=headers, json=body)


def _parse_body(r: httpx.Response) -> Any:
    ct = r.headers.get("content-type", "")
    if "application/json" in ct:
        try:
            return r.json()
        except Exception:
            return r.text
    return r.text


# ───────────── auth crosswalk ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_auth_crosswalk_nest_to_py():
    """Cookie issued by NestJS must let FastAPI's /me succeed with matching body."""
    import time
    email = f"crosswalk-{int(time.time())}@branv.local"
    pw = "crosswalk-pw-1234"
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Register + login on Nest.
        await client.post(f"{NEST_BASE}/api/auth/register", json={"email": email, "password": pw})
        login = await client.post(f"{NEST_BASE}/api/auth/login", json={"email": email, "password": pw})
        assert login.status_code == 200, f"nest login failed: {login.status_code} {login.text}"
        cookies = login.cookies

        # Hit /me on both backends with the same cookies.
        nest_me = await client.get(f"{NEST_BASE}/api/auth/me", cookies=cookies)
        py_me = await client.get(f"{PY_BASE}/api/auth/me", cookies=cookies)

    assert nest_me.status_code == 200
    assert py_me.status_code == 200, f"py /me rejected nest cookie: {py_me.status_code} {py_me.text}"

    a = _normalize(nest_me.json())
    b = _normalize(py_me.json())
    diff = DeepDiff(a, b, ignore_order=False)
    assert not diff, f"crosswalk /me body diff:\n{diff.pretty()}"


@pytest.mark.asyncio
async def test_auth_crosswalk_py_to_nest():
    """Reverse: FastAPI-issued cookie must let NestJS's /me succeed."""
    import time
    email = f"crosswalk2-{int(time.time())}@branv.local"
    pw = "crosswalk-pw-5678"
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(f"{PY_BASE}/api/auth/register", json={"email": email, "password": pw})
        login = await client.post(f"{PY_BASE}/api/auth/login", json={"email": email, "password": pw})
        assert login.status_code == 200, f"py login failed: {login.status_code} {login.text}"
        cookies = login.cookies

        nest_me = await client.get(f"{NEST_BASE}/api/auth/me", cookies=cookies)
        py_me = await client.get(f"{PY_BASE}/api/auth/me", cookies=cookies)

    assert nest_me.status_code == 200, f"nest /me rejected py cookie: {nest_me.status_code} {nest_me.text}"
    assert py_me.status_code == 200
