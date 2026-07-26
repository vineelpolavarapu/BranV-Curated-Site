# BranV — Codebase Gap Analysis & Audit Report

**Date:** 2026-07-24
**Scope:** Full stack — frontend (Next.js 15 / React 19), backend (FastAPI / Python), database (Postgres via Prisma + SQLAlchemy), CI/CD (GitHub Actions), deployment (Docker Compose + Caddy on an Oracle Cloud VM), and security posture.
**Method:** Four parallel specialist reviews (backend, frontend, database, CI/CD) reading the actual source, followed by first-hand verification of every CRITICAL/HIGH finding against the code. Findings that could not be reproduced in the source were corrected or dropped.

> Severity key — **CRITICAL:** exploitable now / data loss / silent security bypass. **HIGH:** serious correctness or security gap, likely to bite in production. **MEDIUM:** real defect with limited blast radius or preconditions. **LOW:** hygiene, maintainability, latent traps.

---

## 1. Executive Summary

The codebase is generally well-structured (clean service/router separation, Decimal money throughout, httpOnly-cookie sessions, ORM-only queries with no SQL injection, exact Prisma↔SQLAlchemy enum parity, no secrets committed to git). The serious problems cluster in **three areas**: an admin **2FA that does nothing**, a **CI pipeline that never tests the Python backend**, and **two competing sources of truth** (Prisma schema copies, Vercel vs Actions deploy) that have already drifted.

### Findings by severity

| Severity | Count | Headline items |
|----------|-------|----------------|
| CRITICAL | 4 | 2FA login bypass; Python API untested in CI; article stored-XSS; deploy-schema drift breaks migrations |
| HIGH | 10 | Affiliate redirect crashes on every click; rate limiter defeated behind proxy; refresh ignores account status; SSRF via scraper; analytics rollup wipes reconciled commissions; unencrypted backups holding TOTP secrets; migrate-without-backup |
| MEDIUM | ~18 | JSON-LD XSS; wildcard image-host SSRF; cookie-secure default off; missing FK indexes; email case-sensitivity; no resource limits; stale runbook |
| LOW | ~12 | duplicate collection pages, empty-named migrations, secret rotation, etc. |

### The five things to fix first

1. **Enforce TOTP at login** — admin 2FA is currently decorative (§2.1).
2. **Fix the affiliate redirect crash** — `ClickEvent(createdAt=…)` 500s every click-out (§2.2).
3. **Make CI actually test the API** — add a `pytest`/`ruff`/`mypy`/schema-parity job (§5.1, §5.2).
4. **Kill the duplicate Prisma schema** — `deploy/prisma` has already drifted and will break `migrate deploy` (§4.1, §5.3).
5. **Sanitize article HTML** — add `rehype-sanitize` to close stored XSS on public pages (§3.1).

---

## 2. Backend — Security & Correctness

### 2.1 CRITICAL — Admin 2FA is never verified at login (full bypass)
**Location:** [`apps/api/app/services/auth_service.py:195-269`](apps/api/app/services/auth_service.py#L195-L269), guard at [`apps/api/app/core/auth_deps.py:118-129`](apps/api/app/core/auth_deps.py#L118-L129)

`login()` accepts a `totpCode` parameter but **never calls `security.verify_totp(...)`** and never checks `totpEnabled`. It validates password + account status + role, then mints tokens. The access token's `totp` claim is set to `totpEnabled` (whether 2FA is *configured*), not whether a code was *presented*. `enforce_two_factor` only rejects admins who have **not** set up 2FA — an admin who *has* enabled 2FA passes the guard with **password only, no code**.

**Impact:** Anyone with an admin's password (phished, reused, leaked) gets a full admin session. The entire TOTP subsystem (setup, QR, secret storage, `pyotp`) provides zero runtime protection.
**Fix:** In `login()`, after the password check, require a non-null `totpCode` when `user.totpEnabled` and call `security.verify_totp(totpCode, user.totpSecret)`; raise `401 {"totpRequired": true}` when missing/invalid. Verify against the original NestJS `login` which almost certainly did this.

### 2.2 HIGH — Affiliate redirect throws on every click (`ClickEvent(createdAt=…)`)
**Location:** [`apps/api/app/services/clicks_service.py:117-132`](apps/api/app/services/clicks_service.py#L117-L132) (specifically `createdAt=now` at line 131)

`ClickEvent` has **no `createdAt` column** — only `redirectedAt` ([`db/models/click_event.py:34`](apps/api/app/db/models/click_event.py#L34); Prisma [`schema.prisma:389-404`](prisma/schema.prisma#L389-L404)). Passing `createdAt=now` to the declarative constructor raises `TypeError: 'createdAt' is an invalid keyword argument for ClickEvent`. This runs inside `consume_redirect`, which backs the **live** `GET /go/{tracking_id}` route (mounted in [`main.py:121`](apps/api/app/main.py#L121)).

**Impact:** Every affiliate click-out — the core monetization path — 500s, no `ClickEvent` is recorded, and the user never reaches the retailer. Revenue and analytics both break.
**Fix:** Remove `createdAt=now` from the `ClickEvent(...)` construction. Add a service-level test that drives `/go/{tracking_id}` end-to-end (this class of bug is exactly what §5.1 would have caught).

### 2.3 HIGH — Refresh does not re-check account status
**Location:** [`apps/api/app/services/token_service.py:72-123`](apps/api/app/services/token_service.py#L72-L123)

`rotate()` loads the user and mints a new access token but never checks `status == "ACTIVE"` (login does, at `auth_service.py:212`). A suspended/deleted user keeps refreshing 15-min access tokens for the full 7-day refresh TTL.
**Impact:** Suspension/ban is unenforceable without also revoking every refresh token. Role downgrades also don't take effect until the refresh token expires.
**Fix:** In `rotate()`, reject non-`ACTIVE` users and revoke the token family; re-read `role`/`emailVerified` from the DB rather than trusting the stored row.

### 2.4 HIGH — Rate limiter is per-process, in-memory, and proxy-blind
**Location:** [`apps/api/app/core/rate_limit.py:44-97`](apps/api/app/core/rate_limit.py#L44-L97) (IP resolution at lines 48-56); compounded by Caddy config at [`deploy/Caddyfile:24-29`](deploy/Caddyfile#L24-L29)

Two independent defects combine:
- `_client_ip` reads `request.client.host` and **explicitly ignores `X-Forwarded-For`**. Behind Caddy/Cloudflare, every request carries the proxy's IP, so all users collapse into one bucket. Caddy itself forwards `{remote_host}` (the TCP peer = Cloudflare edge) without `trusted_proxies`, so the real client IP is lost before it even reaches the app.
- Buckets live in a module-level dict, so with multiple uvicorn workers/replicas the effective limit is `limit × workers`.

**Impact:** Login brute-force / credential-stuffing throttling is either globally shared (one client locks out everyone) or multiplied by worker count (largely bypassed). Audit-log and lockout IPs are also wrong for forensics.
**Fix:** Parse the client IP from a trusted `X-Forwarded-For`/`CF-Connecting-IP` against a configured trusted-proxy list; configure Caddy `trusted_proxies` for Cloudflare CIDRs; back the limiter with a shared store (Redis) if more than one worker/replica runs.

### 2.5 HIGH — SSRF via the server-side scraper
**Location:** [`apps/api/app/integrations/scraper.py`](apps/api/app/integrations/scraper.py) (`_fetch_html`), reached from `/api/admin/products/scrape-url` ([`products_admin.py`](apps/api/app/api/v1/products_admin.py)) and `price_sync` ([`scheduler.py`](apps/api/app/jobs/scheduler.py))

`_fetch_html` does `httpx.get(url, follow_redirects=True)` on a caller-supplied URL with no scheme/host allow-list and no block on private/link-local ranges. Combined with §2.1 (admin is a low bar), an attacker posts `http://169.254.169.254/latest/meta-data/...` (Oracle/cloud metadata) or internal service URLs and the server fetches and returns parsed content. `follow_redirects=True` defeats naive front-door host checks.
**Impact:** Cloud-metadata credential theft, internal port scanning.
**Fix:** Restrict to `http/https`, resolve and reject private/loopback/link-local/ULA IPs before the request **and after each redirect** (or disable redirects and re-validate); restrict to the known retailer host allow-list already implied by `detect_retailer`.

### 2.6 HIGH/MEDIUM — Analytics conversions rollup clobbers reconciled commissions
**Location:** [`apps/api/app/jobs/scheduler.py:208-236`](apps/api/app/jobs/scheduler.py#L208-L236)

Unlike the clicks rollup (pure `ON CONFLICT`), the conversions rollup does `DELETE FROM analytics_daily_conversions WHERE day >= :cutoff` then re-`INSERT` with `reconciledCommissionInr = 0::numeric`. The schema comment ([`schema.prisma:888-891`](prisma/schema.prisma#L888-L891)) states reconciliation writes `reconciledCommissionInr` on a *separate pass* — but this hourly DELETE wipes that value.
**Impact:** Once the reconciliation pass exists (or already, if it runs), reconciled-commission dashboards are permanently reset to ~0 within the hour. Real, recurring data loss.
**Fix:** Never `DELETE` the row; make it a true `ON CONFLICT DO UPDATE` touching only the self-reported columns, and let the reconciliation pass own the commission columns.

### 2.7 MEDIUM — Insecure cookie defaults, not enforced in production
**Location:** [`apps/api/app/core/settings.py:54-56`](apps/api/app/core/settings.py#L54-L56)

`COOKIE_SECURE` defaults to `False` and `COOKIE_SAMESITE` to `"lax"`, flowing into the `branv_access`/`branv_refresh` cookies. Nothing ties `NODE_ENV=production` to `COOKIE_SECURE=true`.
**Impact:** If prod forgets the override, auth cookies traverse plain HTTP (MITM/sslstrip).
**Fix:** Add a settings validator that forces `COOKIE_SECURE=True` when `NODE_ENV == "production"` (fail startup otherwise).

### 2.8 MEDIUM — Public, unauthenticated, unbounded writes
**Location:** [`apps/api/app/api/v1/clicks.py:24-34`](apps/api/app/api/v1/clicks.py#L24-L34), [`apps/api/app/api/v1/engagement.py:636-665`](apps/api/app/api/v1/engagement.py#L636-L665)

`POST /api/clicks/track` and `POST /api/newsletter/subscribe` have **no rate-limit dependency**. `subscribe` accepts `email: str` with **no format validation** (auth uses `PermissiveEmailStr`; this doesn't). Unconsumed `ClickIntent` rows have `expiresAt` but nothing GCs them.
**Impact:** Scripted calls bloat `click_intents`/`newsletter_subscribers`; newsletter list poisoning with garbage addresses.
**Fix:** Add `rate_limit(...)` to both; validate the email; add a periodic GC for expired `ClickIntent` rows.

### 2.9 MEDIUM — Password reset holds a DB transaction open across the mail call
**Location:** [`apps/api/app/services/auth_service.py:404-416`](apps/api/app/services/auth_service.py#L404-L416)

Unlike `register`/`resend_verification` (commit, then best-effort background send), `forgot_password` does `flush()` then `await send_password_reset(...)` **before** `commit()`. A slow/failed Resend call ties up a pooled connection and, on error, 500s and rolls back the reset token.
**Fix:** Mirror the register flow — commit first, send via `background.add_task(...)`.

### 2.10 LOW — TOTP window widened to ±90s, no replay protection
**Location:** [`apps/api/app/core/security.py:182-194`](apps/api/app/core/security.py#L182-L194)

`verify_totp` uses `valid_window=3` (up to 7 valid codes at once) while the docstring still claims "±1 window," and there is no last-used-step tracking, so a code is replayable for ~3 minutes. Moot until §2.1 is fixed, then relevant.
**Fix:** Reduce to `valid_window=1`, fix clock drift with NTP; track and reject the last-consumed step.

### 2.11 LOW — Presign trusts client Content-Type / owner path
**Location:** [`apps/api/app/integrations/s3.py:78-99`](apps/api/app/integrations/s3.py#L78-L99), [`apps/api/app/schemas/uploads.py:23-29`](apps/api/app/schemas/uploads.py#L23-L29)

MIME is regex-restricted to `image/*` (blocks stored-XSS via `text/html` — good), but `ownerId` is caller-supplied into the object key and the extension isn't cross-checked against the declared content-type.
**Fix:** Derive `ownerId` server-side from the token; validate extension↔content-type agreement.

> **Verified OK (backend):** no dynamic SQL / injection (raw SQL uses bound params and correctly quotes camelCase columns); 500 handler leaks no stack traces ([`exception_handlers.py:95-102`](apps/api/app/core/exception_handlers.py#L95-L102)); member endpoints consistently filter by `userId`; admin routers uniformly apply `require_roles("ADMIN")`; no mass-assignment of `role`; CORS is a single explicit origin, not a wildcard ([`main.py:72-79`](apps/api/app/main.py#L72-L79)); refresh-token reuse detection and reset-triggered session invalidation are implemented.

---

## 3. Frontend — Security & Correctness

### 3.1 CRITICAL — Stored XSS in article bodies (`rehype-raw`, no sanitizer)
**Location:** [`apps/web/src/components/article/ArticleBody.tsx:63-69`](apps/web/src/components/article/ArticleBody.tsx#L63-L69) (and the editor preview [`components/admin/ArticleEditor.tsx:211-232`](apps/web/src/components/admin/ArticleEditor.tsx#L211-L232))

`ReactMarkdown` is configured with `rehypePlugins={[rehypeRaw]}` and **no `rehype-sanitize`**, so raw HTML in `article.bodyMd` reaches the DOM. `<img src=x onerror=...>` / `<script>` in an article body executes for every visitor of `/articles/[slug]`. The session cookie is httpOnly (not stealable), but injected script runs same-origin with `credentials:'include'` and can drive any authenticated action. Note `BrandStorySection.tsx` deliberately omits `rehype-raw` and claims the app is "XSS-safe" — that guarantee is false for articles.
**Fix:** Add `rehype-sanitize` after `rehype-raw` with a strict schema, or drop `rehype-raw`.

### 3.2 HIGH — JSON-LD injection via `dangerouslySetInnerHTML`
**Location:** [`apps/web/src/app/products/[slug]/page.tsx:349-354`](apps/web/src/app/products/[slug]/page.tsx#L349-L354), [`apps/web/src/app/articles/[slug]/page.tsx:199-204`](apps/web/src/app/articles/[slug]/page.tsx#L199-L204)

`dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}` — `JSON.stringify` does not escape `<`/`>`, so a field (e.g. scraped product `title`/`brand.name`) containing `</script><script>…</script>` breaks out of the `<script type="application/ld+json">` block and executes.
**Fix:** Escape before injection — `.replace(/</g, '\\u003c')` on the stringified JSON (also `>` and `&`).

### 3.3 MEDIUM — Wildcard image host = open proxy / SSRF surface
**Location:** [`apps/web/next.config.mjs:14`](apps/web/next.config.mjs#L14)

`remotePatterns` ends with `{ protocol: 'https', hostname: '**' }`, allowlisting **every** HTTPS host for `/_next/image`, turning the optimizer into an open proxy (SSRF/bandwidth abuse).
**Fix:** Remove the `**` wildcard; enumerate real retailer/CDN hosts, or keep storefront images `unoptimized` and drop broad patterns.

### 3.4 MEDIUM — Admin area gated only by cookie presence, then client-side role
**Location:** [`apps/web/src/middleware.ts:13-30`](apps/web/src/middleware.ts#L13-L30), [`apps/web/src/components/AdminShell.tsx:199-216`](apps/web/src/components/AdminShell.tsx#L199-L216)

Middleware checks only `!!cookies.get('branv_access')` (it can't decode the JWT at the edge). A logged-in **member** passes middleware for `/admin/*`, downloads the admin bundles, and sees a shell flash before `AdminShell` redirects via `/auth/me`. Safe **only because** the backend authorizes every admin endpoint (verified — see §2 note). Any admin page not wrapped in `AdminShell` would have no client gate at all.
**Fix:** Confirm every `app/admin/**` page renders inside `AdminShell`; consider a verified session/claim check in middleware so non-admins never receive admin routes.

### 3.5 MEDIUM — No CSRF token; relies entirely on the cookie
**Location:** [`apps/web/src/lib/api.ts:23-30`](apps/web/src/lib/api.ts#L23-L30)

`apiFetch` authenticates via `credentials:'include'` with no CSRF token. The forced `Content-Type: application/json` raises the bar (forces preflight) but is not a guarantee. Depends on the cookie being `SameSite=Lax/Strict` (see §2.7).
**Fix:** Ensure `SameSite=Lax`+`Secure`; add double-submit CSRF token if any endpoint accepts simple content types.

### 3.6 MEDIUM — API outage renders as 404 (SEO deindexing risk)
**Location:** [`apps/web/src/lib/api-server.ts:23-34`](apps/web/src/lib/api-server.ts#L23-L34)

`apiServer` returns `null` for both a genuine 404 **and** a backend 5xx/network error, and callers map `null → notFound()` (e.g. product/article/category pages). A transient API failure serves hard 404s to Google → valid URLs risk deindexing.
**Fix:** Throw on 5xx/network (render `error.tsx`); reserve `null`/`notFound()` for real 404s.

### 3.7 MEDIUM — Sitemap category list is hardcoded (drift)
**Location:** [`apps/web/src/app/sitemap.ts:20-33`](apps/web/src/app/sitemap.ts#L20-L33)

`CATEGORY_SLUGS` is a static array that diverges from DB categories (dead URLs / missing new categories); the six collection pages are absent entirely.
**Fix:** Derive category entries from the `/categories` API.

### 3.8 LOW/MEDIUM — `unoptimized` hero/gallery images hurt LCP
**Location:** [`apps/web/src/app/products/[slug]/page.tsx:132-171`](apps/web/src/app/products/[slug]/page.tsx#L132-L171) and others — full-size retailer images with no resizing (product hero is `priority` + `unoptimized`).
**Fix:** Route trusted hosts through the optimizer (paired with §3.3) or pre-resize on ingest.

### 3.9 LOW — Reviews load has no error state
**Location:** [`apps/web/src/components/reviews/ReviewsSection.tsx:23-37`](apps/web/src/components/reviews/ReviewsSection.tsx#L23-L37) — a failed fetch shows "Be the first to review" (misleading); no stale-response guard.
**Fix:** Track load error separately from the empty state.

### 3.10 LOW — Six duplicated hardcoded collection pages
**Location:** `apps/web/src/app/{easy-casuals,classic-essentials,sharp-formals,trendy-wear,sports-wear,fashion-forward}/page.tsx` — near-identical wrappers around `CategoryCatalog`, differing only by slug/title. Routes resolve (not dead), but duplication invites drift.
**Fix:** One dynamic `(collections)/[collection]` route validated against `COLLECTION_SLUGS`.

### 3.11 LOW — Weak client password policy / no rate-limit feedback
Register/reset use `minLength={8}` only; a backend 429 surfaces as a generic error. (Positive: forgot-password always shows success to avoid account enumeration.)

> **Verified OK (frontend):** session in httpOnly cookie (not localStorage) — no token theft via XSS; `localStorage` access is SSR-guarded with try/catch; auth pages wrap `useSearchParams` in `Suspense`.

---

## 4. Database & Data Integrity

### 4.1 CRITICAL — `deploy/prisma` declares a column with no migration to create it
**Location:** [`deploy/prisma/schema.prisma:314`](deploy/prisma/schema.prisma#L314) vs `prisma/migrations/20260716120000_retailer_display_name_and_fallback_brand/` (present in root, **absent** from `deploy/prisma/migrations/`)

The deploy schema was hand-edited to add `retailerDisplayName` without copying the migration (root has 21 migrations, deploy has 20). `deploy/docker-compose.yml` mounts `./prisma` (= `deploy/prisma`).
**Impact:** `prisma migrate deploy` from the deploy tree never creates `product_retailer_listings.retailerDisplayName` and never runs the `unbranded` fallback-brand seed → runtime `column does not exist`, blank-brand product creation hits FK/NOT-NULL violations, and `migrate status` reports out-of-sync and blocks future deploys.
**Fix:** Delete `deploy/prisma/` entirely; generate/sync it from the single source of truth (see §5.3). If keeping it short-term, copy the missing migration folder.

### 4.2 HIGH — `ClickEvent.product` is `onDelete: Cascade` (analytics data loss)
**Location:** [`prisma/schema.prisma:393`](prisma/schema.prisma#L393) (and cascade to `self_reported_conversions` at `:419`; payout items only `SetNull` at `:851`)

Deleting a `Product` cascades away all its `click_events` and conversions, while affiliate payout items keep only a nulled link. Products already have `archivedAt` (soft delete), yet the FK is hard-cascade.
**Impact:** Deleting/replacing a product erases historical click-out & conversion analytics and makes previously-reconciled commissions unmatchable.
**Fix:** Change to `onDelete: Restrict` (force archive) or repoint click history to survive product deletion.

### 4.3 HIGH — Emails are unique but case-sensitive, no normalization
**Location:** [`prisma/schema.prisma:30`](prisma/schema.prisma#L30) (User), [`:708`](prisma/schema.prisma#L708) (newsletter)

`email @unique` on plain text with no `lower()`/citext. `User@x.com` and `user@x.com` become two accounts; lookups that don't lowercase miss rows.
**Fix:** Normalize to lowercase at write time (or `citext`) plus a `lower(email)` functional unique index.

### 4.4 MEDIUM — Foreign keys without indexes (slow, lock-heavy deletes)
**Location:** `ArticleProduct.productId` ([`:529`](prisma/schema.prisma#L529)), `EditProduct.productId` ([`:623`](prisma/schema.prisma#L623)), `LookbookTag.productId` ([`:583`](prisma/schema.prisma#L583)), `Product.subcategoryId`/`createdByAdminId` ([`:230-241`](prisma/schema.prisma#L230-L241)), `WardrobeItem.clickEventId` ([`:438`](prisma/schema.prisma#L438)). Postgres does not auto-index FK columns.
**Impact:** Product/admin deletion seq-scans these children; subcategory filtering is unindexed.
**Fix:** Add `@@index` on each of these FK columns.

### 4.5 MEDIUM — Storefront search is unindexed `lower(...) LIKE`
**Location:** [`apps/api/app/services/storefront_service.py:370-384`](apps/api/app/services/storefront_service.py#L370-L384) — `func.lower(title/name/slug) LIKE :pattern` with no functional/trigram index → sequential scan per search.
**Fix:** Add `pg_trgm` GIN indexes on `lower(title)`/`lower(name)`/`lower(slug)` via raw-SQL migration.

### 4.6 MEDIUM — `uniqueUsers` excludes all anonymous clicks
**Location:** [`apps/api/app/jobs/scheduler.py:198`](apps/api/app/jobs/scheduler.py#L198) — `count(DISTINCT userId) FILTER (WHERE userId IS NOT NULL)`, so anonymous storefront traffic (the majority) is uncounted despite `sessionId` being available.
**Fix:** Count by `COALESCE(userId, sessionId)`.

### 4.7 MEDIUM — `AnalyticsContentPerf` table exists but is never populated
**Location:** [`prisma/schema.prisma:928-941`](prisma/schema.prisma#L928-L941) — the rollup job writes only daily clicks/conversions; nothing inserts content-perf rows. The surface-level (article/edit/lookbook/home) analytics the schema promises don't exist.
**Fix:** Implement the content-perf rollup, or drop the table until needed.

### 4.8 MEDIUM — UTC-naive timestamps; rollups bucket on UTC midnight
**Location:** [`apps/api/app/jobs/scheduler.py:184-194`](apps/api/app/jobs/scheduler.py#L184-L194) — all columns are `TIMESTAMP(timezone=False)` and days are `date_trunc('day', redirectedAt)::date` in UTC. For an India/INR product, daily analytics boundaries are off by 5.5h from IST.
**Fix:** Choose a reporting timezone explicitly (`AT TIME ZONE 'Asia/Kolkata'`) or store `timestamptz`.

### 4.9 MEDIUM — No CHECK on `Review.rating` (1–5)
**Location:** [`prisma/schema.prisma:682`](prisma/schema.prisma#L682) — `rating Int` with no bound; a bad write corrupts the denormalized `avgRating` ([`:249`](prisma/schema.prisma#L249)).
**Fix:** Add `CHECK (rating BETWEEN 1 AND 5)` (and consider 0–100 checks on percent fields).

### 4.10 MEDIUM — Destructive migration dropped captured emails
**Location:** `prisma/migrations/20260519151739_remove_drops/` — dropped `drop_notify_signups` (which held launch-notify emails), unrecoverably. Dead enum values `DROP_LAUNCHING_SOON`/`DROP_LIVE` still linger in `NotificationType`.
**Fix:** None if intended; note for the audit trail and consider pruning the dead enum values.

### 4.11 LOW — Migration hygiene & latent `updatedAt` trap
Two empty-named migrations (`20260514175927_`, `20260515062510_`) and a duplicate `_init`. SA `updatedAt` columns have `onupdate` but no `server_default`, so any INSERT path that forgets to pass `updatedAt` hits a NOT-NULL violation.
**Fix:** Enforce named migrations going forward; add `server_default=CURRENT_TIMESTAMP` to `updatedAt` in the model generator.

> **Verified OK (database):** money is `Decimal`/`Numeric` everywhere (no float-money bug); all 19 Prisma enums map 1:1 to `db/enums.py`; the one raw-SQL rollup correctly double-quotes camelCase columns; slug/email/token uniqueness is enforced and indexed; the clicks rollup uses a composite PK + `ON CONFLICT` (no double-count).

---

## 5. CI/CD & Deployment

### 5.1 CRITICAL — The Python API is never tested, linted, or typechecked in CI
**Location:** [`.github/workflows/ci.yml:40,48`](.github/workflows/ci.yml#L40), gate at [`.github/workflows/deploy-api.yml`](.github/workflows/deploy-api.yml)

`apps/api` has **no `package.json`**, so it is not a pnpm workspace package. Every CI step filtered on `@branv/api` (`pnpm --filter @branv/api exec prisma generate`, `... @branv/api lint`) matches **zero projects** and passes as a no-op. There is no `setup-uv`/`pytest`/`ruff`/`mypy` step anywhere. The root `package.json` defines `py:test` and `py:schema-check` scripts that CI never invokes. The deploy gate keys on a "Typecheck & Lint" job that doesn't touch Python.
**Impact:** A broken endpoint, hashing change, or the §2.2 crash ships green to production; the only backstop is the runtime healthcheck.
**Fix:** Add a Python job to `ci.yml` (`astral-sh/setup-uv` → `uv sync` → `uv run pytest tests/unit` → `ruff check` → `mypy`) and make `check-ci-status` gate on it.

### 5.2 HIGH — Schema-parity check exists but is never run in CI
**Location:** [`apps/api/scripts/check_schema_parity.py`](apps/api/scripts/check_schema_parity.py), `apps/api/tests/parity/`

The whole architecture (SQLAlchemy models mirror the Prisma schema) depends on parity, but `py:schema-check` is not wired into CI. A Prisma migration that renames/adds a column with no model regen fails only at runtime.
**Fix:** Run `check_schema_parity.py` in CI and fail on drift.

### 5.3 HIGH — Two sources of truth for the Prisma schema (already drifted)
**Location:** `prisma/schema.prisma` vs `deploy/prisma/schema.prisma` (see §4.1)

`deploy-api.yml` scp's the **root** `prisma/` to the VM, but `deploy/docker-compose.yml` mounts `deploy/prisma`. The two have drifted (`retailerDisplayName`, 21 vs 20 migrations).
**Fix:** Single source of truth — delete `deploy/prisma`, or generate it from root in CI so it can never drift.

### 5.4 HIGH — Auto-migrate with no pre-migrate backup; image-only rollback
**Location:** [`.github/workflows/deploy-api.yml:261-315`](.github/workflows/deploy-api.yml#L261-L315)

Every deploy runs `prisma migrate deploy` automatically, then on healthcheck failure rolls back **only the image** (`docker tag PREV latest`). Migrations are forward-only and not backed up first.
**Impact:** A destructive migration + failing new image → image rolls back to old code running against an already-migrated, incompatible schema → stuck broken with no snapshot to restore.
**Fix:** `pg_dump` immediately before `migrate`; gate destructive migrations behind manual approval; document a schema-rollback procedure.

### 5.5 HIGH — Backups are unencrypted, unverified, unpruned — and hold TOTP secrets
**Location:** [`deploy/backup.sh`](deploy/backup.sh), [`deploy/install-backup-cron.sh`](deploy/install-backup-cron.sh)

`pg_dump | gzip | aws s3 cp` to R2 with no client-side encryption. The dump contains emails, argon2 hashes, and **cleartext TOTP secrets**. No retention/lifecycle, no restore test/checksum/alert; `install-backup-cron.sh` never installs the assumed `aws` CLI, so cron can fail silently.
**Impact:** An R2 token compromise leaks a full account-takeover kit; backups may silently not exist when needed.
**Fix:** Encrypt dumps client-side (`age`/`gpg`) before upload; add an R2 lifecycle policy; add a monthly restore-verification + failure alert; have the installer verify/install `awscli`.

### 5.6 HIGH — Vercel + GitHub Actions dual-deploy conflict not reconciled
**Location:** [`.github/workflows/ci.yml:61-213`](.github/workflows/ci.yml#L61-L213) vs [`deploy/DEPLOYMENT.md:321-335`](deploy/DEPLOYMENT.md#L321-L335)

CI deploys web via the Vercel CLI, but `DEPLOYMENT.md` still instructs enabling Vercel **Git integration** (auto-deploy on push) — the exact combination recorded as the prior local↔server-gap root cause. If Git integration is still on, every push triggers two racing deploys.
**Fix:** Keep the CLI-in-Actions path; disable Vercel Git integration; rewrite `DEPLOYMENT.md` STEP 12.

### 5.7 MEDIUM — Prod image built from a "not for production" Dockerfile, runs as root
**Location:** [`apps/api/Dockerfile`](apps/api/Dockerfile), built by [`deploy-api.yml`](.github/workflows/deploy-api.yml)

Header says "Local-dev … Production out of scope," yet it ships. No `USER` (uvicorn as root), `uv run` dev entrypoint, `COPY . .` with **no `apps/api/.dockerignore`** pulls `.venv`, caches, and tests into the image.
**Fix:** Non-root `USER`, prod entrypoint, `apps/api/.dockerignore`.

### 5.8 MEDIUM — No container resource limits on a 1 GB VM
**Location:** [`deploy/docker-compose.yml`](deploy/docker-compose.yml) — no `mem_limit`/`cpus` on any service. A memory spike in `api`/`migrate` (which runs `apt-get`+`npx prisma` at runtime) can trigger the host OOM-killer and take down Postgres.
**Fix:** Set `mem_limit`/`mem_reservation` per service sized to the 1 GB budget.

### 5.9 MEDIUM — Mutable `:latest` deployed; runtime `npx prisma@5` download
**Location:** [`deploy/docker-compose.yml`](deploy/docker-compose.yml) — API runs `...branv-api:latest` and the migrate step downloads Prisma from npm each deploy, even though `deploy-api.yml` pushes an immutable `sha-` tag.
**Fix:** Deploy the pinned `sha-<commit>` tag; pin `prisma@5.22`; prefer a prebaked migrate image.

### 5.10 MEDIUM — Caddy loses the real client IP (feeds §2.4)
**Location:** [`deploy/Caddyfile:24-29`](deploy/Caddyfile#L24-L29) — `header_up X-Forwarded-For {remote_host}` = Cloudflare edge IP; no `trusted_proxies`, doesn't read `CF-Connecting-IP`.
**Fix:** Configure `trusted_proxies` for Cloudflare CIDRs; forward `CF-Connecting-IP`.

### 5.11 MEDIUM — Stale operational runbook (`DEPLOYMENT.md`) and NestJS references
`DEPLOYMENT.md` describes the old stack (ARM/12 GB vs AMD/1 GB, port 4000/NestJS, a `backup` container that doesn't exist, a Node `seed-admin.js` on a Python API, build-on-VM flow). `Caddyfile` comments still say "NestJS." During an incident an operator would run commands against non-existent services.
**Fix:** Rewrite `DEPLOYMENT.md` to the FastAPI/GHCR/1 GB reality; fix Caddyfile comments.

### 5.12 LOW — Misc
- `diagnose-vm.yml` dumps raw app logs into Actions logs (PII risk if the app ever logs tokens/emails).
- `workflow_dispatch` bypasses the CI gate (untested code shippable by hand).
- No secret rotation policy; one long-lived SSH key does scp+ssh across all jobs.
- Single instance → brief 502 on deploy (acceptable at this scale).
- Local dev compose binds Postgres/Redis/MinIO to host ports with trivial creds (dev-only).

> **Verified OK (CI/CD):** no `.env`/private keys tracked in git (only `.env.example` files); the web build/typecheck/lint path is real; an immutable `sha-` image tag is produced (just not deployed).

---

## 6. Testing

- **API:** only 4 unit test files ([`test_pydantic_config`](apps/api/tests/unit/), `test_rate_limit`, `test_security`, `test_validation_error_shape`) plus a NestJS-parity harness. **No tests** for services, endpoints, auth flows, or authorization — the §2.1 (2FA bypass) and §2.2 (redirect crash) bugs would both have been caught by a single endpoint test.
- **Web:** **zero tests.** No unit, component, or E2E/Playwright.
- **CI:** runs none of the Python tests that do exist (§5.1).

**Fix:** Add API endpoint/integration tests (auth incl. 2FA, `/go` redirect, authorization matrix per role); add a smoke E2E for the storefront and admin login; wire all of it into CI as a merge gate.

---

## 7. Functional Gaps / Stubs Shipped as "Done"

- Home banners and featured edit return empty/None — [`storefront_service.py:301-311`](apps/api/app/services/storefront_service.py#L301-L311).
- Price-sync trigger returns `{"status":"queued"}` but the job body is a TODO stub — [`admin_ops.py:478`](apps/api/app/api/v1/admin_ops.py#L478).
- Price-sync drift threshold hardcoded to `5.0`, ignoring `PRICE_SYNC_DRIFT_THRESHOLD_PCT` — [`scheduler.py:318`](apps/api/app/jobs/scheduler.py#L318).
- Admin analytics dashboard flagged incomplete pending backend parity — [`admin/page.tsx:32`](apps/web/src/app/admin/page.tsx#L32).
- `AnalyticsContentPerf` never populated (§4.7).

---

## 8. Prioritized Remediation Roadmap

**P0 — this week (security & broken revenue path)**
1. Enforce TOTP at login (§2.1).
2. Fix `ClickEvent(createdAt=…)` crash + add a `/go` test (§2.2).
3. Add `rehype-sanitize` to article rendering (§3.1) and escape JSON-LD (§3.2).
4. Add SSRF guards to the scraper (§2.5).
5. Force `COOKIE_SECURE` in production (§2.7).

**P1 — this sprint (pipeline & data integrity)**
6. Add the Python CI job + schema-parity gate (§5.1, §5.2).
7. Collapse the Prisma schema to one source of truth (§4.1, §5.3).
8. `pg_dump` before migrate + document schema rollback (§5.4).
9. Encrypt backups, add retention + restore verification (§5.5).
10. Fix the conversions rollup so it stops wiping reconciled commissions (§2.6).
11. Refresh must re-check account status (§2.3).
12. Fix client-IP handling end-to-end (Caddy + limiter) (§2.4, §5.10).

**P2 — soon (correctness, performance, ops)**
13. Add missing FK indexes + search trigram indexes (§4.4, §4.5).
14. Email lowercasing/uniqueness (§4.3); `ClickEvent` cascade → restrict (§4.2).
15. Reconcile the Vercel deploy story; rewrite `DEPLOYMENT.md` (§5.6, §5.11).
16. Harden the prod Dockerfile + add resource limits + pin image tag (§5.7-§5.9).
17. Rate-limit + validate public write endpoints (§2.8).
18. Fix analytics timezone and `uniqueUsers` counting (§4.6, §4.8).
19. Implement or remove the stubbed features (§7).

**P3 — backlog (hygiene)**
20. Web + API test suites (§6); rating CHECK (§4.9); TOTP window/replay (§2.10); collection-page dedup (§3.10); secret rotation, log scrubbing (§5.12).

---

## 9. What's Done Well (don't regress these)

- httpOnly-cookie sessions (no token in localStorage), refresh-token reuse detection, reset-triggered session invalidation.
- ORM-only queries; no SQL injection; correct camelCase quoting in the one raw-SQL path.
- `Decimal` money everywhere; exact Prisma↔SQLAlchemy enum parity; proper slug/email/token unique constraints.
- No secrets committed to git; explicit single-origin CORS; 500 responses leak no internals.
- Consistent per-user ownership filtering and uniform admin-role guards on admin routers.

---

*Generated by a multi-agent code audit (backend, frontend, database, CI/CD), with every CRITICAL/HIGH finding re-verified against the source. Line numbers reflect the repository state at the time of review; re-check after edits.*
