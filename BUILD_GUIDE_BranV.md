# Build Guide: Brand by Vineel — Affiliate Model

> **End-to-end build instructions for the platform defined in `PRD_brand_by_vineel_v2.md`.**
> Follow phases in order. Each phase has Objective → Prerequisites → Steps → Acceptance Checks.
> Commit at the end of every step. Push at the end of every phase.

---

## How to Use This Guide

1. Read the PRD v2 in full first.
2. Keep the PRD open — every step here maps to a PRD section.
3. Don't move on until **all acceptance checks pass**.
4. Configuration (return window, sync intervals, sync thresholds) lives in env vars or a `platform_settings` table, not in code.
5. This guide is shorter than v1 because the affiliate model removes payment, order, fulfillment, and returns subsystems. Don't backfill them.

---

## Phase 0 — Foundations

**Objective:** Working local environment with Postgres, Redis, and S3-compatible storage. Empty backend + Next.js app both start with one command.

### 0.1 Prerequisites

- Node.js 20+, pnpm, Docker Desktop, Git, VS Code.
- GitHub private repo `brand-by-vineel`.
- Backend choice: **NestJS + Prisma (TypeScript) — recommended.** FastAPI works too; this guide notes both where they diverge.

### 0.2 Steps

1. **Repo structure:**
   ```
   brand-by-vineel/
   ├── apps/
   │   ├── web/           # Next.js 15
   │   └── api/           # NestJS or FastAPI
   ├── packages/shared/   # shared TS types (NestJS path)
   ├── docker-compose.yml
   ├── .env.example
   ├── .gitignore
   └── README.md
   ```

2. **`docker-compose.yml`** with: `postgres:16`, `redis:7`, `minio` (S3-compatible for local dev). Persist volumes.

3. **Scaffold frontend:**
   ```
   cd apps/web
   pnpm create next-app@latest . --typescript --tailwind --app --src-dir
   pnpm add @tanstack/react-query zustand zod canvas-confetti
   ```

4. **Scaffold backend:**
   - **NestJS:** `pnpm create @nestjs/cli@latest new api`. Add `@nestjs/config`, `@prisma/client`, `prisma`, `class-validator`, `class-transformer`, `argon2`, `jsonwebtoken`, `cheerio`, `bullmq`, `ioredis`, `nestjs-pino`, `axios`.
   - **FastAPI:** `pyproject.toml` with `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `psycopg2-binary`, `pydantic-settings`, `passlib[argon2]`, `python-jose`, `beautifulsoup4`, `celery`, `redis`, `httpx`, `structlog`.

5. **`.env.example`** with every variable across phases:
   ```
   DATABASE_URL
   REDIS_URL
   JWT_ACCESS_SECRET
   JWT_REFRESH_SECRET
   S3_ENDPOINT  S3_BUCKET  S3_ACCESS_KEY  S3_SECRET_KEY
   CUELINKS_API_KEY  CUELINKS_API_BASE
   AMAZON_ASSOCIATES_TAG  AMAZON_ACCESS_KEY  AMAZON_SECRET_KEY  AMAZON_REGION
   EARNKARO_API_KEY (optional)
   MAIL_PROVIDER  MAIL_API_KEY  MAIL_FROM
   BASE_CURRENCY=INR
   PRICE_SYNC_DRIFT_THRESHOLD_PCT=5
   SCRAPER_USER_AGENT
   ```

6. **Health endpoints:**
   - `GET /api/health` → `{ status, uptime, version }`.
   - `GET /api/ready` checks DB + Redis + S3.

7. **Structured logging** (JSON stdout) + correlation ID middleware reading/setting `X-Request-Id`.

8. **README.md** — prerequisites, one-command startup (`docker compose up && pnpm dev`), URLs of all services.

### 0.3 Acceptance Checks

- [ ] `docker compose up` starts Postgres, Redis, MinIO with no errors.
- [ ] `pnpm dev` runs both `apps/web` and `apps/api`.
- [ ] `/api/health` returns 200.
- [ ] `/api/ready` returns 200 when services are up.
- [ ] `localhost:3000` renders default Next.js.
- [ ] First commit pushed.

---

## Phase 1 — Identity (Member + Admin)

**Objective:** Two login flows with JWT, refresh rotation, email verification, mandatory 2FA for admin.

### 1.1 Data Model

`users`, `refresh_tokens`, `email_verifications`, `password_resets`, `audit_logs`, `member_profiles`. `users.role` is ENUM `MEMBER | ADMIN` (reserve `STAFF` for v2).

### 1.2 Steps

1. Argon2id password hashing.
2. JWT access (15 min) + rotating refresh (7 days) in `httpOnly`, `Secure`, `SameSite=Lax` cookies.
3. Endpoints: `/api/auth/register` (member only), `/api/auth/login` (both roles), `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/2fa/setup`, `/verify`, `/disable`.
4. RBAC guard (NestJS `RolesGuard` + `@Roles('ADMIN')` decorator; FastAPI `require_role(role)` dependency).
5. **Admin: mandatory TOTP 2FA** before any non-auth action.
6. Rate limit auth endpoints to 5/min/IP via Redis sliding window.
7. Account lockout: 5 failed logins in 15 min → 15-min lockout.
8. Two frontend login routes: `/login` (member) and `/admin/login` (admin). Backend returns role-claimed JWT; frontend redirects.
9. Member self-registration at `/register`. Admin not self-serve.
10. CLI seed script creates the first admin: `pnpm seed:admin` or `python -m api.seed_admin`.
11. Audit log on every auth event (register, login success, login fail, password reset, 2FA toggle).
12. Google OAuth optional, behind `GOOGLE_OAUTH_ENABLED` flag.

### 1.3 Acceptance Checks

- [ ] Member can register, verify email, log in.
- [ ] Member cannot reach `/admin/*` (403).
- [ ] Admin must complete 2FA setup before any admin action.
- [ ] Refresh rotation works; old refresh tokens rejected after use.
- [ ] 6 failed logins → 15-min lockout.
- [ ] Audit log records every auth event.

---

## Phase 2 — Brand & Catalog Core + Avatar Library

**Objective:** Admin can manage brands, categories with attribute schemas, products, and the AI Avatar Asset Library.

### 2.1 Data Model

Migrate: `brands`, `categories`, `category_attribute_schemas`, `products`, `product_variants`, `product_images`, `product_retailer_listings`, `avatars`.

### 2.2 Steps

1. **Seed categories** matching PRD §6.1 (Clothing → 10 subs, Suits & Formal → 9 subs, Footwear → 6 subs, Watches → 5 subs, Eyewear → 3 subs, Accessories → 8 subs, Grooming → 6 subs).

2. **Seed `category_attribute_schemas`** with PRD §10.2 attributes per category (size for clothing, movement for watches, frame shape for eyewear, etc.).

3. **Brand CRUD (admin):**
   - `GET /api/admin/brands` (paginated, searchable).
   - `POST /api/admin/brands`, `PATCH /api/admin/brands/:id`, `DELETE /api/admin/brands/:id` (soft delete if products exist).
   - UI at `/admin/brands` — list with logo, name, country, status, product count. Form with logo upload, hero upload, slug auto-generated, Featured toggle.

4. **Product CRUD (admin):**
   - Plain CRUD endpoints (the Quick Add modal lives in Phase 3 and wraps these).
   - `POST /api/admin/products` creates in `DRAFT`.
   - `PATCH /api/admin/products/:id`.
   - `DELETE /api/admin/products/:id` (soft delete to preserve click history).
   - `GET /api/admin/products` paginated, filterable by brand/category/status.

5. **Variant + retailer listing:**
   - A product has 1..N variants (`attributes_jsonb`, color, size).
   - A product has 1..N `product_retailer_listings` (per-retailer URL, price, image, availability).
   - Critical because the same shirt might be on Flipkart AND Myntra with different prices.

6. **Image upload:**
   - `POST /api/uploads/presign` → presigned S3/R2 URL.
   - Client PUTs file; client posts URL to `POST /api/admin/products/:id/images`.
   - Each image carries `is_ai_generated` flag.
   - Drag-to-reorder; one marked `is_primary`.

7. **Category attribute schema admin** at `/admin/categories`: edit per-category filter schemas so admin can add new filter dimensions without code changes.

8. **Avatar Asset Library:**
   - `GET/POST/PATCH/DELETE /api/admin/avatars`.
   - Each avatar: name, reference_image_url, prompt_template, tags.
   - UI at `/admin/avatars` — grid of references with thumbnails + "Copy Prompt" button (admin pastes the stored prompt template into Gemini/ChatGPT).
   - Seed Vineel's first base avatar references manually.

### 2.3 Acceptance Checks

- [ ] Admin creates a brand with logo + hero.
- [ ] Admin creates a product with 2 variants, 4 images (mixed AI-generated and retailer), 2 retailer listings.
- [ ] Category attribute schemas render in admin and persist.
- [ ] Avatar library: admin uploads 3 base avatars, can copy prompt template to clipboard.
- [ ] Soft delete preserves click history references.

---

## Phase 3 — Quick Add Workflow

**Objective:** Single modal that adds a product end-to-end in under 60 seconds. URL paste → autofill → AI avatar paste → submit.

This is the platform's productivity centerpiece. Build it carefully.

### 3.1 Steps

1. **URL scraper endpoint:** `POST /api/admin/products/scrape-url` with `{ url }`.
   - Detect retailer from hostname (flipkart, amazon, myntra, ajio, meesho, nykaa, snitch, bewakoof, thesouledstore or anything).
   - Per-retailer parser: extract title, brand (best-effort), price, MRP, primary image URL.
   - Use Cuelinks product API where supported.
   - Fallback: server-side HTML scrape with cheerio (Node) or BeautifulSoup (Python). Use a realistic `User-Agent`.
   - Return payload: `{ title, brand_hint, price, mrp, primary_image_url, retailer, raw_url }`.
   - Cache aggressive (Redis, 1 hour) so the same URL doesn't re-scrape.

2. **Cuelinks link converter:** `POST /api/admin/affiliate/convert-url` with `{ raw_url, retailer }`.
   - Call Cuelinks API → receive affiliate-tagged URL.
   - Store `affiliate_links` row.
   - Return converted URL.
   - For Amazon URLs, route to Amazon Associates direct: append `?tag={AMAZON_ASSOCIATES_TAG}` instead of Cuelinks-converting.
   - On Cuelinks API failure: store raw URL with a `pending_conversion: true` flag; a worker retries hourly.

3. **Quick Add endpoint:** `POST /api/admin/products/quick-add` with one combined payload:
   ```
   {
     scraped: {...},       // optional — admin may have edited
     title, brand_id (or new_brand_name), category_id, subcategory_id,
     price, mrp, color, sizes, material, tags,
     avatar_image_url,     // uploaded via presign first
     retailer_image_url,   // optional, from scrape
     retailer_product_url,
     status: 'DRAFT' | 'ACTIVE'
   }
   ```
   - Server-side: convert raw URL to affiliate URL, create product + variants + retailer_listing + images + affiliate_link in one DB transaction.
   - Return the new product with public URL.

4. **Inline brand creation:** if `new_brand_name` is provided, create the brand inside the same transaction.

5. **Quick Add frontend modal** at `/admin` (floating "+" button + `N` keyboard shortcut):
   - URL paste field at top with "Auto-fill" button → calls `scrape-url`, pre-fills the form.
   - All other fields visible in one scroll.
   - Avatar image field: drag-drop + paste-from-clipboard handlers (listen for `paste` event with `Clipboard.items`).
   - Status radio: Draft / Publish now.
   - "Keep modal open after submit (bulk mode)" checkbox — when checked, form clears after success and refocuses URL field.
   - Auto-save form state to `localStorage` on every change; offered on reopen if not submitted.
   - `Ctrl/Cmd + Enter` submits.
   - Visual feedback: brief success animation on submit, optional toast.

6. **Image clipboard paste implementation:**
   ```
   element.addEventListener('paste', async (e) => {
     for (const item of e.clipboardData.items) {
       if (item.type.startsWith('image/')) {
         const blob = item.getAsFile();
         // upload to S3 via presigned URL, set avatar_image_url
       }
     }
   });
   ```

7. **Edit-mode reuse:** clicking edit on a product opens the same modal pre-filled. One workflow.

### 3.2 Acceptance Checks

- [ ] Paste a Flipkart shirt URL → autofill returns title, price, MRP, image within 3 seconds.
- [ ] Paste an Amazon URL → routes through Amazon Associates direct (visible in `affiliate_links.partner`).
- [ ] `Ctrl+V` an image in the modal → uploads and previews.
- [ ] "Bulk mode": after submit, modal stays open, fields cleared, URL field focused.
- [ ] New brand created inline without leaving modal.
- [ ] End-to-end Quick Add timed: under 60 seconds for an experienced admin.
- [ ] Cuelinks API down: product still creates with `pending_conversion` flag; worker resolves later.

---

## Phase 4 — Storefront Browse, Filters, Search

**Objective:** Public catalog with full faceted filtering, search with autocomplete, product detail pages, brand pages, home page.

### 4.1 Steps

1. **Public catalog endpoint:** `GET /api/products?search=&category=&brand=&color=&size=&retailer=&material=&minPrice=&maxPrice=&inStock=&onSale=&rating=&sort=&page=&pageSize=`.
   - Read `category_attribute_schemas` to know filterable JSONB attributes.
   - GIN index on `product_variants.attributes` and `products.tags`.
   - Sort options: relevance, newest, price asc/desc, best rated, most popular (by clicks).

2. **Filter schema endpoint:** `GET /api/categories/:slug/filters` returns universal + category-specific filter definitions with current value distributions ("Cotton (24), Linen (8)").

3. **Product detail:** `GET /api/products/:slug`:
   - Product, variants, all retailer listings, all images (AI + retailer), aggregate review, related products.
   - Computed: best current price across retailers, available retailers.

4. **Related products:** `GET /api/products/:slug/related` — same category + price band, prefer same brand.

5. **Brand endpoints:** `GET /api/brands` (active), `GET /api/brands/:slug` (with brand story and products).

6. **Search:**
   - Enable `pg_trgm`.
   - `tsvector` column on products covering title + description + brand_name + tags.
   - GIN index.
   - Trigger to maintain on insert/update.
   - `GET /api/search/autocomplete?q=` — returns products, brands, categories.

7. **Home endpoint:** `GET /api/home` — aggregated payload: banners, featured brands, new arrivals, the edit, latest articles, active drops.

8. **Frontend pages:**
   - `/` home page (hero, featured brands, new arrivals, the edit, articles teaser, drops teaser).
   - `/category/[slug]` listing.
   - `/brands` grid.
   - `/brands/[slug]` brand page.
   - `/products/[slug]` product detail.
   - `/search?q=` results.
   - `/new` and `/sale`.

9. **Mega-menu** with two axes: Shop by Category, Shop by Brand. Plus utility: The Edit, Drops, Articles, Sale.

10. **Filter UI:**
    - **Desktop:** sticky sidebar with live count.
    - **Mobile:** slide-up bottom sheet; active filters as chips above results.
    - URL query params for shareable filtered views.

11. **Product card design** (used everywhere):
    - AI avatar image (primary), retailer image as secondary swap on hover (desktop) or second-tap (mobile).
    - Small "AI-rendered" badge on the avatar image.
    - Brand, title, price, MRP strikethrough, discount %.
    - Retailer badge ("Buy on Flipkart").
    - "Buy Now" CTA (primary action).
    - Wishlist heart (top right).

12. **AI disclosure tag styling:** small, subtle badge on every AI-rendered image — `bottom-right`, semi-transparent, "AI-rendered" text.

13. **Mobile-first checks (PRD §20):** every page works at 360px; bottom nav present; touch targets ≥44×44 px.

### 4.2 Acceptance Checks

- [ ] Listing pages return correct results under all filter combinations.
- [ ] Category-specific filters appear correctly (Watches has Movement; Clothing does not).
- [ ] Search "shrit" returns "shirt" results (trigram).
- [ ] Autocomplete p95 under 100 ms.
- [ ] Product page renders at 360px without layout issues.
- [ ] AI badge visible on every AI-rendered image.
- [ ] Lighthouse mobile Performance ≥80 on listing page.

---

## Phase 5 — Click-Out Flow + Nice Pick + Wardrobe

**Objective:** The core revenue moment. Click tracking, retailer redirect, "Did you buy this?" prompt, Nice Pick celebration, My Wardrobe.

### 5.1 Data Model

Migrate: `click_events`, `self_reported_conversions`, `wardrobe_items`, `wishlist_items`.

### 5.2 Steps

1. **Click tracking endpoint** (the `/go/:trackingId` redirect):
   - `GET /go/:trackingId` — public, no auth required.
   - Look up the click target (product + retailer + affiliate URL).
   - Insert `click_events` row with: product_id, user_id (if logged in), session_id (cookie), source_page_url (from `Referer`), UTM params (from query string), user_agent, ip_country (via `cf-ipcountry` header or MaxMind lite), partner, partner_url, timestamp.
   - 302 redirect to the affiliate URL.
   - Critical: this endpoint must be fast (<50ms) — don't block the user on heavy logic. Insert can be async via a Redis queue if needed.

2. **Generating tracking links:**
   - When rendering a product card or detail page, server creates a short tracking ID per click context (cached in Redis for short TTL, or pre-generated and stored with the product).
   - Render `<a href="/go/{trackingId}" target="_blank" rel="noopener nofollow sponsored">Buy Now</a>`.
   - `rel="nofollow sponsored"` is REQUIRED by Google for affiliate links.

3. **"Did you buy this?" prompt:**
   - Frontend listens for `visibilitychange` event.
   - When the user returns to the Vineel tab after clicking out, after a short delay (e.g., 8 seconds — long enough that they had time to look at the retailer), show a non-intrusive bottom sheet:
     ```
     How did it go?
     Did you buy [Product Title]?
     [ Yes, I bought it ]  [ Just browsing ]  [ Need help ]
     ```
   - Dismissable. Shown at most once per click event.
   - Tracks user response via `POST /api/clicks/:trackingId/report` with `{ outcome }`.

4. **"Yes, I bought it" handler:**
   - If member: insert `wardrobe_items` row and `self_reported_conversions` row.
   - If visitor: prompt inline signup ("Save this to your wardrobe — takes 10 seconds. Email + password.") or skip with a smaller anonymous conversion log.
   - Trigger the **Nice Pick celebration modal**.

5. **Nice Pick Celebration Modal:**

   - **Random headline pool** (no immediate repeat):
     ```typescript
     const NICE_PICK_PHRASES = [
       "Nice pick!", "Solid choice!", "Great taste!", "Love that one!",
       "You've got an eye!", "Stylish move!", "Top tier!", "That's the one!",
       "Excellent!", "Pure class!", "Sharp!", "On point!",
       "Looking good!", "Killer choice!", "Bold move!", "Crisp!",
       "Elite taste!", "Wardrobe upgrade unlocked!", "Slick!", "Wardrobe win!"
     ];
     function pickHeadline(lastUsed?: string) {
       const pool = NICE_PICK_PHRASES.filter(p => p !== lastUsed);
       return pool[Math.floor(Math.random() * pool.length)];
     }
     ```
     Persist `lastUsed` in localStorage to avoid immediate repeats per-user.

   - **Background celebration:** use `canvas-confetti` (~1KB gzipped). On modal open, fire two bursts:
     ```typescript
     import confetti from 'canvas-confetti';
     confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
     setTimeout(() => confetti({ particleCount: 50, spread: 100, origin: { y: 0.6 } }), 300);
     ```

   - **Modal markup** (Tailwind):
     ```
     ┌───────────────────────────────────────────────┐
     │      ✓  (animated green checkmark, ~80px)     │
     │                                               │
     │           {randomHeadline}                    │
     │                                               │
     │  We've saved this to My Wardrobe.             │
     │                                               │
     │   [ View My Wardrobe ]  [ Keep browsing ]     │
     └───────────────────────────────────────────────┘
     ```

   - Auto-dismiss after 4 seconds OR on any click.
   - Animated checkmark: SVG with `stroke-dasharray` + `stroke-dashoffset` transition (~600ms).
   - Reduced motion preference: respect `prefers-reduced-motion: reduce` — skip confetti, use a static checkmark.

   - **No "Purchase Successful" wording anywhere.** No transaction confirmation language. Stick to celebrating the choice.

6. **My Wardrobe:**
   - `/wardrobe` route, member-only.
   - Grid of wardrobe items grouped by recent / brand / category (toggle).
   - Each card: image, title, brand, retailer, self-reported purchase date, "Manage on {retailer} →" link, notes editor, tags editor, "Leave a review" CTA, "Remove from wardrobe" action.
   - Wardrobe stats block at top: total items, total spend (self-reported), favorite brand.

7. **Wishlist:**
   - `/wishlist` route.
   - Heart icon on every product card toggles wishlist state.
   - "Notify on price drop" toggle per item.
   - Same `wishlist_items` table.

8. **Click summary endpoints for member:**
   - `GET /api/me/wardrobe` paginated.
   - `GET /api/me/wishlist`.
   - `POST/DELETE /api/wardrobe/items`.
   - `POST/DELETE /api/wishlist/items`.

### 5.3 Acceptance Checks

- [ ] Click Buy Now → new tab opens with the affiliate-tagged URL.
- [ ] Source tab logs a `click_events` row within 100ms.
- [ ] Return to source tab → bottom sheet appears after 8s.
- [ ] "Yes I bought it" on member → item appears in `/wardrobe` and `self_reported_conversions` row inserted.
- [ ] Nice Pick modal headline changes on consecutive uses (no immediate repeat).
- [ ] Confetti fires once, fades cleanly. Honors reduced-motion preference.
- [ ] Affiliate link carries `rel="nofollow sponsored"` (verified via DevTools).
- [ ] Wardrobe stats display correctly.
- [ ] Wishlist toggle and price-drop preference persist.

---

## Phase 6 — Articles & Content Management

**Objective:** Editorial system with markdown editor, embeddable product cards, SEO-ready output. The SEO engine of the platform.

### 6.1 Data Model

Migrate: `articles`, `article_products`.

### 6.2 Steps

1. **Article CRUD admin:**
   - `GET/POST/PATCH/DELETE /api/admin/articles`.
   - Fields: title, slug, hero_url, excerpt, body_md, status (`DRAFT`/`SCHEDULED`/`PUBLISHED`/`ARCHIVED`), scheduled_at, published_at, author_id, tags, meta_title, meta_description, og_image.

2. **Markdown editor in admin:**
   - Use Tiptap, MDXEditor, or a simple textarea + react-markdown preview.
   - Custom block: `/product` slash command opens product picker; insertion writes `{% product id="..." %}` or a custom MDX component reference.
   
   - Server-side renderer parses these and inserts styled product cards into the article body.

3. **Article publication scheduler:** worker every minute flips `SCHEDULED → PUBLISHED` at `scheduled_at`.

4. **Public endpoints:**
   - `GET /api/articles` paginated, filterable by tag.
   - `GET /api/articles/:slug` full article with embedded products resolved.

5. **Frontend:**
   - `/articles` listing.
   - `/articles/[slug]` article page with hero, body, embedded product cards (clickable, tracked).
   - Related articles at bottom (same tags).

6. **SEO infrastructure:**
   - Schema.org `Article` markup with author, datePublished, image, mentions of products.
   - Open Graph tags from `meta_*` fields.
   - Reading time auto-calculated and displayed.
   - Canonical tag.

7. **Sitemap regeneration:** worker rebuilds `/sitemap.xml` after every publish/unpublish (debounced).

### 6.3 Acceptance Checks

- [ ] Admin writes an article with 4 embedded products, schedules it for 5 min in future.
- [ ] At scheduled time, article goes live within 60s.
- [ ] Embedded product cards render correctly on the public article page.
- [ ] Schema.org markup validates on Google's Rich Results Test.
- [ ] Sitemap includes the new article.

---

## Phase 7 — Drops, Lookbooks, Edits, Home Banners

**Objective:** Editorial drop posts (affiliate-style), shoppable lookbooks, curated edits, home page banner management.

### 7.1 Data Model

Migrate: `drops`, `drop_products`, `drop_notify_signups`, `lookbooks`, `lookbook_images`, `lookbook_tags`, `edits`, `edit_products`, `home_banners`, `brand_stories`.

### 7.2 Drops

1. Admin endpoints: `GET/POST/PATCH/DELETE /api/admin/drops`.
2. Drop fields: slug, name, hero_url, description, launch_at, ends_at?, status.
3. `POST /api/admin/drops/:id/products` to curate.
4. Public endpoints: `GET /api/drops`, `GET /api/drops/:slug`, `POST /api/drops/:slug/notify-me`.
5. **Drop scheduler worker** every minute flips `SCHEDULED → LIVE` at `launch_at`, `LIVE → ENDED` at `ends_at`. On launch, fires pre-launch signup notifications.
6. Drop landing page states:
   - Pre-launch: hero, countdown timer (driven by server timestamp), "Notify me" form, share.
   - Live: hero, countdown to end (if set), products with affiliate Buy Now CTAs.
   - Ended: archive, link to next drop.
7. Drop calendar at `/drops`.
8. Admin drop dashboard: views, affiliate clicks per product, self-reported conversions, estimated commission.

### 7.3 Lookbooks

1. Admin CRUD with title, hero, description.
2. Upload lookbook images. For each image, add `lookbook_tags` at (x_percent, y_percent) → product links.
3. Frontend `/lookbooks/[slug]`: full-bleed images with shoppable hotspots. Tap/hover hotspot → product card popover with Buy Now (tracked).

### 7.4 The Edit

1. Admin CRUD with title, hero, description, ordered product list.
2. Public at `/edits/[slug]`.
3. Featured slot on home.

### 7.5 Home Banners

1. CRUD with image, headline, CTA label, link, display order, schedule.
2. Frontend renders ordered, schedule-filtered banners.

### 7.6 Brand Stories

1. Markdown content per brand.
2. Rendered on `/brands/[slug]`.

### 7.7 Acceptance Checks

- [ ] Scheduled drop flips to LIVE at launch_at within 60s; pre-launch signups emailed.
- [ ] Lookbook hotspots open product cards with tracked affiliate links.
- [ ] Scheduled banner appears only within its window.
- [ ] Brand story renders markdown safely (no XSS).

---

## Phase 8 — Reviews, Newsletter, Notifications

**Objective:** Reviews gated by wardrobe ownership; newsletter capture; full notification engine.

### 8.1 Reviews

1. `POST /api/products/:id/reviews` — enforce member has a `wardrobe_items` row for this product.
2. `GET /api/products/:id/reviews` paginated.
3. Maintain `products.avg_rating` + `products.review_count` via trigger or worker.
4. Admin moderation at `/admin/reviews` — hide/restore with reason logged.

### 8.2 Newsletter

1. ESP integration (Resend Audiences, Mailchimp, Buttondown — admin choice via env).
2. Endpoints: `POST /api/newsletter/subscribe`, `POST /api/newsletter/unsubscribe`.
3. Sign-up forms on home, footer, article pages, and a dedicated `/newsletter` page.
4. Worker sends weekly digest: top new products, featured article, upcoming drops, top edit.
5. Double opt-in (confirmation email).

### 8.3 Notifications

1. Notification types per PRD §15.2.
2. Channels: Email, In-app, Web Push (feature-flagged), SMS (off at launch).
3. Notification engine: BullMQ/Celery queues; outbox pattern (write outbox row inside DB transaction; dispatcher reads and enqueues).
4. Customer endpoints: `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`, `PATCH /api/notification-preferences`.
5. Frontend bell icon with unread count; full list at `/account/notifications`.
6. Web Push: register service worker, request permission post-engagement (not on first visit).

### 8.4 Acceptance Checks

- [ ] Non-wardrobe members cannot leave reviews.
- [ ] Newsletter signup with confirmation email works end-to-end.
- [ ] Notifications survive a backend restart (outbox queue).
- [ ] Member preferences honored (disabling email stops email but in-app arrives).

---

## Phase 9 — Affiliate Sync + Reconciliation

**Objective:** Keep product data fresh; reconcile actual affiliate payouts against tracked clicks.

### 9.1 Steps

1. **Price/availability sync worker:**
   - Runs nightly.
   - For each `ACTIVE` product, for each retailer listing:
     - Fetch current price + availability via Cuelinks product API (where supported) or lightweight scrape.
     - If price drifted beyond `PRICE_SYNC_DRIFT_THRESHOLD_PCT`:
       - Update `product_retailer_listings.raw_price`.
       - Update `products.price` if this is the primary retailer.
       - Fire price-drop notifications to wishlisters who toggled `notify_price_drop`.
     - If unavailable: set `availability_status = 'OUT_OF_STOCK_AT_RETAILER'`. Hidden from listings until restocked.
   - Concurrency-limited (don't hammer retailers — 1–2 requests/second per retailer, with backoff).
   - Failed syncs logged; product flagged with `sync_failed` after 3 consecutive failures (admin alert).

2. **Pending affiliate link resolver:** worker every 10 min checks `affiliate_links.pending_conversion = true`, retries Cuelinks API conversion.

3. **CSV reconciliation:**
   - Admin uploads provider CSV via `POST /api/admin/affiliate/reconciliation` (multipart).
   - Parser detects provider from CSV column structure (Cuelinks, Amazon, EarnKaro — each has different formats).
   - For each row: try to match to a `click_events` record by (partner, time window, amount band). Store match in `affiliate_payout_items`.
   - Unmatched rows still stored, flagged for admin review.
   - Idempotent: re-uploading the same CSV (detected via `csv_row_hash`) doesn't duplicate.

4. **Reconciliation UI** at `/admin/affiliate/reconciliation`:
   - Upload form with CSV preview.
   - History of uploads with totals.
   - Variance dashboard: reported clicks vs tracked clicks, reported commission vs estimated commission.

### 9.2 Acceptance Checks

- [ ] Nightly sync updates prices for products whose retailer prices changed.
- [ ] Price-drop notifications fire to wishlisters.
- [ ] Pending Cuelinks conversions resolve within an hour of being created.
- [ ] CSV upload matches 80%+ of rows to click events on a test file.
- [ ] Re-uploading the same CSV doesn't duplicate payouts.

---

## Phase 10 — Admin Analytics & Audit

**Objective:** Admin dashboard with click analytics, content performance, drop metrics, member insights, audit log.

### 10.1 Steps

1. **Rollup worker** runs hourly, aggregating raw events into summary tables: `analytics_daily_clicks`, `analytics_daily_conversions`, `analytics_content_perf`. Keeps endpoints fast.

2. **Analytics endpoints** (PRD §14.4 + §27):
   - `GET /api/admin/analytics/overview` — clicks, self-reported conversions, estimated commission, reconciled commission for today / 7d / 30d / 90d.
   - `GET /api/admin/analytics/clicks` — top-clicked products, top retailers, top source pages.
   - `GET /api/admin/analytics/content` — top articles by clicks and reconciled revenue.
   - `GET /api/admin/analytics/drops` — per-drop click/conversion metrics.
   - `GET /api/admin/analytics/members` — new vs returning, top wardrobes by item count.
   - `GET /api/admin/analytics/system` — API p95, error rate, queue depth, sync health.

3. **Admin dashboard** at `/admin`:
   - KPI cards: clicks today, conversions today, estimated commission, reconciled MTD.
   - Charts (Recharts): clicks trend, conversions trend, top products.
   - Quick links: low-conversion alerts, sync failures, pending reviews, open tickets.
   - "Live drops" badge with count.

4. **Audit log viewer** at `/admin/audit` — filter by actor, action, date range.

5. **Platform settings** at `/admin/settings`: sync intervals, drift thresholds, notification toggles, feature flags, default currency.

### 10.2 Acceptance Checks

- [ ] Dashboard loads under 2s p95.
- [ ] Analytics numbers reconcile with raw table counts.
- [ ] Audit log captures admin actions with full metadata.
- [ ] Settings changes take effect within the next request cycle.

---

## Phase 11 — Hardening

**Objective:** Production-ready: performance, security, accessibility, PWA, SEO.

### 11.1 Performance

1. Indexes on every filterable/sortable/joined column. `EXPLAIN ANALYZE` top 20 endpoints.
2. Redis caching: catalog endpoints (5–15 min TTL), invalidated on edit. Home page (5 min). Brand pages (15 min).
3. HTTP caching headers on public catalog endpoints.
4. Next.js ISR for product detail and article pages with on-demand revalidation via webhook on admin edit.
5. Image optimization: Next.js `<Image>` with `sizes`, WebP/AVIF, lazy-load below the fold.
6. Bundle analysis — route bundles under 200 KB gzipped.

### 11.2 Security

1. `npm audit` / `pip-audit`; fix critical CVEs.
2. Security headers: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy.
3. CSRF tokens on state-changing requests.
4. Validate every input with Zod/Pydantic.
5. Rate limit all public endpoints (Redis sliding window).
6. Manual pen test on auth + click tracking flow with OWASP ZAP.
7. Gitleaks pre-commit hook.

### 11.3 SEO (Critical for Affiliate)

1. **Verify `rel="nofollow sponsored"`** on every outbound affiliate link via automated test.
2. Schema.org `Product` markup on product pages with all required fields (name, image, brand, offers/price, aggregateRating).
3. Schema.org `Article` markup on articles.
4. Open Graph + Twitter Card meta on every public page.
5. Canonical tags everywhere.
6. Auto-generated `sitemap.xml` — products, articles, brands, categories, drops, edits, lookbooks.
7. `robots.txt` configured (disallow `/admin/*`, `/account/*`, `/go/*`).
8. **Google Search Console + Bing Webmaster** verification (note tag in admin settings).
9. **Affiliate disclosure** verified on every product card, product page, and article (automated test).

### 11.4 Accessibility

1. Keyboard navigation; visible focus rings.
2. 4.5:1 contrast minimum.
3. ARIA labels on icon buttons.
4. `<label>` on every form field.
5. Alt text required on every product image (enforced in admin form).
6. Run axe-core in CI on storefront pages.
7. Respect `prefers-reduced-motion` (no confetti for users with reduced motion preference).

### 11.5 Mobile & PWA

1. Verify every page at 360px viewport.
2. Bottom nav present on mobile.
3. Touch targets ≥44×44 px.
4. `manifest.webmanifest` with icons, theme color, `display: standalone`.
5. Service worker with offline shell caching.
6. Web push (user permission required), gated behind engagement.

### 11.6 Acceptance Checks

- [ ] Lighthouse mobile: Performance ≥85, Accessibility ≥95, Best Practices ≥95, SEO ≥95.
- [ ] ZAP scan: no high-severity findings.
- [ ] Service worker installs; site installable to home screen.
- [ ] Every outbound affiliate link has `rel="nofollow sponsored"`.
- [ ] Affiliate disclosure visible on every product surface (verified via test).
- [ ] Schema.org markup validates on Google Rich Results Test.
- [ ] Sitemap accessible and well-formed.

---

## Phase 12 — Testing & CI/CD

**Objective:** Comprehensive test suite + green CI/CD pipeline.

### 12.1 Tests

1. **Unit:** affiliate URL conversion (Cuelinks + Amazon), click tracking, scraping parsers per retailer, drop status transitions, Nice Pick headline randomizer, reconciliation CSV parser. ≥80% coverage on backend.

2. **Integration:** full API tests against test Postgres + Redis (testcontainers).

3. **E2E (Playwright):**
   - **Member journey:** register → verify email → browse → filter → product page → Buy Now (new tab opens, click logged) → return → "Yes I bought it" → Nice Pick celebration → check Wardrobe → leave review.
   - **Admin Quick Add journey:** login with 2FA → click "+" → paste Flipkart URL → auto-fill → paste avatar from clipboard → publish → see live on storefront.
   - **Drop journey:** schedule a drop 1 min in future → see pre-launch state → wait for scheduler → see LIVE → click product → Nice Pick → admin sees real-time drop dashboard.

4. **Concurrency:** 1000 concurrent `/go/:trackingId` requests; verify no lost rows and p95 < 100ms.

5. **Security:** Dependabot, CodeQL, gitleaks, ZAP weekly schedule.

### 12.2 CI/CD

```yaml
on: [pull_request, push: { branches: [main] }]
jobs:
  lint:        eslint / ruff
  typecheck:   tsc / mypy
  unit:        pnpm test
  integration: services: postgres, redis (testcontainers)
  e2e:         services: postgres, redis, minio; runs Playwright
  build:       Docker images
  deploy:      to staging on main; manual gate to prod
```

Required checks on PRs: all green before merge. On merge to `main`: build, push, deploy to staging; manual approval gates production.

### 12.3 Acceptance Checks

- [ ] CI runs in under 12 min.
- [ ] All three E2E journeys pass green.
- [ ] No flaky tests across 10 consecutive runs.

---

## Phase 13 — Deployment

**Objective:** Staging + production deployment, monitoring, runbooks.

### 13.1 Steps

1. **Hosting:**
   - Frontend: **Vercel** (native Next.js, free tier viable at launch).
   - Backend: **Fly.io** or **Render** (containerized).
   - Postgres: **Neon** (serverless, free tier viable).
   - Redis: **Upstash** (serverless, free tier viable).
   - Object storage: **Cloudflare R2** (no egress fees).
   - Email: **Resend** (3,000 emails/month free).

2. **Two environments:** `staging` and `production` with separate DBs, Redis, R2 buckets, secrets, affiliate keys.

3. **DNS + TLS** for both. HTTPS-only. HSTS on.

4. **Monitoring:**
   - **Sentry** for errors (frontend + backend).
   - **Better Stack** / **Grafana Cloud** for metrics + logs.
   - **OpenTelemetry collector** for traces.
   - **Uptime checks** on `/health` and a synthetic browse → click flow.

5. **Log aggregation:** stdout JSON → Better Stack / Grafana Loki / CloudWatch.

6. **Cuelinks dashboard URL** configured in env; admin docs include screenshots of where to find the CSV export.

7. **Runbooks** in `/docs/runbooks/`:
   - Sync worker failure recovery.
   - Cuelinks API outage handling.
   - Drop launch failure recovery.
   - DB failover (Neon handles most of it).
   - Rolling back a bad deploy.
   - Secret rotation.
   - Restoring from backup.

8. **Smoke test staging** end-to-end before declaring production-ready.

### 13.2 Acceptance Checks

- [ ] Staging passes all E2E tests against real Cuelinks API (using test products).
- [ ] Production deploys via manual approval gate.
- [ ] Monitoring dashboards show real traffic.
- [ ] Alerts fire on simulated errors.
- [ ] Runbooks committed.

---

## End-to-End Validation Journeys

Run these manually on production after Phase 13.

### Visitor → Member Journey (Mobile, 360px)

1. Land on home page; verify hero, featured brands, new arrivals render correctly.
2. Open mega-menu; navigate to Watches → Analog.
3. Apply filters: brand=Tag Heuer, color=Black, price 5000–20000.
4. Open a product detail page; verify AI avatar image (with badge), retailer image, all variants, related products.
5. Tap "Buy Now" — new tab opens with Flipkart affiliate URL; check URL contains affiliate tag in DevTools.
6. Return to Vineel tab; "Did you buy this?" bottom sheet appears after 8 seconds.
7. Tap "Yes I bought it" — inline signup prompt; register quickly.
8. Nice Pick celebration fires with a random headline + confetti.
9. Tap "View My Wardrobe" — item is there.
10. Leave a review on the wardrobe item; submit; appears on product page after admin moderation.

### Admin Journey

1. Log in to `/admin/login` with 2FA.
2. Open `/admin/avatars`; verify base reference avatars are present.
3. Generate an outfit image in Gemini using the stored prompt template.
4. Press `N` to open Quick Add modal.
5. Paste a Flipkart shirt URL → click Auto-fill → verify title/price/MRP/image populated.
6. Inline-create the brand if not present.
7. `Ctrl+V` to paste the generated AI avatar.
8. Select category, set status `Publish now`, hit `Cmd+Enter`.
9. Verify product appears on storefront within seconds.
10. Toggle "bulk mode" and add 4 more products in under 3 minutes total.
11. Open admin dashboard; verify the 5 new products show in catalog and click analytics shows their cards.

### Drop Journey

1. Admin creates "Monsoon Capsule" drop, scheduled 2 min in the future, with 5 curated products.
2. Visit `/drops/monsoon-capsule` — see countdown, "Notify me" form. Sign up an email.
3. Wait for scheduler. Drop flips to LIVE within 60s. Email arrives.
4. Refresh; products now shoppable with Buy Now CTAs.
5. Click Buy Now → affiliate redirect → Nice Pick celebration.
6. Open admin drop dashboard — see clicks, self-reported conversion, estimated commission.

### Resilience Journey

1. Kill backend during a click; restart. Click event logged via queue or repeated client retry.
2. 1000 concurrent `/go/:trackingId` requests — all logged, p95 < 100ms.
3. Cuelinks API simulated down — Quick Add still completes, link stored with `pending_conversion`. Worker resolves later.
4. Run sync worker on a retailer that returns 404 — product flagged after 3 consecutive failures; admin alerted.
5. Upload the same reconciliation CSV twice — second upload detected as duplicate, no double-counting.

---

## Definition of Done

- [ ] All 14 phases pass acceptance checks.
- [ ] All four validation journeys pass on production.
- [ ] CI green on `main`.
- [ ] Monitoring shows healthy metrics for 7 consecutive days.
- [ ] Affiliate disclosure verified on every product surface.
- [ ] All outbound links carry `rel="nofollow sponsored"`.
- [ ] AI-rendered tags visible on every AI image.
- [ ] Sitemap submitted to Google Search Console.
- [ ] Docs in `/docs` complete: architecture, API reference, runbooks, content workflow guide.
- [ ] README links: live URL, demo credentials, screenshots, tech stack, deployment instructions.

---

*End of Build Guide v2.0 · Affiliate Model · Aligned with PRD v2.0*
