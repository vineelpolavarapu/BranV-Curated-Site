# BranV API - Python / FastAPI

Python port of `apps/api` (NestJS). See [../../NESTJS_TO_FASTAPI_MIGRATION_PLAN.md](../../NESTJS_TO_FASTAPI_MIGRATION_PLAN.md) for the full migration playbook.

## Quick start

```bash
# from this directory
uv sync                                      # install deps into .venv
uv run uvicorn app.main:app --port 5000 --reload
```

Then:

```bash
curl http://localhost:5000/api/health
curl -i http://localhost:5000/api/ready
```

## Env vars

Reads `.env` at the repo root (same file NestJS uses). No renames - all `apps/api` env names work as-is. The only new vars introduced by the Python service:

- `SCHEDULER_OWNER` - `fastapi` | `nest` | `none` (default `none`). Belt-and-braces gate so schedulers do not double-fire during the dev parallel-run period.
- `PY_LOG_LEVEL` - `debug` | `info` | `warning` | `error` (default `info`).
- `API_INTERNAL_PORT` - defaults to 5000 (Nest uses 4000 via `API_PORT`).

## Layout

```
app/
  main.py            # FastAPI bootstrap (CORS, X-Request-Id, exception handlers)
  core/              # cross-cutting: security, auth_deps, rate_limit, settings, logging
  api/v1/            # routers per domain
  services/          # business logic
  repositories/      # SQLAlchemy queries
  schemas/           # Pydantic request/response models
  db/
    session.py       # async engine + get_db dependency
    models/          # SQLAlchemy 2.x declarative models (read-shaped)
  integrations/      # cuelinks, amazon, earnkaro, resend, s3, scraper
  jobs/              # APScheduler job functions
scripts/             # check_schema_parity, etc.
tests/               # pytest + httpx.AsyncClient
```

## Rules

- **Prisma owns the database schema.** No Alembic migrations from Python. See [`app/db/__init__.py`](app/db/__init__.py) for the prohibition statement.
- **Cookie names exactly match NestJS:** `branv_access`, `branv_refresh`.
- **JWT secret + payload shape exactly match NestJS** so the two services accept each other's tokens during the dev parallel-run period.
- **Pydantic v2 `ConfigDict(extra='forbid')`** mirrors Nest's `forbidNonWhitelisted: true`.
- **All env var names match `apps/api`.** No renames.
