# BranV

Curated men's affiliate fashion platform. See `PRD_BranV.md` and `BUILD_GUIDE_BranV.md` for the full spec.

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend:** NestJS + Prisma + PostgreSQL
- **Cache / Queue:** Redis 7
- **Object storage:** MinIO locally (S3-compatible), Cloudflare R2 in prod
- **Monorepo:** pnpm workspaces

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker Desktop
- Git

## One-time setup

```powershell
# 1. Copy env file
Copy-Item .env.example .env

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (Postgres + Redis + MinIO)
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

# Start both apps in parallel
pnpm dev
```

Then:
- Web: http://localhost:3000
- Member auth: http://localhost:3000/login · /register
- Admin sign in: http://localhost:3000/admin/login
- API: http://localhost:4000/api/health
- API readiness: http://localhost:4000/api/ready
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
│   └── api/           # NestJS API
├── packages/
│   └── shared/        # Shared TS types between apps
├── docker-compose.yml
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
- [x] **Phase 10 — Admin Analytics & Audit:** dashboard KPIs + 14-day chart + low-conversion alerts, six analytics endpoints, filterable audit-log viewer, Redis-cached platform settings
- [ ] **Phase 11 — Hardening**
- [ ] **Phase 12 — Testing & CI/CD**
- [ ] **Phase 13 — Deployment**

## Notes

- External integrations (Cuelinks, Amazon, ESP) are mocked when `USE_MOCK_INTEGRATIONS=true` in `.env`. Flip to `false` and supply real keys to hit production APIs.
- Windows PowerShell users: chain commands with `;` instead of `&&` (e.g. `pnpm docker:up; pnpm dev`).
