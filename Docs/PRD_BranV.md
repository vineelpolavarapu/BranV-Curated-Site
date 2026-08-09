# Product Requirements Document (PRD)

> **Brand by Vineel - Curated Men's Affiliate Fashion Platform**
> Version 2.0 · Status: Draft · Theme: Tech Innovation
> *Supersedes v1.0. Affiliate model replaces direct e-commerce.*

---

## 1. Executive Summary

**Brand by Vineel** is a curated men's fashion content platform that monetizes through **affiliate marketing**. Vineel sources outfits and watches from major retailers (Flipkart, Amazon, Myntra, Ajio, Meesho, Nykaa Man, Snitch, Bewakoof, and others), styles them on **AI-generated avatar models created by Vineel**, and presents them as shoppable editorial content. When users click "Buy Now," they are redirected to the retailer's affiliate-tagged URL where the actual purchase happens - Vineel earns a commission per converted sale.

Vineel **never holds inventory**, **never processes payments**, **never fulfills orders**, and **never handles returns**. The retailer does all of that. Vineel provides curation, styling, content, and a destination.

The model is closest to **The Wirecutter, GQ Recommends, Hypebeast Shopping, and successful menswear Instagram creators monetizing via link-in-bio sites**. Revenue comes from affiliate commissions paid by retailers (typically 1–10% per sale depending on category and program).

The platform is built as a **mobile-first responsive Progressive Web App (PWA)** - one codebase serving mobile and desktop browsers. No native apps.

---

## 2. Business Model

### 2.1 Revenue

- **Affiliate commissions** via **Amazon Associates direct** (server-side auto-tagging) for Amazon products.
- **EarnKaro**, **Meesho affiliate program**, and other manually-managed networks for everything else - the admin joins each program directly, generates the affiliate-wrapped URL on the network's own dashboard, and pastes it into the retailer URL field. BranV stores and redirects to it verbatim; no conversion API call.
- **Direct brand programs** (Bewakoof, Snitch, The Souled Store) added opportunistically once traffic justifies the operational overhead.

### 2.2 Cost Structure

- Hosting and infrastructure (~₹2,000–5,000/month at launch).
- Domain and email (~₹2,000/year).
- No inventory cost. No payment gateway fees. No fulfillment cost.
- Content creation: time, plus AI image generation costs (Gemini/ChatGPT image API or comparable, typically ₹0.50–₹4 per image at scale).

### 2.3 Disclosure & Compliance

- Prominent affiliate disclosure on every product page and in the footer (ASCI-aligned for India, FTC-aligned for international visitors): *"We earn a small commission when you buy through our links - at no extra cost to you."*
- AI-generated imagery disclosure on every avatar image: small tag reading *"AI-rendered model"* or *"Styled with AI."*
- No misrepresentation of the affiliate relationship anywhere in UX copy.
- Product imagery from retailers used per each affiliate program's terms (Amazon PA-API / EarnKaro / Meesho compliant usage).

---

## 3. Vision & Goals

### 3.1 Vision

Build the destination men in India check first before shopping - an editorial, opinionated, AI-illustrated curation of menswear across the internet, where Vineel's eye is the differentiator.

### 3.2 Primary Goals

1. **Content velocity:** publish new outfit posts, roundups, and editorial pieces quickly. The platform's success depends on content frequency.
2. **One-modal Quick Add workflow** so adding a new product takes under 60 seconds end-to-end.
3. **Honest, satisfying click-out experience** with a celebratory "Nice pick!" moment that respects user trust while feeling premium.
4. **Robust click tracking** so Vineel knows what's converting, even when retailers don't share conversion data.
5. **AI avatar consistency** - Vineel's signature AI model appears across the catalog, becoming a recognizable visual identity.
6. **SEO-first architecture** so every piece of content compounds in long-term value.
7. **Mobile-first responsive design** because most fashion browsing happens on mobile.

### 3.3 Non-Goals

- No inventory, no warehousing, no fulfillment.
- No payment gateway integration.
- No order management, shipping management, or returns processing.
- No native iOS/Android apps.
- No live chat support.
- No multi-language UI (English only at launch).
- No multi-currency display (single base currency).

---

## 4. Users & Roles

### 4.1 Visitor (Unauthenticated)

Anyone landing on the site. Can browse, search, filter, click affiliate links. Cannot save items, leave reviews, or report purchases.

### 4.2 Member (Authenticated User)

Free signup. Can do everything a visitor can, plus: save to wishlist, build "My Wardrobe" (items they self-report buying), leave reviews, subscribe to newsletter, get notified of new drops.

### 4.3 Admin (Vineel)

Sole operator. Manages content, products, affiliate links, AI avatars, drops, analytics, members, and platform settings. Mandatory 2FA. CLI-seeded only - no admin self-registration.

### 4.4 Future Compatibility

Role enum reserves `STAFF` for v2 (if Vineel ever hires content help, fulfillment isn't needed but content workflow is).

### 4.5 Permission Matrix

| Capability | Visitor | Member | Admin |
|---|:---:|:---:|:---:|
| Browse, search, filter | ✓ | ✓ | ✓ |
| Click affiliate link out | ✓ | ✓ | ✓ |
| Self-report a purchase | ✓ (anon) | ✓ (saved) | - |
| Wishlist | - | ✓ | - |
| My Wardrobe | - | ✓ | - |
| Leave product review | - | ✓ (purchase-gated) | - |
| Newsletter signup | ✓ | ✓ | - |
| Drop pre-launch notify | ✓ | ✓ | - |
| Content management (CRUD) | - | - | ✓ |
| Avatar asset library | - | - | ✓ |
| Affiliate link configuration | - | - | ✓ |
| Click analytics | - | - | ✓ |
| Member management | - | - | ✓ |
| Platform settings | - | - | ✓ |

---

## 5. Two-Portal Architecture

| Portal | Path | Audience |
|---|---|---|
| **Storefront** | `/` | Visitors and members |
| **Admin Console** | `/admin/*` | Vineel only |

One backend, one design system, shared auth, separate IA.

---

## 6. Catalog Taxonomy

### 6.1 Top-Level Categories

| L1 Category | L2 Subcategories |
|---|---|
| **Clothing** | T-Shirts, Shirts, Polos, Jeans, Trousers, Shorts, Jackets, Inners, Sweatshirts & Hoodies, Ethnic Wear |
| **Footwear** | Sneakers, Loafers, Formal Shoes, Boots, Sandals & Slippers, Sports Shoes |
| **Watches** | Analog, Digital, Smartwatches, Luxury, Chronographs |
| **Eyewear** | Sunglasses, Optical Frames, Blue-Light Glasses |
| **Watches** | Belts, Wallets, Bags & Backpacks, Cufflinks, Caps & Hats, Scarves & Stoles, Jewelry, Keychains |
| **Grooming** | Fragrances, Beard Care, Hair Care, Skincare, Shaving, Gift Sets |
| **Inners** | Banniens / Vests, Briefs, Trunks, Boxers, Thermals |

### 6.2 Brand as a First-Class Entity

- `brands` table is independent - name, slug, logo, country of origin, founded year, hero image, short description, featured flag.
- Every product links to one brand.
- `/brands/[slug]` brand pages with brand story and all carried products.
- "Shop by Brand" is a top-level navigation axis alongside "Shop by Category."
- Brand is a universal filter on every listing page.

### 6.3 Curatorial Concepts

- **Featured Brands** - admin-rotated home page module.
- **New Arrivals** - products added in last 30 days.
- **Editor's Picks** - admin-curated lists.
- **The Edit** - themed collections ("Monsoon Essentials," "Wedding Guest," "Festive 2026").
- **Drop Posts** (see §11).

---

## 7. The Quick Add Workflow

This is the single most important admin workflow and the platform's productivity differentiator. Adding a new product must take under 60 seconds end-to-end.

### 7.1 Trigger

- Floating "+" button visible on every admin screen.
- Keyboard shortcut `N` from anywhere in admin.

### 7.2 The Modal

Single-screen modal - no tabs, no multi-step. Layout:

```
┌──────────────────────────────────────────────────┐
│ Quick Add Product                            ✕   │
├──────────────────────────────────────────────────┤
│  📋 Paste retailer URL                           │
│  [https://flipkart.com/...                    ]  │
│  [ 🪄 Auto-fill from URL ]                       │
│  ─── or fill manually ───                        │
│                                                  │
│  Title         [_______________________]         │
│  Brand         [Tommy Hilfiger      ▼] + new     │
│  Category      [Shirts              ▼]           │
│  Subcategory   [Formal Shirts       ▼]           │
│  Price ₹       [____]   MRP ₹  [____]            │
│  Color(s)      [Navy ▼ ]                         │
│  Size(s)       [M, L, XL                ]        │
│  Material      [Cotton                  ]        │
│  Tags          [casual, summer, linen   ]        │
│                                                  │
│  📸 Avatar Image (AI-rendered on Vineel model)   │
│  [ Drag, drop, or Ctrl+V paste from clipboard ]  │
│                                                  │
│  📸 Product Image (auto-extracted from URL)      │
│  [ ✓ extracted from Flipkart                   ] │
│                                                  │
│  🔗 Affiliate Link                               │
│  [ stored exactly as pasted - pick network:     ]│
│  [ EarnKaro ▾ ]                                  │
│                                                  │
│  Status:  ○ Draft   ● Publish now                │
│  ☐ Keep modal open after submit (bulk mode)      │
│                                                  │
│         [ Cancel ]    [ ✓ Add Product ]          │
└──────────────────────────────────────────────────┘
```

### 7.3 Capabilities

- **Auto-fill from URL**: paste a Flipkart, Amazon, Myntra, Ajio, Meesho, or Nykaa Man URL → backend scrapes title, price, MRP, primary product image, brand (best-effort), and pre-fills the form.
  - Lightweight server-side HTML scraping (cheerio for Node, BeautifulSoup for Python).
  - Auto-fill is best-effort; admin reviews and corrects before submitting.
- **Paste-from-clipboard image upload**: `Ctrl+V` / `Cmd+V` inside the modal pastes an image directly (no file dialog). Critical for fast workflow since Vineel generates avatars in Gemini/ChatGPT and pastes results in.
- **Drag-drop image upload** as alternative.
- **Affiliate link stored as pasted**: admin brings an already affiliate-wrapped URL from their network's own dashboard (EarnKaro, Meesho, etc.) and pastes it into the retailer URL field; it's stored and redirected to exactly as given, tagged with the network picked from a dropdown. Amazon URLs are the one exception - those get the Associates tag appended automatically server-side.
- **Brand dropdown with inline creation**: pick an existing brand from the dropdown, or choose "+ New brand" to open a full brand-creation form in a modal layered on top - Quick Add stays open and untouched underneath. The new brand is selected automatically once created.
- **Inline category navigation**: subcategory dropdown depends on selected category.
- **Keyboard-first**: Tab through fields. `Ctrl/Cmd + Enter` submits.
- **Bulk mode**: checkbox keeps modal open after submit, clears form, refocuses URL field - for adding 10–20 products in rapid succession.
- **Auto-save draft**: if admin closes modal mid-entry, form state is saved to localStorage and offered on reopen.
- **Validation inline**: red highlight on missing required fields with the submit button disabled until valid.

### 7.4 Required Fields

Title, Brand, Category, Price, Affiliate Link, Avatar Image. Everything else optional.

### 7.5 Edit Workflow

Editing an existing product opens the same modal pre-filled. One workflow, used for create and edit both.

---

## 8. AI Avatar System

A signature visual differentiator. Vineel generates a consistent AI avatar model and dresses that model in every product on the site.

### 8.1 Avatar Asset Library

- Admin section at `/admin/avatars`.
- Stores Vineel's base reference avatar(s) - front view, side view, back view, different poses, different settings (studio, outdoor, urban).
- Each reference has a name, tags, and a stored prompt template (the exact prompt that generates Vineel's signature look).
- Used as reference inputs when generating new outfit images in Gemini/ChatGPT or Midjourney with `--cref`.

### 8.2 Per-Product Avatar Image

- Every product has at least one avatar image showing the item styled on Vineel's avatar.
- Optional: multiple avatar images per product (different angles, settings, outfit combinations).
- Each avatar image carries an `is_ai_generated: true` flag and renders a small "AI-rendered model" tag on the storefront for disclosure.

### 8.3 Workflow

Vineel's typical content creation loop:
1. Find product on Flipkart/Amazon.
2. Copy URL.
3. In ChatGPT/Gemini: prompt with reference to avatar + "wearing [product description]" + setting.
4. Copy resulting image.
5. Open Quick Add modal on the site.
6. Paste retailer URL → click Auto-fill.
7. `Ctrl+V` to paste the AI avatar image.
8. Review, click Add. Total time: 30–60 seconds.

### 8.4 Compliance Notes

- AI-generated label visible on every avatar image (small badge, lower-right corner).
- Original retailer product image is also stored and displayed alongside the AI styling (one row of "the actual product on the retailer" + "styled by Vineel"). This is honest and resolves any ambiguity about what the buyer will actually receive.
- Brand logos appearing on avatar images: stick to depicting products as they appear in retailer photos. Avoid prominent isolated logo display.

---

## 9. Storefront Experience

### 9.1 Home Page

- **Hero carousel** - admin-managed editorial banners with CTAs (link to a drop, a brand, an edit, or an article).
- **Featured brands** module.
- **New arrivals** carousel.
- **The Edit** featured collection block.
- **Active drops** teaser strip.
- **Latest articles** module (long-form content with embedded products).
- **Newsletter signup** block.

### 9.2 Browse & Listing Pages

- Routes: `/category/[slug]`, `/brands/[slug]`, `/search?q=`, `/new`, `/sale`, `/edits/[slug]`, `/drops/[slug]`.
- **Sort:** Relevance, Newest, Price (low→high, high→low), Best Rated, Most Popular (by click count).
- **Faceted filters** - see §10.
- **Card design:** AI avatar image as hero (primary), retailer product image as secondary swap on hover/tap, brand name, title, price, MRP strikethrough, discount %, retailer badge ("Buy on Flipkart" / "Buy on Amazon" / etc.), "Buy Now" CTA, wishlist heart.

### 9.3 Product Detail Page

- **Image gallery:** AI avatar images (primary) + retailer product images (secondary) in a swipeable carousel. AI-rendered tag visible on avatar images.
- **Title, brand** (links to brand page), **price**, MRP strikethrough, **discount %**, **retailer badge**.
- **Variant info:** sizes available, colors available (display-only - actual variant selection happens on the retailer's site).
- **Description, material, care, country of origin** (from retailer + Vineel's editorial notes).
- **Size guide modal** - category-specific.
- **Aggregate rating + reviews** (from members who self-reported purchase).
- **"You may also like"** - same category + price band, prefer same brand.
- **Affiliate disclosure** line.
- **CTAs:** **Buy Now** (primary, retailer-branded), **Add to Wishlist**.
- **"Where to buy"** secondary section - if the same product is tracked across multiple retailers, show price comparison and let user pick where to buy.

### 9.4 The Click-Out Flow

This is the core revenue moment. Designed for honesty and delight.

**Step 1 - Click "Buy Now"**

- Click goes through `/go/:trackingId` redirect endpoint.
- Server logs: user_id (or anonymous session_id), product_id, retailer, source page, UTM data, timestamp, user agent, IP region.
- Server responds with 302 redirect to the stored affiliate URL (Amazon: auto-tagged; everything else: the URL exactly as the admin pasted it).
- Frontend opens this URL in a **new tab** (`target="_blank"` with `rel="noopener nofollow sponsored"` for SEO compliance and security).

**Step 2 - Optional in-tab return modal**

When the user returns to the Vineel tab (detected via `visibilitychange` event when they switch back), show a small non-intrusive bottom-sheet:

```
┌──────────────────────────────────────────┐
│ How did it go?                           │
│ Did you buy [Tommy Hilfiger Navy Shirt]? │
│                                          │
│ [ Yes, I bought it ]                     │
│ [ Just browsing, not yet ]               │
│ [ Need help - contact us ]               │
└──────────────────────────────────────────┘
```

- Member is gently prompted, not forced. Dismissible. Shown once per click event.
- Visitor (unauthenticated) gets the same prompt but the "Yes" path encourages signup to save the item.

**Step 3a - "Yes, I bought it"**

- For members: item is added to **My Wardrobe** with the self-reported purchase timestamp.
- For visitors: optional inline signup with one-tap email, then add to Wardrobe.
- Self-reported conversion is logged (no proof required, no screenshot, no order ID).
- The **"Nice Pick" celebration modal** triggers:

```
┌────────────────────────────────────────────────┐
│  🎉 ✨  background confetti animation  ✨ 🎉   │
│                                                │
│              ✓                                 │
│         (green checkmark, animated)            │
│                                                │
│            Nice pick!                          │
│   We've saved this to My Wardrobe.             │
│                                                │
│   [ View My Wardrobe ]  [ Keep browsing ]      │
└────────────────────────────────────────────────┘
```

- **Headline rotates randomly** from a pool - never the same phrase twice in a row for the same user. Pool examples: "Nice pick!", "Solid choice!", "Great taste!", "Love that one!", "You've got an eye!", "Stylish move!", "Top tier!", "That's the one!", "Excellent!", "Pure class!", "Sharp!", "On point!", "Looking good!", "Killer choice!", "Bold move!", "Crisp!", "Elite taste!", "Wardrobe upgrade unlocked!". A `random` helper picks from this pool with a small "no immediate repeat" guard.
- **Background celebration animation** runs behind the modal - light confetti or sparkles, ~1.5 seconds, then fades. Lightweight (canvas-based or CSS-only, no heavy libs).
- **No mention of "Purchase Successful"**, no PhonePe-mimicking copy, no fake order confirmation. The celebration is for *the choice*, not a fabricated transaction.
- Modal auto-dismisses after 4 seconds or on click anywhere.

**Step 3b - "Just browsing"**

- Click logged with `outcome: browsing`.
- Modal closes. No celebration. Item optionally added to wishlist with one tap.

**Step 3c - "Need help"**

- Opens support ticket flow with the product pre-filled.

### 9.5 My Wardrobe

A genuinely useful feature for members. Items they've self-reported buying live here.

- Route: `/wardrobe`.
- Grid of items grouped by retailer, brand, or season.
- Each item shows: image, title, brand, retailer, purchase date (self-reported), "Manage on Flipkart →" link to retailer's order history, optional notes ("for cousin's wedding"), tag editor (own categorization).
- "Leave a review" CTA on each wardrobe item - gated to members with the item in their wardrobe.
- Privacy: wardrobe is private by default. Optional public profile in v1.5.
- Wardrobe statistics: total spend (self-reported), favorite brand, most-bought category.

### 9.6 Wishlist

- Members can save items to a wishlist with a tap on the heart icon.
- Route `/wishlist`.
- "Notify me on price drop" toggle per item - fires when admin updates the price (or the nightly sync detects a drop) on that product.

### 9.7 Search

- Postgres full-text search + trigram similarity (`pg_trgm`) for typo tolerance.
- Autocomplete returns products, brands, and categories.
- Search results page with full filter sidebar.

### 9.8 Member Account

- `/account` - profile, email, password, 2FA toggle, notification preferences, newsletter preferences.
- `/account/addresses` - *kept lightweight; only used for member profile, not order routing* (since there are no orders).
- `/wardrobe`, `/wishlist`, `/account/notifications`, `/account/reviews`.

### 9.9 Newsletter

- Weekly digest: new arrivals, top picks of the week, upcoming drops, featured article.
- Captured via inline forms throughout the site.
- ESP integration: Mailchimp, ConvertKit, Resend Audiences, or Buttondown (admin choice).

---

## 10. Filtering & Faceting System

Identical philosophy to v1: universal filters + category-specific filters, driven by a `category_attribute_schemas` table.

### 10.1 Universal Filters

Price range, Brand (multi-select with logos), Color (swatches), Retailer (Flipkart, Amazon, Myntra…), Discount (10%+, 20%+, 30%+, 50%+), Rating (4★+, 3★+), In stock at retailer (toggle, refreshed nightly), New arrivals (toggle), On sale (toggle).

### 10.2 Category-Specific Filters

| Category | Filters |
|---|---|
| **Clothing** | Size, Fit, Material, Sleeve, Pattern, Occasion |
| **Footwear** | Size (UK/US/EU), Shoe type, Material, Sole, Closure |
| **Watches** | Movement, Case material, Strap, Dial color, Water resistance, Case size |
| **Eyewear** | Frame shape, Frame material, Lens type, Frame color |
| **Watches** | Sub-type-specific (belts, wallets, bags, jewelry, etc.) |
| **Grooming** | Scent family, Concentration, Volume, Product type, Skin/hair type |

### 10.3 Implementation

- `product_variants.attributes` JSONB column.
- `category_attribute_schemas` table defines per-category filter schema.
- GIN index on attributes for filter performance.
- Filter UI is data-driven from the schema.

### 10.4 Filter UX

Desktop: sticky sidebar. Mobile: slide-up sheet with chips for active filters above results. Live count updates. URL query params for shareable filtered states.

---

## 11. Drop Posts (Editorial)

Repositioned for affiliate model - no inventory, no purchase limits, no waitlist.

### 11.1 Concept

A **Drop Post** is an editorial article about a launch happening at one of the covered brands or retailers - e.g., "Snitch Monsoon Drop - Out Friday 8PM on Snitch.co.in" or "The Tag Heuer Anniversary Edition - Pre-orders on Flipkart."

### 11.2 Structure

- Name, slug, hero image (Vineel's AI styling), description, launch datetime, optional end datetime.
- Curated list of products from the drop.
- Optional **"Notify Me"** email signup for pre-launch.
- Status: `SCHEDULED` → `LIVE` → `ENDED`.

### 11.3 Customer Experience

- **Drop landing page** at `/drops/[slug]`:
  - **Pre-launch:** hero, countdown to launch, "Notify Me" form, share buttons.
  - **Live:** hero, products with affiliate Buy Now links, countdown to end (if set).
  - **Ended:** archive view, link to next drop.
- **Drop calendar** at `/drops` - upcoming and past.
- Email notifications: 24h-before reminder, launch notification, last-call.

### 11.4 Admin

- Drop CRUD with preview.
- Schedule publication and launch time.
- Curate products.
- Live drop dashboard: views, affiliate clicks per product, self-reported conversions, estimated commission earned.

### 11.5 Scheduler Worker

Runs every minute, flips drop statuses at scheduled times, fires pre-launch and launch notifications, clears caches.

---

## 12. Content Management

### 12.1 Articles

A full editorial system - this is the engine of SEO and affiliate revenue.

- Article types: Roundup ("10 Best Linen Shirts Under ₹2000"), Guide ("How to Style a Bomber Jacket"), Brand Spotlight, Comparison ("Snitch vs The Souled Store"), Drop announcement.
- Rich markdown editor with embeddable product cards - admin types `/product` in the editor and gets a product picker that inserts a styled embed.
- Each article has: title, slug, hero image, excerpt, body (markdown), tags, related products, author byline (Vineel), publish date, scheduled publish, SEO metadata (meta title, meta description, OG image), reading time (auto-calculated).
- Article listing at `/articles`, individual articles at `/articles/[slug]`.
- Articles are major SEO assets - full schema.org markup as `Article` with `mentions` of products.

### 12.2 Lookbooks

- Themed photo collections built around Vineel's AI avatar.
- Each lookbook image has shoppable hotspots - click a hotspot, get a product card with Buy Now.
- Public at `/lookbooks/[slug]`.
- Teaser block on home page.

### 12.3 The Edit

- Curated themed product collections.
- Public at `/edits/[slug]`.
- Featured on home page.

### 12.4 Home Banners

- CRUD with image, headline, CTA label, link target, display order, schedule (start/end dates).

### 12.5 Brand Stories

- Long-form markdown content per brand.
- Rendered on `/brands/[slug]`.

---

## 13. Affiliate Link Management

### 13.1 Primary: Amazon Associates Direct

- Register for Amazon Associates India (requires a website with content; approval can take days).
- For Amazon URLs, use direct Amazon Associates tag (`tag=brandbyvineel-21` or similar), appended server-side.
- Backend detects Amazon URLs (by retailer field or hostname) and routes them through this direct integration automatically - no admin action needed beyond pasting the plain product URL.

### 13.2 Everything Else: Manual Affiliate Links (EarnKaro, Meesho, and others)

- No conversion API for these - the admin joins each network directly (EarnKaro, Meesho affiliate program, etc.), generates the affiliate-wrapped URL on that network's own dashboard, and pastes the finished link into the retailer URL field in Quick Add.
- Stored as `(raw_url, converted_url, partner, partner_link_id, created_at)` in `affiliate_links` table - `converted_url` is identical to `raw_url` for these rows (no conversion happened), and `partner` records which network the admin selected from a dropdown (EarnKaro / Meesho / Other-Direct) so reconciliation reports can still be split per network.
- The redirect endpoint (`/go/:trackingId`) simply serves this stored URL - no external call at click time either.

### 13.3 Direct Brand Programs (Future)

- Architecture supports adding Snitch, Bewakoof, The Souled Store direct programs later via the same `affiliate_links` table with a different `partner` value.

### 13.4 Sync Worker

- Nightly job per product:
  - Re-checks product availability via retailer page (lightweight HEAD/GET request).
  - Re-fetches price; if changed beyond threshold (e.g., ±5%), updates the price and triggers price-drop notifications to wishlisters.
  - If product is delisted, flags it as `OUT_OF_STOCK_AT_RETAILER` (hidden from listings).

---

## 14. Click Tracking & Attribution

This is the heart of analytics for affiliate businesses, because retailer dashboards give you very little.

### 14.1 The Redirect Endpoint

- Every affiliate Buy Now link points to `/go/:trackingId` first.
- `trackingId` is a short hash that maps to a `click_events` row.
- On hit:
  - Insert a `click_events` row: id, product_id, user_id (nullable), session_id, source_page_url, referrer, utm_source, utm_medium, utm_campaign, user_agent, ip_country (via lookup), partner, partner_url, at.
  - 302 redirect to the affiliate URL with appropriate UTM tags appended.

### 14.2 Self-Reported Conversions

- When user reports "Yes, I bought it," insert a `self_reported_conversions` row linked to the click event.
- Optional estimated commission (product_price × applicable_commission_rate at time of click).

### 14.3 Affiliate Dashboard Reconciliation

- Most affiliate programs send weekly/monthly CSV reports of confirmed conversions and commissions.
- Admin uploads these CSVs via `/admin/affiliate/reconciliation`.
- Parser matches reported transactions to logged clicks where possible (by retailer, approximate time window, approximate amount).
- Stores reconciled records in `affiliate_payouts` table - the source of truth for actual revenue.

### 14.4 Metrics

- **Self-reported conversion rate** - clicks → self-reported buys (member-disclosed).
- **Confirmed conversion rate** - clicks → reconciled payouts (from CSV).
- **Estimated commission** vs **actual commission** - variance helps tune content strategy.
- **Top performing content** - articles, drops, edits ranked by click volume and reconciled revenue.
- **Top performing products** - products ranked by clicks and conversions.
- **Retailer health** - which retailer programs are converting best.

---

## 15. Notifications

### 15.1 Channels

- Email (primary).
- In-app notifications (bell icon).
- Web Push (PWA, gated behind permission).
- SMS - feature-flagged, off at launch.

### 15.2 Types

- Member: registration, email verification, password reset, wishlist price drop, drop launching soon, drop live, new article from author, review reply.
- Admin: high-traffic spike, low-conversion alert, affiliate sync failure, drop scheduled launching in N minutes, weekly summary email.

### 15.3 Engine

- Notifications queued via Redis (BullMQ or Celery).
- Outbox pattern: write outbox row inside DB transaction; dispatcher worker reads outbox and enqueues. Guarantees no notifications lost.
- Member preferences honored.

---

## 16. Reviews

- Members who have an item in My Wardrobe can leave a review of it.
- 1–5 star rating + optional title, body, images.
- Admin moderation (hide/restore).
- Aggregate rating on product page.
- *Self-reported purchase is sufficient gating* - no order-system gating possible since there are no orders.

---

## 17. Support

Lightweight ticket system.

- Categories: product question, broken link, feature request, partnership inquiry, other.
- Threaded admin replies.
- SLA timers.
- Internal notes vs customer-visible replies.

---

## 18. Identity & Auth

### 18.1 Customer (Member)

- Email + password registration (argon2id hashing).
- JWT access (15 min) + rotating refresh (7 days) in httpOnly cookies.
- Email verification required before reviews or My Wardrobe access.
- Google OAuth optional (feature-flagged).
- Optional TOTP 2FA.

### 18.2 Admin

- Seeded via CLI.
- Mandatory TOTP 2FA before any admin action.
- Separate login route `/admin/login`.
- All admin actions audit-logged.

### 18.3 Rate Limiting & Lockout

- Auth endpoints: 5 req/min/IP.
- 5 failed logins in 15 min → 15-min account lockout.

---

## 19. Non-Functional Requirements

### 19.1 Performance

- API p95 latency: read < 300 ms, write < 600 ms.
- Listing page LCP < 2.0s on mid-range mobile over 4G.
- Aggressive caching: product cards, listing pages, brand pages (Redis, 5–15 min TTL with invalidation on edit).
- Next.js ISR for product detail and article pages.
- Image CDN with WebP/AVIF.

### 19.2 SEO

- Server-side rendered everything customer-facing.
- Schema.org markup: `Product` on product pages, `Article` on articles, `Organization` site-wide.
- Canonical tags. Open Graph and Twitter Card meta.
- Auto-generated sitemap with all products, articles, brands, categories, drops, edits.
- robots.txt configured.
- rel="nofollow sponsored" on all outbound affiliate links (Google requirement for affiliate links).

### 19.3 Security

- HTTPS-only.
- OWASP Top 10 mitigations.
- CSRF tokens.
- Strict CSP, HSTS, X-Frame-Options.
- Secrets in env vars / secrets manager.
- Input validation via Zod/Pydantic.

### 19.4 Reliability

- DB writes in transactions.
- Idempotent operations where retried (affiliate sync, notifications).
- No external conversion API in the affiliate-link write path to degrade - links are stored exactly as pasted (Amazon tagging is a local string operation).

### 19.5 Observability

- Structured JSON logs with correlation IDs.
- Sentry for errors.
- Prometheus metrics.
- OpenTelemetry tracing.
- `/health` and `/ready` endpoints.

### 19.6 Accessibility

- WCAG 2.1 AA on storefront.
- Keyboard navigation.
- 4.5:1 contrast.
- ARIA labels on icon buttons.
- Alt text on all images, including AI-generated avatars.

### 19.7 Scale Targets (v1)

- 5,000 registered members.
- 2,000 published products across 50+ brands.
- 100 published articles, 20 lookbooks, 10 drops.
- 50,000 monthly visitors.
- 500 affiliate clicks/day peak.

---

## 20. Mobile-First Responsive Web

- Breakpoints: ≤640px mobile, 641–1024px tablet, ≥1025px desktop.
- Every flow works at 360px viewport.
- **Mobile UX:** bottom nav (Home, Shop, Wardrobe, Wishlist, Account), sticky Buy Now CTA on product page, slide-up filter sheet, touch targets ≥44×44 px, swipeable image galleries.
- **Desktop UX:** top mega-menu (Shop by Category, Shop by Brand, The Edit, Drops, Articles, Sale), sidebar filters, hover quick-view.
- **PWA:** installable, offline shell, web push, app icon, splash, theme color.

---

## 21. Data Model (Core Tables)

```
users                      - id, email, password_hash, role, status, email_verified_at, totp_secret, created_at
member_profiles            - id, user_id, first_name, last_name, phone, dob, avatar_url, tier
addresses                  - id, user_id, line1, line2, city, state, pincode, country (profile-only, optional)

brands                     - id, slug, name, logo_url, hero_url, country, founded_year, description, is_featured, status
categories                 - id, parent_id, slug, name, path, display_order
category_attribute_schemas - id, category_id, attribute_key, display_name, filter_type, options_json

products                   - id, brand_id, category_id, subcategory_id, slug, title, description,
                              price, mrp, discount_pct, currency, primary_retailer, status,
                              created_by_admin_id, meta_title, meta_description, tags[], created_at
product_variants           - id, product_id, sku?, attributes_jsonb, color, size, is_default
product_images             - id, product_id, url, alt_text, is_primary, is_ai_generated, position
product_retailer_listings  - id, product_id, retailer, retailer_product_url, retailer_image_url,
                              raw_price, last_synced_at, availability_status
                              (allows the same product to be listed across multiple retailers)

affiliate_links            - id, product_retailer_listing_id, partner, raw_url, converted_url,
                              partner_link_id, created_at, last_validated_at

click_events               - id, tracking_id UNIQUE, product_id, user_id?, session_id, source_page_url,
                              referrer, utm_source, utm_medium, utm_campaign, user_agent, ip_country,
                              partner, partner_url, at
self_reported_conversions  - id, click_event_id, user_id, product_id, reported_at,
                              estimated_commission, notes
affiliate_payouts          - id, partner, reported_period_start, reported_period_end,
                              reported_clicks, reported_orders, reported_commission_inr, csv_row_hash, at
affiliate_payout_items     - id, payout_id, matched_click_event_id?, retailer_order_id?,
                              amount_inr, commission_inr

wardrobe_items             - id, user_id, product_id, self_reported_purchase_at, retailer, notes, tags[]
wishlist_items             - id, user_id, product_id, notify_price_drop, added_at

reviews                    - id, product_id, user_id, rating, title, body, images_jsonb, status, created_at

articles                   - id, slug, title, hero_url, excerpt, body_md, status, scheduled_at,
                              published_at, author_id, tags[], meta_title, meta_description, og_image
article_products           - id, article_id, product_id, position

drops                      - id, slug, name, hero_url, description, launch_at, ends_at, status
drop_products              - id, drop_id, product_id, display_order
drop_notify_signups        - id, drop_id, user_id?, email, notified_at

lookbooks                  - id, slug, title, hero_url, description, status
lookbook_images            - id, lookbook_id, image_url, position
lookbook_tags              - id, lookbook_image_id, product_id, x_percent, y_percent

edits                      - id, slug, title, hero_url, description, status
edit_products              - id, edit_id, product_id, display_order

home_banners               - id, image_url, headline, cta_label, cta_link, display_order,
                              starts_at, ends_at, status
brand_stories              - id, brand_id, body_md, hero_url, status

avatars                    - id, name, reference_image_url, prompt_template, tags[], created_at
                              (Vineel's AI avatar reference library)

newsletter_subscribers     - id, email, user_id?, source, subscribed_at, confirmed_at, unsubscribed_at

notifications              - id, user_id, channel, type, payload_jsonb, read_at, sent_at
notification_preferences   - id, user_id, channel, type, enabled

support_tickets            - id, user_id, category, subject, status, opened_at, sla_due_at
ticket_messages            - id, ticket_id, author_id, body, is_internal, at

audit_logs                 - id, actor_id, action, target_type, target_id, metadata_jsonb, at
idempotency_keys           - key PK, user_id, endpoint, response_body_jsonb, status_code, created_at
platform_settings          - key PK, value_jsonb, updated_at, updated_by
```

### Key Constraints

- `click_events.tracking_id` UNIQUE.
- `users.email` UNIQUE.
- `brands.slug`, `categories.slug`, `products.slug`, `drops.slug`, `articles.slug`, `lookbooks.slug`, `edits.slug` UNIQUE.
- `wishlist_items(user_id, product_id)` UNIQUE.
- `wardrobe_items(user_id, product_id)` UNIQUE.
- Soft delete on products (status `ARCHIVED`) so click history remains intact.

---

## 22. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) + TypeScript | SSR for SEO (critical for affiliate), shared mobile+desktop |
| **Styling** | Tailwind CSS + shadcn/ui | Fast, accessible, editorial-friendly |
| **State** | TanStack Query + Zustand | |
| **Backend** | NestJS (Node.js + TS) | Same TS end-to-end; alternative: FastAPI |
| **Database** | PostgreSQL 16 | JSONB for attributes, FTS + pg_trgm for search |
| **ORM** | Prisma (NestJS) or SQLAlchemy + Alembic | |
| **Cache / Queue** | Redis 7 | Sessions, BullMQ/Celery |
| **Background Jobs** | BullMQ / Celery | Sync, notifications, drop scheduler, reconciliation |
| **Search** | Postgres FTS + pg_trgm | |
| **Object Storage** | Cloudflare R2 (cheapest egress) | AI avatar images, lookbook media |
| **CDN** | Cloudflare | |
| **Email** | Resend or Buttondown | Transactional + newsletter |
| **Affiliate** | **Amazon Associates direct** (auto-tagged), manual pasted links (EarnKaro, Meesho, others) | |
| **Confetti** | `canvas-confetti` (~1KB gzipped) | Nice-pick celebration |
| **Auth** | JWT + httpOnly cookies, TOTP 2FA | |
| **Container** | Docker + Docker Compose | |
| **Hosting (prod)** | Vercel (frontend) + Fly.io / Render (backend) + Neon (Postgres) + Upstash (Redis) | |
| **CI/CD** | GitHub Actions | |
| **Monitoring** | Sentry + Prometheus + Grafana + OpenTelemetry | |

---

## 23. System Architecture

```
                  ┌────────────────────────────────────┐
                  │   Next.js Responsive Web App       │
                  │  (Storefront + Admin Console)      │
                  └─────────────┬──────────────────────┘
                                │ HTTPS / JSON
                                ▼
                  ┌────────────────────────────────────┐
                  │   Backend API (NestJS / FastAPI)   │
                  │  Auth · Catalog · Articles · Drops │
                  │  Affiliate · Click Tracking ·      │
                  │  Wardrobe · Newsletter · Admin     │
                  └──┬───────────────┬────────────┬────┘
                     │               │            │
            ┌────────▼──────┐  ┌────▼─────┐  ┌──▼────────────┐
            │  PostgreSQL   │  │  Redis   │  │ Cloudflare R2 │
            │  (primary)    │  │  cache + │  │  AI avatars   │
            └───────────────┘  │  queues  │  └───────────────┘
                               └────┬─────┘
                                    │
                  ┌─────────────────▼──────────────────┐
                  │   Background Workers               │
                  │  · Affiliate sync (price/stock)    │
                  │  · Drop launch scheduler           │
                  │  · Notification dispatcher         │
                  │  · Newsletter sender               │
                  │  · CSV reconciliation              │
                  │  · Analytics rollups               │
                  └─────────────────┬──────────────────┘
                                    │
                  ┌─────────────────▼──────────────────┐
                  │  External Services                 │
                  │  · Amazon PA-API                   │
                  │  · Retailer scrapers (fallback)    │
                  │  · ESP (Resend / Buttondown)       │
                  └────────────────────────────────────┘
```

---

## 24. API Surface (Illustrative)

```
# Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/verify-email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/2fa/setup, /verify, /disable

# Public Catalog
GET    /api/products?...filters...
GET    /api/products/:slug
GET    /api/products/:slug/related
GET    /api/categories
GET    /api/categories/:slug/filters
GET    /api/brands
GET    /api/brands/:slug
GET    /api/search/autocomplete?q=

# Affiliate Click-Out
GET    /go/:trackingId                         (302 redirect)
POST   /api/clicks/:trackingId/report          (self-reported conversion)
POST   /api/clicks/:trackingId/dismiss

# Member
GET    /api/me, PATCH /api/me
GET    /api/wishlist, POST/DELETE items
GET    /api/wardrobe, POST/PATCH/DELETE items
POST   /api/products/:id/reviews
GET    /api/notifications, PATCH preferences
POST   /api/newsletter/subscribe
POST   /api/newsletter/unsubscribe

# Drops & Content
GET    /api/drops, /api/drops/:slug
POST   /api/drops/:slug/notify-me
GET    /api/articles, /api/articles/:slug
GET    /api/lookbooks/:slug
GET    /api/edits/:slug

# Support
POST   /api/support/tickets
GET    /api/support/tickets
POST   /api/support/tickets/:id/messages

# Admin
POST   /api/admin/products/quick-add
POST   /api/admin/products/scrape-url            (URL → autofill payload)
GET/POST/PATCH/DELETE /api/admin/brands
GET/POST/PATCH/DELETE /api/admin/products
GET/POST/PATCH/DELETE /api/admin/articles
GET/POST/PATCH/DELETE /api/admin/drops
GET/POST/PATCH/DELETE /api/admin/lookbooks
GET/POST/PATCH/DELETE /api/admin/edits
GET/POST/PATCH/DELETE /api/admin/banners
GET/POST/PATCH/DELETE /api/admin/avatars
GET    /api/admin/clicks?...filters...
POST   /api/admin/affiliate/reconciliation       (CSV upload)
GET    /api/admin/analytics/overview
GET    /api/admin/analytics/clicks
GET    /api/admin/analytics/content
GET    /api/admin/analytics/drops
GET    /api/admin/members
GET    /api/admin/audit
GET    /api/admin/settings, PATCH same
```

---

## 25. Testing Strategy

- **Unit:** affiliate link conversion, click tracking, reconciliation CSV parsing, quick-add scraping fallback parsers, drop status transitions.
- **Integration:** API tests against test Postgres + Redis (testcontainers).
- **E2E (Playwright):**
  - Member: register → verify → browse → filter → product → Buy Now → return → "Yes I bought it" → Nice Pick celebration → Wardrobe → review.
  - Admin: Quick Add via URL paste → AI avatar paste → publish → see live on storefront within seconds.
  - Drop: schedule → pre-launch view → launch flip → notification fired → live affiliate clicks tracked.
- **Contract tests:** Amazon PA-API responses (stubbed).
- **Concurrency:** click tracking under load (1000 concurrent /go hits).
- **Security:** Dependabot, CodeQL, gitleaks, ZAP scan.

---

## 26. CI/CD

GitHub Actions on PR + push: lint, typecheck, unit, integration (services: postgres, redis), E2E, build Docker, deploy to staging on `main`, manual approval gate to production.

---

## 27. Delivery Phases (High Level)

| Phase | Scope | Estimate |
|---|---|---|
| 0 | Foundations | 1 week |
| 1 | Identity (member + admin) | 1 week |
| 2 | Brand & catalog core, AI avatar library | 1.5 weeks |
| 3 | Quick Add workflow (URL scrape, affiliate link storage) | 1 week |
| 4 | Storefront browse, filters, search | 2 weeks |
| 5 | Click-out flow + Nice Pick celebration + Wardrobe | 1 week |
| 6 | Articles & content management | 1.5 weeks |
| 7 | Drops, lookbooks, edits, home banners | 1 week |
| 8 | Reviews, wishlist, newsletter, notifications | 1 week |
| 9 | Affiliate sync worker + reconciliation | 1 week |
| 10 | Admin analytics & audit | 1 week |
| 11 | Hardening (perf, security, accessibility, PWA, SEO) | 1 week |
| 12 | Testing & CI/CD | 0.5 week |
| 13 | Deployment | 0.5 week |

**Total ~13 weeks solo; 5–6 weeks for a small team.** Shorter than v1 because no payment / orders / shipping / returns subsystems.

---

## 28. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Affiliate program terms change or rates cut | Diversify partners (Amazon direct + EarnKaro + Meesho + brand direct). Track per-partner economics. |
| Retailer scraping breaks Quick Add autofill | cheerio/BeautifulSoup scraping for autofill only; manual entry always works regardless. |
| AI image consistency drift | Avatar Asset Library with stored prompt templates and reference images. |
| Content velocity below threshold | Quick Add modal is the primary mitigation - sub-60s product addition. |
| SEO ranking takes 6–12 months | Bake SEO infrastructure (schema.org, sitemap, OG, canonicals) from day one. |
| Price/stock data goes stale | Nightly sync worker; flag stale products; hide delisted. |
| User confused by AI imagery | "AI-rendered model" tag + retailer's actual product photo alongside. |
| Affiliate disclosure non-compliance | Persistent disclosure on every product card + product page + footer. |
| Click fraud or accidental clicks distorting analytics | Self-reported conversions filter to high-intent users; CSV reconciliation is the source of truth. |
| Single-admin bus factor | 2FA, daily DB backups, runbooks committed; `STAFF` role reserved in DB. |

---

## 29. Success Criteria

The platform is successful when:

1. Vineel can add a new product end-to-end in under 60 seconds via Quick Add.
2. Members can browse, filter, click Buy Now, return, report a purchase, see Nice Pick celebration, find item in Wardrobe.
3. Admin sees real-time click analytics and can reconcile against affiliate dashboard CSVs.
4. Drops can be scheduled and launched; pre-launch signups receive notifications.
5. Mobile experience at 360px is equivalent to desktop.
6. Site is fully SEO-indexed (sitemap, schema, OG, canonicals).
7. Lighthouse mobile: Performance ≥85, Accessibility ≥95, SEO ≥95.
8. All affiliate links carry `rel="nofollow sponsored"` and pass an audit.
9. Affiliate disclosure visible on every product surface.
10. CI green; staging mirrors production; one-command local startup.

---

## 30. Out-of-Scope (Future)

- Native iOS/Android apps.
- Real-money payment processing.
- Direct e-commerce / inventory / fulfillment (the original v1 design - explicitly out of scope).
- Live chat support.
- Multi-currency display.
- Internationalization beyond English.
- ML-based personalized recommendations.
- Influencer/creator portal (other content creators publishing under Vineel's umbrella).
- Affiliate API for partners (third parties using Vineel's product feed).
- Member tiers and gamification.
- Public wardrobe profiles / social features.
- Browser extension to add products from any retailer page in one click.

---

## 31. Glossary

- **Affiliate Link** - Special URL that tracks Vineel as the referrer and pays commission on resulting sales. For every retailer except Amazon, this is pasted in by the admin already-wrapped from the network's own dashboard (EarnKaro, Meesho, etc.) and stored verbatim - BranV performs no server-side conversion.
- **Click-out** - When a user clicks Buy Now and is redirected to the retailer.
- **Self-reported Conversion** - User-disclosed "Yes I bought it" event; not verified.
- **Reconciliation** - Matching self-reported and tracked click events to actual affiliate-program-confirmed payouts.
- **Nice Pick** - The celebratory modal shown after a self-reported purchase.
- **Quick Add** - The single-modal admin workflow for adding products in under 60 seconds.
- **AI Avatar** - Vineel's AI-generated model that wears each product.
- **My Wardrobe** - Member's collection of self-reported purchases.
- **Drop Post** - Editorial article about a launch happening at a covered retailer/brand.
- **PWA** - Progressive Web App; installable from browser.

---

*End of PRD v2.0 - Affiliate Model · Aligned with Vineel's pivot from v1.0 e-commerce model*
