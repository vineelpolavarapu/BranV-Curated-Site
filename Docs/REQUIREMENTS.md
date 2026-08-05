# BranV — Project Requirements

Everything you need to install and run BranV locally. The project is a **pnpm monorepo** with a Next.js 15 frontend and a FastAPI (Python 3.12) backend, backed by PostgreSQL 16.

---

## System Requirements

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| **Node.js** | 20.x LTS | Required for Next.js frontend and Prisma |
| **pnpm** | 9.0.0 | Monorepo package manager (`npm i -g pnpm@9`) |
| **Python** | 3.12 | Required for FastAPI backend |
| **uv** | 0.4+ | Python package manager (replaces pip/poetry) |
| **Docker** | 24+ | Runs Postgres, MinIO, Redis locally |
| **Docker Compose** | v2 (plugin) | Bundled with Docker Desktop on Windows/Mac |
| **Git** | any recent | |

> **Windows users:** Docker Desktop with WSL 2 backend is recommended.

---

## JavaScript / Frontend Dependencies

Managed by pnpm at the workspace level. No manual installation needed beyond `pnpm install`.

### Runtime (apps/web)

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^15.0.0 | React framework (App Router) |
| react / react-dom | ^19.0.0 | UI library |
| @tanstack/react-query | ^5.55.4 | Server-state / data fetching |
| zustand | ^4.5.5 | Client-side state management |
| tailwindcss | ^3.4.10 | Utility-first CSS |
| zod | ^3.23.8 | Schema validation |
| react-markdown | ^9.0.1 | Markdown rendering in UI |
| canvas-confetti | ^1.9.3 | Confetti animations |

### Dev / Build (root + apps/web)

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.5.4 | TypeScript compiler |
| prisma | ^5.22.0 | Database schema, migrations, and Prisma Studio |
| eslint + eslint-config-next | ^9 / ^15 | Linting |
| @tailwindcss/typography | ^0.5.15 | Prose styles |
| dotenv-cli | ^11.0.0 | Load `.env` for npm scripts |
| postcss / autoprefixer | ^8 / ^10 | CSS processing |

---

## Python / Backend Dependencies

Managed by **uv** (`pyproject.toml` in `apps/api/`).

### Runtime (apps/api)

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | >=0.115,<0.117 | Web framework |
| uvicorn[standard] | >=0.32 | ASGI server |
| pydantic / pydantic-settings | >=2.9 | Request/response validation, settings |
| sqlalchemy[asyncio] | >=2.0.36 | Async ORM (mirrors Prisma schema) |
| asyncpg | >=0.30 | PostgreSQL async driver |
| greenlet | >=3.1 | Required for SQLAlchemy async |
| pyjwt | >=2.10 | JWT authentication |
| argon2-cffi | >=23.1 | Password hashing |
| pyotp | >=2.9 | TOTP two-factor authentication |
| qrcode[pil] | >=8.0 | QR code generation for 2FA setup |
| httpx | >=0.28 | Async HTTP client (outbound requests) |
| aioboto3 | >=13.2 | Async S3 client (MinIO / Cloudflare R2) |
| boto3 | >=1.35 | S3 presigned URL generation |
| selectolax | >=0.3.27 | Fast HTML/CSS selector parsing |
| beautifulsoup4 | >=4.12 | HTML parsing for scraping |
| apscheduler | >=3.10 | Background job scheduling |
| structlog | >=24.4 | Structured JSON logging |
| python-multipart | >=0.0.18 | Multipart form / file uploads |

### Dev / Test (apps/api)

| Package | Version | Purpose |
|---------|---------|---------|
| pytest | >=8.3 | Unit testing |
| pytest-asyncio | >=0.24 | Async test support |
| pytest-cov | >=6.0 | Code coverage |
| ruff | >=0.8 | Linter and formatter |
| mypy | >=1.13 | Static type checking |
| deepdiff | >=8.0 | Deep object comparison in tests |
| email-validator | >=2.3 | Email format validation in tests |

---

## Database

| Service | Version | Purpose |
|---------|---------|---------|
| PostgreSQL | 16 | Primary database (spun up via Docker) |
| Prisma | ^5.22.0 | Schema definition and migration runner |

The local Postgres instance is managed by Docker Compose — no manual Postgres installation required.

---

## Object Storage

| Service | Local (dev) | Production |
|---------|-------------|------------|
| S3-compatible storage | MinIO 7 (Docker) | Cloudflare R2 |

MinIO is auto-started by Docker Compose. The bucket `branv-dev` is created automatically on first startup.

---

## Optional / Infrastructure (local dev only)

| Service | Version | Purpose |
|---------|---------|---------|
| Redis | 7-alpine (Docker) | Background job queue (included in docker-compose but not actively used in Phase 11+) |
| MinIO Console | — | Web UI at `http://localhost:9001` |
| Prisma Studio | bundled | Database GUI via `pnpm db:studio` |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values before starting:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (min 32 chars) |
| `S3_ENDPOINT` | MinIO endpoint (local) or Cloudflare R2 URL (prod) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Object storage credentials |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend → backend API base URL |
| `WEB_ORIGIN` | Allowed CORS origin for the backend |
| `USE_MOCK_INTEGRATIONS` | Set `true` locally to skip affiliate API calls |

---

## Installation Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd BranV

# 2. Install JavaScript dependencies (all workspaces)
pnpm install

# 3. Install Python dependencies
cd apps/api
uv sync
cd ../..

# 4. Start local infrastructure (Postgres, MinIO, Redis)
pnpm docker:up

# 5. Run database migrations and generate Prisma client
pnpm db:migrate
pnpm db:generate

# 6. Start the frontend dev server (port 3000)
pnpm dev:web

# 7. Start the backend dev server (port 5000)
pnpm dev:api
```

---

## Useful Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev — frontend | `pnpm dev:web` | Next.js on port 3000 |
| Dev — backend | `pnpm dev:api` | FastAPI / uvicorn on port 5000 |
| Build all | `pnpm build` | Build shared packages + Next.js |
| Lint | `pnpm lint` | ESLint on web app |
| Type check | `pnpm typecheck` | TypeScript check (no emit) |
| DB migrate | `pnpm db:migrate` | Apply all pending Prisma migrations |
| DB generate | `pnpm db:generate` | Regenerate Prisma client after schema changes |
| DB studio | `pnpm db:studio` | Open Prisma Studio in browser |
| Python tests | `pnpm py:test` | Run pytest suite |
| Python lint | `cd apps/api && uv run ruff check .` | Ruff linter |
| Docker up | `pnpm docker:up` | Start local infrastructure |
| Docker down | `pnpm docker:down` | Stop local infrastructure |
| Docker logs | `pnpm docker:logs` | Tail all container logs |

---

## Production Requirements

For deployment to a VPS (Oracle Cloud / any Ubuntu 22.04 server):

- Docker + Docker Compose v2
- A domain name with DNS pointing to the server
- Cloudflare R2 bucket (object storage)
- GitHub Container Registry access (for pulling the API image)

See [deploy/](deploy/) for production Docker Compose config, Caddyfile (TLS reverse proxy), and backup scripts.
