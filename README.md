# BranV

Curated men's affiliate fashion platform. See `PRD_BranV.md` and `BUILD_GUIDE_BranV.md` for the full spec.

## Stack

### Application
- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + React 19
- **Backend:** FastAPI + Python 3.12 + Uvicorn
- **Database:** PostgreSQL 16
- **ORM / Migrations:** Prisma (schema + migrations), SQLAlchemy (read-only Python models generated from the Prisma schema)
- **Monorepo:** pnpm workspaces

### Infrastructure
- **Frontend hosting:** Vercel (free tier)
- **Backend hosting:** Oracle Cloud VM — Ubuntu 22.04, VM.Standard.E2.1.Micro (AMD x86, 1 GB RAM, Always Free)
- **Reverse proxy / TLS:** Caddy 2 (auto Let's Encrypt)
- **DNS / CDN / WAF:** Cloudflare (free tier)
- **Object storage:** Cloudflare R2 (S3-compatible) for product images + database backups
- **Container registry:** GitHub Container Registry (GHCR) — private
- **Orchestration:** Docker + Docker Compose v2
- **CI/CD:** GitHub Actions
- **Uptime monitoring:** UptimeRobot (planned)

### Integrations
- **Affiliate networks:** Cuelinks, Amazon Associates, EarnKaro
- **Email:** Transactional email provider (env-configured)

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- Python 3.12+ with `uv` (for API dev)
- Docker Desktop
- Git

## One-time setup

```powershell
# 1. Copy env file
Copy-Item .env.example .env

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (Postgres + MinIO)
pnpm docker:up

# 4. Run database migrations (creates auth + catalog tables)
pnpm db:migrate

# 5. Seed your first admin (CLI-only — admins cannot self-register)
pnpm seed:admin you@example.com "a-strong-password-here"

# 6. Seed the catalog taxonomy (categories + attribute schemas)
pnpm seed:catalog

# 7. Enable full-text + trigram search on products
pnpm setup:search
```

## Daily development

```powershell
# Start infra (if not already running)
pnpm docker:up

# Start both apps in parallel (Next.js web + FastAPI api)
pnpm dev
```

Then:
- Web: http://localhost:3000
- Member auth: http://localhost:3000/login · /register
- Admin sign in: http://localhost:3000/admin/login
- API: http://localhost:5000/api/health
- API readiness: http://localhost:5000/api/ready
- MinIO console: http://localhost:9001 (branv / branv-secret)

### Trying the auth flow

1. Register at `/register` with any email/password (≥8 chars).
2. **Mock mailer** — the verification link is logged to the API console
   (`pnpm dev` window). Copy the link and open it.
3. Sign in at `/login` → lands on `/account`.
4. Sign in as admin at `/admin/login` → prompted to set up TOTP 2FA → scan QR
   in your authenticator app → enter 6-digit code → land on `/admin`.

## Repo layout

```
branv/
├── apps/
│   ├── web/           # Next.js 15 storefront + admin shell
│   └── api/           # FastAPI (Python) API
├── packages/
│   └── shared/        # Shared TS types between apps
├── prisma/            # Prisma schema + migrations (source of truth)
├── deploy/            # Production compose, Caddyfile, backup scripts
├── docker-compose.yml # Local dev infra
├── .env.example
├── PRD_BranV.md
└── BUILD_GUIDE_BranV.md
```

## Phase status

- [x] **Phase 0 — Foundations:** scaffold + health endpoints + Docker infra
- [x] **Phase 1 — Identity:** member & admin auth, JWT + refresh rotation, TOTP 2FA, rate limiting, lockout, audit log
- [x] **Phase 2 — Brand & Catalog Core + Avatar Library:** brands, categories with attribute schemas, products with variants/images/retailer-listings, avatar library, S3 presigned uploads
- [x] **Phase 3 — Quick Add Workflow:** scrape-url autofill, Cuelinks/Amazon affiliate conversion, clipboard-paste image upload, bulk mode, localStorage draft, `N` shortcut, pending-conversion retry worker
- [x] **Phase 4 — Storefront Browse, Filters, Search:** public catalog with faceted filters (universal + category-specific), pg_trgm + tsvector search, autocomplete, product detail w/ schema.org, home + brand pages, mobile bottom nav, AI-rendered disclosure badge
- [x] **Phase 5 — Click-Out Flow + Nice Pick + Wardrobe:** `/go/:trackingId` redirect, Did-you-buy bottom sheet, Nice Pick confetti modal, member wardrobe + wishlist
- [x] **Phase 6 — Articles & Content Management:** markdown editor with product-embed slash command, schedule → publish worker, schema.org `Article` JSON-LD, dynamic sitemap + robots
- [x] **Phase 7 — Drops, Lookbooks, Edits, Home Banners:** drop scheduler with notify-me emails + countdown UI, shoppable lookbook hotspots, The Edit collections, scheduled banners, XSS-safe brand stories
- [x] **Phase 8 — Reviews, Newsletter, Notifications:** wardrobe-gated reviews + admin moderation, double-opt-in newsletter, outbox-pattern notification engine with bell icon + member preferences
- [x] **Phase 9 — Affiliate Sync + Reconciliation:** nightly price/availability sync with wishlist price-drop notifications, CSV-upload reconciliation (Cuelinks/Amazon/EarnKaro auto-detect), idempotent by file hash, admin variance dashboard
- [x] **Phase 10 — Admin Analytics & Audit:** dashboard KPIs + 14-day chart + low-conversion alerts, six analytics endpoints, filterable audit-log viewer, in-process platform-settings cache
- [x] **Phase 11 — Hardening:** dropped Redis (in-process caches + Postgres `click_intent` table), FastAPI migration from NestJS, low-memory Postgres tuning, JWT secret rotation strategy
- [ ] **Phase 12 — Testing & CI/CD**
- [x] **Phase 13 — Deployment (in progress):** frontend live on Vercel at [www.branv.in](https://www.branv.in); backend deploying to Oracle Cloud VM at `api.branv.in` behind Caddy + Cloudflare

## Deployment

Production deployment lives in [`deploy/`](deploy/). Full step-by-step runbook and current progress log:
- [deploy/DEPLOYMENT_PROGRESS.md](deploy/DEPLOYMENT_PROGRESS.md) — source-of-truth runbook (phases 1–11 done, steps 12–22 tracked)
- [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) — original generic runbook
- [deploy/docker-compose.yml](deploy/docker-compose.yml) — production compose (Caddy + FastAPI + Postgres + one-shot migrate)
- [deploy/Caddyfile](deploy/Caddyfile) — reverse-proxy + TLS config
- [deploy/backup.sh](deploy/backup.sh) — nightly `pg_dump` → Cloudflare R2

### Live URLs
- **Storefront:** https://www.branv.in
- **API:** https://api.branv.in/api/health

## Notes

- External integrations (Cuelinks, Amazon, ESP) are mocked when `USE_MOCK_INTEGRATIONS=true` in `.env`. Flip to `false` and supply real keys to hit production APIs.
- Windows PowerShell users: chain commands with `;` instead of `&&` (e.g. `pnpm docker:up; pnpm dev`).
- Prisma remains the single source of truth for the database schema. The FastAPI backend reads the schema via auto-generated SQLAlchemy models; production migrations run in a one-shot `migrate` container before the API starts.
