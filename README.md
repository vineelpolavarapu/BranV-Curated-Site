# BranV
**BranV is a curated men's fashion discovery platform that turns scattered affiliate shopping links into a single, trustworthy storefront — and doubles as a production-grade, full-stack engineering showcase.**


## What This Project Is

Usually Men shopping online for fashion face two problems: product recommendations are scattered across influencer posts, marketplaces, and affiliate links with no quality filter, and there's no single trusted place that curates "what's actually good" instead of "what pays the most commission."

SO I Build a platform that curates men's fashion products from multiple affiliate networks (Amazon Associates, EarnKaro) into one clean, searchable storefront — with an admin behind the scenes vetting what gets listed — while keeping infrastructure costs near zero and the system genuinely production-ready, not a prototype.

I Designed and built the full system end-to-end:
- A modern storefront (Next.js + React) that shoppers browse, backed by a Python API (FastAPI) that does all the real work behind the scenes — managing the product catalog, validating and routing affiliate links to the right network, powering the admin curation workflows, and serving fast, reliable endpoints for the frontend — all on top of a PostgreSQL database.
- Secure member accounts and a separate admin dashboard protected by two-factor authentication, so only I can curate the catalog.
- Full-text and typo-tolerant product search, so shoppers find what they want fast.
- Automated deployment pipelines (CI/CD via GitHub Actions) and containerized infrastructure (Docker) hosted across free-tier cloud services (Oracle Cloud, Cloudflare, Vercel) with nightly automated database backups — enterprise-grade reliability on a startup budget.

A live, publicly deployed product at **www.branv.in** that gives shoppers one trustworthy place to discover curated men's fashion, and gives the business a monetization engine through affiliate commissions. Beyond the product itself, the build demonstrates hands-on ownership of the full engineering lifecycle: architecture design, secure authentication, database modeling, DevOps/CI-CD, cloud deployment, and cost-conscious infrastructure decisions — the kind of end-to-end responsibility expected of a production engineer, not just a coder.

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
