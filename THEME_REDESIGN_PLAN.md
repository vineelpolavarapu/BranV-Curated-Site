# BranV — Colorful Interactive Theme & Animation Redesign Plan

> **Author's framing:** Senior frontend / UI‑UX implementation lead (20+ yrs, e‑commerce).
> **Objective:** Migrate BranV from its current *premium black‑and‑white* theme to an
> *interactive, colorful* theme across **every page**, with a coherent motion system
> designed **separately for desktop and mobile**, without regressing performance,
> accessibility, or the existing conversion‑critical flows.
>
> **Skills applied to build this plan:** `ui-design-system` (token architecture,
> color‑scale algorithm, WCAG gates), `ui-ux-pro-max` (pattern + style + palette +
> typography intelligence, animation UX rules), `senior-frontend` (RSC/Next.js
> patterns, Core Web Vitals budgets, the four forcing assumptions), `frontend-design`
> (intentional, non‑templated visual direction).
>
> **Status:** Draft v3 — **palette LOCKED** to the approved BranV mobile reference (royal
> blue + coral on a light‑gray card canvas; §4). Icon set, outer layout, banner sizing in
> §4.5–4.7. **Motion strategy upgraded:** adopt **Framer Motion** for a native‑feeling,
> gesture‑first mobile experience alongside the existing CSS/Lenis system (§7.4); every
> interaction specified for mobile + desktop in the **Interaction Specification Library
> (§7.5)** with external references in §7.6. **Scope is a strict UI reskin** — colors,
> layout styling, icons, typography, animations only; all data, categories, elements,
> routes, and copy preserved unchanged (**Scope Contract §2.4**). Sequenced execution plan
> in §9. Remaining open item: confirm the four forcing assumptions (§2.3) before Phase 1.

---

## 1. Current‑State Analysis (grounded in the actual codebase)

The plan is shaped by what BranV *actually is* today, not a generic template.

### 1.1 Stack & rendering
| Aspect | Reality | Source |
|---|---|---|
| Framework | Next.js **15.5** (App Router), React **19** | `apps/web`, `layout.tsx` |
| Styling | Tailwind **3.4** + `@tailwindcss/typography` | `tailwind.config.ts` |
| Smooth scroll | **Lenis** already wired globally | `layout.tsx` → `LenisProvider` |
| Motion tokens | Durations + easings already defined | `styles/motion-tokens.css` |
| Animation engine | **Compositor‑only CSS** (`transform`/`opacity`), scroll‑triggered via `.in-view`, full `prefers-reduced-motion` block | `globals.css` (`bv-*` system) |
| Page transitions | `PageTransitionShell` present | `layout.tsx` |
| Fonts | System UI stack only (no brand font yet) | `tailwind.config.ts` |

**Implication:** BranV already has a *disciplined, performant* animation foundation
(`bv-enter`, `bv-fade-up`, hero staggers, nav/dropdown/flyout choreography, Ken Burns,
wishlist heart‑pop, reduced‑motion coverage). We **extend** this system — we do not
replace it. This dramatically de‑risks the "add animations" half of the request.

### 1.2 The theme is hardcoded, not tokenized — this is the central finding
- The black/white theme lives as **literal utility classes** (`bg-black`, `text-white`,
  `border-black`, `#000`/`#fff`, `bg-ink`, `text-ink`) — **142 occurrences across 51 files**.
- `tailwind.config.ts` defines **only one custom color** (`ink`). There is **no semantic
  color layer** (no `primary`, `surface`, `accent`, `on-primary`, etc.).
- `globals.css` **hard‑forces light mode** (`color-scheme: light`) and hardcodes
  `--background:#fff` / `--foreground:#0a0a0a`, plus `accent-color:#000` for form controls.

**Consequence:** A colorful theme cannot be "flipped on." It requires introducing a
**semantic design‑token layer first**, then **migrating 51 files** from literal colors to
semantic tokens. This is the largest, most mechanical part of the work and dictates the
phasing (§9). Trying to recolor ad‑hoc, file‑by‑file, would produce an inconsistent,
un‑maintainable result — the classic anti‑pattern the `ui-ux-pro-max` `color-semantic`
rule warns against ("raw hex in components").

### 1.3 Surface inventory (what "all pages" means)
**~58 route pages, ~45 components.** Grouped by theming treatment:

| Group | Routes / components | Theming priority |
|---|---|---|
| **Storefront core** | `/` (home), `/shop`, `/new`, `/sale`, `/search`, `category/[slug]`, `products/[slug]` | **P0** — revenue + first impression |
| **Curated landing** | `fashion-forward`, `sharp-formals`, `classic-essentials`, `sports-wear`, `easy-casuals`, `trendy-wear` | **P0** — brand expression |
| **Content** | `articles`, `articles/[slug]`, `lookbooks/[slug]`, `edits/[slug]`, `brands`, `brands/[slug]` | **P1** |
| **Account/commerce** | `account/*`, `wishlist`, `wardrobe`, `newsletter/*` | **P1** |
| **Auth** | `login`, `register`, `forgot/reset-password`, `verify-email` (via `AuthShell`) | **P1** |
| **Shared shells & chrome** | `StorefrontShell`, `MobileBottomNav`, `MobileNavDrawer`, `HeroCarousel*`, `ProductCard`, `Filters`, modals/drawers | **P0** — theme every page at once |
| **Admin** | `/admin/*` (~20 pages via `AdminShell`) | **P2** — internal; theme last, lighter touch |

**Strategic call:** Theming the **shared shells + `ProductCard` + hero + nav** recolors the
*majority of visible surface across all storefront pages in one move*. Page‑specific work
then becomes accent/hero polish, not wholesale recoloring.

---

## 2. Design Strategy & Guiding Principles

### 2.1 The core tension: "colorful" without losing "premium"
Men's fashion buyers respond to restraint. The risk in "make it colorful" is drifting into
a toy‑like, low‑trust look (`ui-ux-pro-max` explicitly flags *"Playful colors"* and
*"Vibrant & block‑based"* as **anti‑patterns** for this product type). The resolution:

> **Colorful as *energy and interaction*, not as *chrome everywhere*.**
> Keep generous white/neutral canvas and photography as the hero. Inject saturated color
> through **CTAs, accents, hover/active states, focus rings, badges, category identity,
> gradients, and motion** — the interactive layer — rather than flooding backgrounds.

This is the confirmed **"Confident Blue"** direction (per the approved reference, §4): a
calm light‑gray canvas with white cards, where **royal blue** carries every action and
**coral** flags urgency (sale/new) — vibrant and trustworthy, never toy‑like. It reads
premium at rest and energetic on interaction.

### 2.2 Design principles (the rules every screen must obey)
1. **Token‑first.** No component gets a raw hex. Everything resolves to a semantic token.
2. **One accent system, applied consistently.** Color earns meaning (primary action,
   sale, new, category identity) — never decoration for its own sake.
3. **Photography stays king.** Product imagery is the color; UI chrome frames it.
4. **Motion conveys cause→effect** (`motion-meaning` rule) — every animation maps to a
   state change, navigation, or feedback. No idle decoration loops.
5. **Desktop and mobile motion are designed independently** (§7) — different input models,
   different performance envelopes, different choreography.
6. **Accessibility is a gate, not a garnish** — WCAG AA contrast on *every* token pair;
   `prefers-reduced-motion` honored (already the house style — keep it).
7. **Extend, don't rewrite.** Build on the existing `bv-*` engine, Lenis, motion tokens.

### 2.3 Four forcing assumptions to confirm before Phase 1 (from `senior-frontend`)
These drive perf/rendering budgets and must be answered, not assumed:

| # | Question | Working assumption (confirm/override) |
|---|---|---|
| 1 | Primary device + network | **Mobile‑first, 4G** (fashion browsing is mobile‑dominant) |
| 2 | Core Web Vitals targets @ p75 mobile | **LCP ≤ 2.0s, INP ≤ 200ms, CLS ≤ 0.1** |
| 3 | Per‑route JS budget | **≤ 150 KB gzip / route** — theme is CSS; Framer Motion is added but **`LazyMotion`‑bundled + code‑split** (§7.4) so global overhead stays small |
| 4 | WCAG target + owner | **AA**, owned by frontend lead; enforced in review |

> **Guardrail:** The *color theme* is CSS/token‑led (near‑zero JS). The *interactive motion
> layer* adds **Framer Motion**, contained via `LazyMotion` (~5–6 KB core) + per‑route
> `next/dynamic` code‑splitting so it never inflates the global bundle or non‑interactive
> routes (§7.4). Measure per‑route JS in CI against budget #3; drag/gesture features load
> only where used.

### 2.4 Scope Contract — UI RESKIN ONLY 🔒 (Task 1, binding)

This redesign changes **how BranV looks and moves — not what it is.** Every existing
element, its data, and its behavior are preserved exactly.

| ✅ IN scope (visual layer only) | ❌ OUT of scope (must NOT change) |
|---|---|
| Color palette / semantic tokens (§4) | Any product, brand, article, lookbook, edit, category **data** |
| Layout **styling**: spacing, cards, radius, shadows, pills, section chrome, bottom‑nav look (§4.6) | The **set of categories** and their names/slugs (`fashion-forward`, `sharp-formals`, `classic-essentials`, `sports-wear`, `easy-casuals`, `trendy-wear`, all dynamic `category/[slug]`) |
| **Icon symbols** — swap current icons for Lucide equivalents of the **same meaning/function** (§4.5) | **Adding or removing** any page, route, section, block, field, or feature |
| Typography (§5) | **Copy / text content / labels' meaning** (only the font/color/size changes) |
| Animations / interactions (§7) | Business logic, data fetching, API calls, click‑tracking, affiliate/click‑return flow |
| `className` / `style` / token wiring; markup **wrappers** needed purely to achieve the new visual layout | Information architecture, navigation destinations, page inventory, ordering of real content |

**Operating rules for every PR in this project:**
1. **Reskin, don't rebuild.** Touch styling and presentational markup only. If a change
   would alter *what data shows* or *which elements exist*, it's out of scope — stop.
2. **Icons are 1:1 replacements.** A search icon stays a search icon; only the glyph style
   changes. No new icons that imply new features; no removed icons that hide functions.
3. **Layout = restyle in place.** Cards/pills/rounded/bottom‑nav are applied to the
   *existing* components and their *existing* content — never by dropping or inventing sections.
4. **Every page keeps its current elements and data**, verified by before/after visual +
   content diff during QA (§9 per‑phase gate). Same products, same categories, same copy —
   new skin.
5. If the reference image shows something BranV doesn't currently have (e.g. a cart), it is
   **not added** by this project — it stays a forward‑spec only (see §7.5‑E note).

---

## 3. Design Token Architecture (the foundation everything else sits on)

This is Phase 1 and unblocks all other work. Two layers:

### 3.1 Layer 1 — Primitive tokens (raw scales, CSS custom properties)
Generate a full 50→900 scale per hue using the `ui-design-system` HSV algorithm
(`design_token_generator.py`) so hover/active/border/disabled tints are systematic, not
hand‑picked. Store in a new `apps/web/src/styles/design-tokens.css`:

```css
:root {
  /* Brand primary scale (example — see §4 for chosen hue) */
  --primary-50:#eef2ff; --primary-100:#e0e7ff; /* … */ --primary-600:#4f46e5;
  --primary-700:#4338ca; --primary-900:#312e81;
  /* Accent, secondary, neutral(slate), semantic(success/warning/danger/info) … */
}
```

### 3.2 Layer 2 — Semantic tokens (what components actually reference)
Components **only** ever touch semantic tokens, so re‑theming later = swap Layer‑1 values:

```css
:root {
  --color-canvas:        #ffffff;      /* page background */
  --color-surface:       #ffffff;      /* cards, sheets */
  --color-surface-muted: var(--neutral-50);
  --color-ink:           var(--neutral-900);   /* primary text */
  --color-ink-soft:      var(--neutral-600);   /* secondary text */
  --color-primary:       var(--primary-600);   /* primary CTA bg */
  --color-on-primary:    #ffffff;
  --color-accent:        var(--accent-500);    /* energy / highlights */
  --color-sale:          var(--danger-600);
  --color-new:           var(--accent-500);
  --color-border:        var(--neutral-200);
  --color-ring:          var(--primary-500);   /* focus */
  /* category identity tokens — see §4.4 */
}
```

### 3.3 Layer 3 — Tailwind mapping (so utilities become semantic)
Extend `tailwind.config.ts` so `bg-primary`, `text-ink`, `border-border`,
`ring-ring`, `bg-surface` exist as first‑class utilities:

```ts
// tailwind.config.ts (extend.colors)
colors: {
  canvas: 'var(--color-canvas)',
  surface: { DEFAULT: 'var(--color-surface)', muted: 'var(--color-surface-muted)' },
  ink: { DEFAULT: 'var(--color-ink)', soft: 'var(--color-ink-soft)' },     // extends existing `ink`
  primary: { DEFAULT: 'var(--color-primary)', fg: 'var(--color-on-primary)' },
  accent: 'var(--color-accent)',
  border: 'var(--color-border)',
  // sale, new, success, warning, danger, info …
}
```

> **Why CSS‑var‑backed Tailwind colors:** enables instant theme swaps, future dark mode,
> per‑category theming, and A/B palette tests **without recompiling class names** — the
> tokens change, every screen follows.

### 3.4 Migration mechanics (how 51 files get recolored safely)
A **codemod + review** approach, not manual find/replace:
1. Build a mapping table: `bg-black → bg-ink`, `text-white → text-primary-fg` *(context‑
   dependent)*, `bg-white → bg-surface`, `#0a0a0a → var(--color-ink)`, etc.
2. Script the unambiguous replacements (jscodeshift / regex with review) across
   `apps/web/src`.
3. **Manually adjudicate context‑sensitive cases** — `text-white` on a photo overlay vs.
   on a button vs. on the dark footer resolve to *different* semantic tokens.
4. Land per‑surface‑group PRs (shells → cards → pages) so review stays tractable and
   visual QA is scoped.
5. Add an ESLint guard (`no‑restricted‑syntax` / regex) that **fails CI on new raw
   `bg-black`/`#fff` literals**, preventing regression to hardcoded colors.

---

## 4. The New Color System — LOCKED ✅ ("Confident Blue")

The palette is **fixed to the approved BranV mobile reference**. The direction: a
**light‑gray canvas** with **white rounded cards**, **royal blue** as the single action/
brand color, **coral** as the urgency accent (sale/new/badges/cart count), and **amber**
for rating stars. This is trustworthy‑yet‑vibrant — the correct read for menswear e‑comm.

> Hex values below are read from the reference mockup and are the working spec; each
> foreground/background **pair is WCAG‑AA verified in Phase 0** (§8.1) and nudged along
> its scale step if a pair fails — the *hue direction is locked*, exact steps are tuned.

### 4.1 Core semantic palette
| Role | Hex | Token | Where it appears in the reference |
|---|---|---|---|
| **Primary** (brand/CTA) | `#1D4ED8` royal blue | `--color-primary` | "Shop Now", "View Cart", "Explore Deals", active bottom‑nav, active filter pill, "View All", logo "V" |
| Primary hover/pressed | `#1E40AF` blue‑800 | `--color-primary-hover` | button hover/press |
| On‑primary (text on blue) | `#FFFFFF` | `--color-on-primary` | button labels |
| **Accent** (urgency) | `#FF5A4D` coral | `--color-accent` | "20% OFF", "NEW", "BESTSELLER" badges, cart‑count bubble |
| On‑accent | `#FFFFFF` | `--color-on-accent` | badge text |
| **Canvas** (page bg) | `#F4F6F8` light gray | `--color-canvas` | app background behind cards |
| **Surface** (cards) | `#FFFFFF` | `--color-surface` | product cards, feature strip, sheets |
| Surface subtle | `#EEF2F7` | `--color-surface-muted` | inactive pills, chips, section bands |
| **Ink** (headings/body) | `#0F172A` slate‑900 | `--color-ink` | product titles, prices, "Shop by Category" |
| Ink soft (secondary) | `#6B7280` gray‑500 | `--color-ink-soft` | ratings count, meta, tagline |
| **Border/divider** | `#E5E7EB` gray‑200 | `--color-border` | card edges, dividers, outline pills |
| **Rating** (stars) | `#F59E0B` amber | `--color-rating` | review stars |
| Sale price strike | `#9CA3AF` gray‑400 | `--color-ink-muted` | crossed‑out MRP |
| Focus ring | `#1D4ED8` @ 40% | `--color-ring` | keyboard focus (replaces black `accent-color`) |
| Success / Warning / Danger | `#16A34A` / `#F59E0B` / `#DC2626` | semantic | toasts, form states |

### 4.2 Hero / banner gradient
The reference hero is a **diagonal blue gradient** with white editorial text over the
model photo. Locked as a reusable token:
```css
--gradient-hero: linear-gradient(120deg, #1E3A8A 0%, #1D4ED8 55%, #2563EB 100%);
/* navy → royal → bright blue, top-left to bottom-right */
```
Used for: hero wash, the active bottom‑nav indicator glow, and primary‑CTA sheen.

### 4.3 Tailwind mapping (updated for the locked hues)
```ts
colors: {
  canvas: 'var(--color-canvas)',
  surface: { DEFAULT: 'var(--color-surface)', muted: 'var(--color-surface-muted)' },
  ink: { DEFAULT: 'var(--color-ink)', soft: 'var(--color-ink-soft)', muted: 'var(--color-ink-muted)' },
  primary: { DEFAULT: 'var(--color-primary)', hover: 'var(--color-primary-hover)', fg: 'var(--color-on-primary)' },
  accent: { DEFAULT: 'var(--color-accent)', fg: 'var(--color-on-accent)' },
  rating: 'var(--color-rating)',
  border: 'var(--color-border)',
}
```

### 4.4 Category color identity (optional, blue‑anchored)
Curated pages can each take a **derived accent** for hero wash/chips while all sharing the
blue chrome. Kept restrained so the brand stays blue‑led:

| Page | Accent hue |
|---|---|
| `sharp-formals` | Navy / royal blue (brand default) |
| `classic-essentials` | Slate / stone |
| `easy-casuals` | Teal |
| `fashion-forward` | Indigo |
| `trendy-wear` | Coral (accent) |
| `sports-wear` | Electric blue / cyan |

Implemented as a `data-theme` / scoped CSS‑var override on the page wrapper — **zero
component changes**, pure token remap.

### 4.5 Iconography (from reference)
The reference uses a **single outline icon family** with a consistent stroke:
- **Library:** **Lucide** (`lucide-react`) — matches the thin, rounded outline look
  (search, heart/wishlist, bag/cart, hamburger, filter, sort chevron, shield, truck,
  refresh, category glyphs, bottom‑nav home/grid/compass/heart/user).
- **Rules:** one family only; **24px** base (`icon-md`), 20px small, 28px large as tokens;
  **1.75–2px** stroke; **filled variant only for the active bottom‑nav item** (home in
  reference), outline everywhere else (`filled-vs-outline` discipline).
- **Color:** icons inherit `--color-ink` (default) / `--color-primary` (active) /
  `--color-on-primary` (on blue) — never hardcoded.
- **A11y:** every icon‑only control gets an `aria-label`; tap target ≥ 44×44 (use padding/
  hitbox, not larger glyphs). **No emoji as icons** (the reference's 🔥 "Trending" flame is
  the *one* decorative exception — replace with a Lucide `flame` for consistency, or keep as
  intentional editorial emphasis, your call).

### 4.6 Outer layout & card system (from reference)
The visual "shell" language to standardize across the app:
| Element | Spec from reference |
|---|---|
| Page canvas | `--color-canvas` gray, content in white cards floating on it |
| Card radius | ~**16px** (`rounded-2xl`) on product cards, hero, feature strip, sheets |
| Card shadow | soft, low‑spread (`shadow-sm`→`shadow-md` on hover) — one elevation scale |
| Product card | white surface, image top (rounded), wishlist heart in a white circle top‑right, coral badge top‑left, title / price(+struck MRP) / amber rating+count / color swatches row with "+N" |
| Filter/sort | **pill** buttons; active = solid blue, inactive = white w/ `--color-border` |
| Feature strip | 4 icon+label cells in a light rounded card (Premium Quality / Trend Focused / Easy Returns / Secure Payments) |
| Category rail | circular/rounded image tiles with label; horizontal scroll on mobile |
| Bottom nav (mobile) | white bar, **5 items**, safe‑area padding, active = blue filled icon+label, others outline |
| Top bar | logo left (BranV + "ALL FOR MEN"), search/wishlist/cart right, cart shows coral count bubble |
| Spacing | 4/8px rhythm; comfortable card gutters (`gap-3`/`gap-4`) |

These map onto existing components — `ProductCard`, `StorefrontShell`, `MobileBottomNav`,
`Filters`, `CategoryShowcase`/`CategoryCatalog`, `HeroCarousel*` — so applying this layout
language is **restyling existing components with tokens**, not rebuilding them.

### 4.7 Banner / hero image sizing — **preserved (explicit requirement)**
> Per your instruction, the redesign **keeps your current banner/hero image dimensions and
> aspect ratios unchanged.** We restyle *around* the image — gradient overlay, text block,
> "Shop Now" pill, carousel dots, rounded container — but **do not alter** the image
> `width`/`height`/`aspect-[…]`/`sizes` already defined in `HeroCarouselDesktop.tsx`,
> `HeroCarouselMobile.tsx`, and `ProductCard.tsx` (`aspect-[4/5]`). This also protects CLS
> (no layout shift) and means no re‑cropping/re‑exporting of existing creative is required.

---

## 5. Typography System

Current state: system‑font stack, no brand voice. **The reference is an all–sans‑serif,
bold‑geometric design** (headings like "Wear Your Confidence" / "Shop by Category" and body
share one clean sans). We match that — a single sans family carries the whole system, no
serif:

| Role | Font | Rationale |
|---|---|---|
| Display / headings | **Poppins** (or Montserrat) | bold geometric sans matching the reference's confident headings |
| Body / UI | **Inter** (or Montserrat) | excellent legibility at 16px, wide weight range, pairs cleanly with Poppins |
| Numeric (prices) | Body font **tabular‑nums** | prevents price/table layout shift (`number-tabular`) |

> Simplest coherent option matching the reference is to use **one family
> (Montserrat or Poppins) for everything**, varying weight for hierarchy (700 headings /
> 500 labels / 400 body) — fewer fonts, faster load, and exactly the reference's look.

Implementation via `next/font` (self‑hosted, `display: swap`, preloaded critical weights
only — per `font-loading`/`font-preload` budget rules). Fluid type scale using `clamp()`
from `ui-design-system`:

```css
--fluid-h1: clamp(2rem, 1rem + 3.6vw, 4rem);
--fluid-h2: clamp(1.75rem, 1rem + 2.3vw, 3rem);
--fluid-body: clamp(1rem, 0.95rem + 0.2vw, 1.125rem);
```
Base body **16px min** (mobile no‑zoom rule, already respected in `globals.css`),
line‑height 1.5–1.6, measure 60–75ch desktop / 35–60ch mobile.

---

## 6. Motion & Animation System — shared foundation

We build on the existing `bv-*` engine and `motion-tokens.css`. Global principles
(`ui-ux-pro-max` §7): micro‑interactions **150–300ms**, transitions ≤400ms, **transform/
opacity only**, ease‑out entering / ease‑in exiting, **exit ~60–70% of enter duration**,
stagger lists **30–50ms/item**, animate **1–2 key elements per view**, everything
**interruptible** and **reduced‑motion‑guarded**.

### 6.1 Extend the token layer
Add to `motion-tokens.css`: spring‑like curves for the new "alive on interaction" feel,
plus color‑transition tokens (theme change / hover color shifts):
```css
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);   /* already have --ease-emphasized */
--motion-color: 200ms;                               /* hover color fades */
```

### 6.2 Motion inventory (what animates, and why)
| Interaction | Cause→effect | Notes |
|---|---|---|
| Scroll reveal | content enters viewport | reuse `.bv-enter` / `.in-view` |
| Product card hover (desktop) | affordance + image swap | already present; add accent‑ring + lift |
| CTA hover/press | actionability + feedback | gradient shift + `scale(0.97)` press |
| Add‑to‑wishlist | confirmation | reuse `bv-heart-pop` |
| Nav / dropdown / flyout | spatial hierarchy | already choreographed — recolor only |
| Page transition | continuity | `PageTransitionShell` + directional slide |
| Filter/sort apply | system responding | skeleton + crossfade grid |
| Modal / drawer / sheet | originates from trigger | `modal-motion` — scale+fade / slide |
| Toasts / form success | feedback | color‑flash + checkmark |

> This is the *shared* overview. The **full, per‑interaction build sheet** (drag carousels,
> morphing search, swipe‑to‑delete, fly‑to‑cart, accordions, checkout, etc.) with mobile +
> desktop variants and reduced‑motion fallbacks lives in **§7.5 Interaction Specification
> Library**.

---

## 7. Desktop vs. Mobile Motion — designed **individually** (explicit brief requirement)

Different input models and performance envelopes demand different choreography. This is
gated on breakpoints already defined in `tailwind.config.ts` (`lg: 1080px`).

### 7.1 Desktop (≥1080px) — "hover‑rich, spatial, cinematic"
| Surface | Desktop treatment |
|---|---|
| Hero | Ken Burns + parallax layers (subtle), gradient wash animates in, text stagger (exists) |
| Product grid | Hover: image crossfade to secondary, **‑translate‑y lift**, accent ring, quick‑add reveal |
| Nav | Hover mega‑dropdown with staggered items (exists) + animated active‑indicator underline |
| Sections | Scroll‑reveal with directional stagger; larger travel distances (24px) |
| CTAs | Gradient sweep on hover, cursor‑proximity glow (optional, cheap) |
| Cursor | Grab/grabbing on carousels (exists); keep |

### 7.2 Mobile (<1080px) — "tap‑feedback, momentum, thumb‑reachable"
Hover doesn't exist — every hover affordance needs a **tap/scroll equivalent**
(`hover-vs-tap` rule). Motion must be cheaper (mid‑tier Android budget).
| Surface | Mobile treatment |
|---|---|
| Hero | Single‑layer Ken Burns only (drop parallax); swipe carousel with momentum |
| Product grid | **Press‑state scale (0.97)** instead of hover‑lift; secondary image on tap‑hold or 2nd tap |
| Nav | `MobileNavDrawer` slide‑in + `MobileBottomNav` — animated active tab, safe‑area aware |
| Reveals | Smaller travel (12px), shorter duration, fewer simultaneous elements |
| Sheets | `DidYouBuyBottomSheet`/`QuickAddModal` slide‑up from bottom, swipe‑to‑dismiss |
| Filters | Full‑screen sheet (not dropdown), animated apply |
| Feedback | Consider haptic on add‑to‑wishlist / add‑to‑cart (`haptic-feedback`) |

### 7.3 Shared guardrails (both)
- `prefers-reduced-motion` → collapse to opacity‑only / none (block already exists — extend to new classes).
- No animation on width/height/top/left (CLS). Reserve image dimensions (already done via `next/image` `fill` + aspect ratios).
- Lenis smooth scroll respected; ensure new scroll‑reveals read from Lenis, not a second RAF loop.

### 7.4 Library decision — **ADOPT Framer Motion** (updated)
The goal is now a **native‑feeling, gesture‑driven mobile experience** (drag physics,
swipe‑to‑delete, fly‑to‑cart, morphing search, bottom‑sheets). These are impractical in
raw CSS. Decision:

> **Add `motion` (Framer Motion v11+, React‑19 compatible; import from `motion/react`)**
> as the engine for the *interactive / gesture layer*, and **keep the existing CSS `bv-*`
> system + Lenis** for cheap scroll reveals and the smooth‑scroll spine. Two engines, clear
> division of labor — not a rip‑and‑replace.

**Division of labor**
| Use CSS `bv-*` (keep) | Use Framer Motion (new) |
|---|---|
| Scroll‑reveal entrances (`.bv-enter`, `.in-view`) | Drag/swipe physics (carousels, swipe‑to‑delete) |
| Nav/dropdown/flyout stagger (already tuned) | `AnimatePresence` enter/exit (sheets, list removal) |
| Hero text stagger, Ken Burns, heart‑pop | `layout` prop morphs (search icon→input, height auto) |
| Simple hover/color transitions | Gesture feedback (`whileTap`), fly‑to‑cart keyframes |

**Budget mitigation (protects the 150 KB/route rule, §2.3)**
- Import via **`LazyMotion` + `domAnimation`** feature bundle (`m` components) → ~5–6 KB
  gzip core instead of the full ~34 KB; load `domMax` only where drag is needed.
- **Code‑split** heavy interactive components with `next/dynamic({ ssr:false })` so Framer
  ships only on routes that use it (PLP, PDP, cart/checkout when added), not globally.
- Keep global chrome (header, bottom nav) light; use `m.*` primitives, not full `motion.*`.

**Lenis coexistence (critical — learned from existing `animated-drawer.tsx`)**
- On any Framer overlay/scroll area: add `data-lenis-prevent`; call `lenis.stop()` while a
  full‑screen sheet/overlay is open and `lenis.start()` on close (existing pattern).
- For `drag="x"` carousels, gate to horizontal so Lenis keeps owning vertical scroll; avoid
  a second RAF scroll loop. For scroll‑linked effects use Lenis's `scroll` value, not a
  parallel `useScroll` listener, to prevent jank.

**React 19 hygiene (per your prompt)** — `'use client'` only on interactive leaves;
`useEffect` cleanups on all listeners/timers/observers; respect `useReducedMotion()` in
every component (maps to §8 reduced‑motion gate).

### 7.5 Interaction Specification Library (the animation build sheet)

Every interaction from the brief, specified with its **Framer Motion technique**, the
**mobile** (primary, gesture‑first) and **desktop** (pointer/hover) variant, the **target
BranV component**, and the **reduced‑motion fallback**. This is the checklist Phase 4 builds
against. Timings follow §6 tokens (micro 150–300ms, springs for physical elements).

#### A. Navigation & header
| # | Interaction | Mobile (primary) | Desktop | Target file | Technique | Reduced‑motion |
|---|---|---|---|---|---|---|
| A1 | **Sticky header hide/show on scroll** | Hide on scroll‑down, slide back on scroll‑up; stays visible at top | Same, subtler; may stay pinned | `StorefrontShell` header | `useMotionValueEvent` on Lenis scroll → animate `y: -100%/0`; spring | No transform — header static/pinned |
| A2 | **Hamburger → X morph** | 3 `m.div` bars morph to X on tap | hover tint + click morph | `StorefrontShell` / new `MenuButton` | animate bar `rotate`/`y`/`opacity` between two variants | Instant swap to X icon |
| A3 | **Full-width nav overlay** | Slides in from screen edge, full width; backdrop; swipe/tap to close | Slide/fade panel | `MobileNavDrawer` (exists) | `AnimatePresence` + `x:"-100%"→0`; `data-lenis-prevent`, `lenis.stop()` | Fade only |
| A4 | **Search morph icon→input** | Tap icon → morphs to full-width input | Click/focus expands inline | `SearchBox` | Framer **`layout`** prop + `layoutId`; autofocus on open | No morph — show input immediately |
| A5 | **Autocomplete results cascade** | Results fade‑in‑up, staggered | Same | `SearchBox` results | parent `staggerChildren:0.04`, child `y:8→0, opacity` | All appear at once, no stagger |
| A6 | **Bottom nav active tab** | Active icon fills + blue indicator pill slides between tabs | n/a (desktop uses top nav) | `MobileBottomNav` | shared `layoutId` indicator + `whileTap scale:0.9` | Color change only |

#### B. Product discovery (Home / PLP / category)
| # | Interaction | Mobile | Desktop | Target | Technique | Reduced‑motion |
|---|---|---|---|---|---|---|
| B1 | **Banner + product carousels** | Native swipe: `drag="x"` with **spring snapping**, boundary‑aware | Arrows + drag; Ken Burns on hero | `HeroCarousel*`, category rails | `drag="x"`, `dragConstraints`, `type:"spring"` snap; **keeps existing banner image sizes (§4.7)** | Static scroll‑snap (CSS), no drag inertia |
| B2 | **Skeleton loaders** | `animate-pulse` cards over fluid placeholders while fetching | Same | new `ProductCardSkeleton`, grid loading states | Tailwind `animate-pulse`; reserve exact card dims (no CLS) | Keep (gentle pulse) or static gray |
| B3 | **Product card entrance** | Grid items stagger fade‑up on scroll | Same, larger travel | `ProductCard` grids | reuse `.bv-enter` + `.in-view` (CSS — no Framer cost) | Opacity only |
| B4 | **Card press / hover** | `whileTap scale:0.97` press feedback | hover ‑translate‑y lift + accent ring + quick‑add reveal | `ProductCard` | Framer `whileTap` (mobile) / CSS hover (desktop) | No scale/lift |
| B5 | **Wishlist heart** | `whileTap scale:0.9` → **pop to 1.3 → settle 1** when liked; coral fill | Same on click | `ProductCard` (reuse `bv-heart-pop` idea) | `whileTap` + keyframes `scale:[1,1.3,0.9,1]` | Instant fill, no pop |

#### C. Filters & PLP controls
| # | Interaction | Mobile | Desktop | Target | Technique | Reduced‑motion |
|---|---|---|---|---|---|---|
| C1 | **Filter bottom-sheet** | `AnimatePresence` sheet slides up `y:"100%"→0`, full width, spring mass; drag‑down to dismiss | Dropdown/side panel | `Filters` + `animated-drawer` (bottom side exists) | `AnimatePresence`, spring; `data-lenis-prevent`; focus trap | Fade/instant, no slide |
| C2 | **Filter/sort pills** | active pill fills blue with `layout` transition | Same | `Filters`, `SubcategoryChips` | `layout` + color transition | Color only |
| C3 | **Grid re-flow on apply** | items crossfade/reposition | Same | PLP grid | `layout` on grid items (or CSS crossfade) + skeleton during fetch | Instant swap |

#### D. Product Detail Page (PDP)
| # | Interaction | Mobile | Desktop | Target | Technique | Reduced‑motion |
|---|---|---|---|---|---|---|
| D1 | **Specs accordion** | Unrolls `height:0→"auto"` smoothly | Same | `products/[slug]` | Framer `animate` height auto (or `<motion.section>` with `initial/animate`) | Toggle display, no height anim |
| D2 | **Image gallery** | Swipe between images (`drag="x"`), pinch‑zoom optional | Thumbnail hover/click, zoom on hover | PDP gallery | `drag="x"` + snap; keeps image aspect (§4.7) | Scroll‑snap |
| D3 | **Buy / click-out CTA** | `whileTap scale:0.97`; gradient sheen | hover sheen | PDP + `click-tracking` | `whileTap` + CSS gradient | No scale |

#### E. Cart & "buy" flow — *adapted to BranV's affiliate model*
> **Note:** BranV today is **one‑click‑to‑buy (affiliate)** — no `/cart` or `/checkout`
> route exists. Your reference image shows a cart, so specs below are written to **(a) work
> now** with the current wishlist / click‑return flow, and **(b) drop straight in if a cart
> is introduced.**
| # | Interaction | Now (affiliate) | If cart added | Target | Technique | Reduced‑motion |
|---|---|---|---|---|---|---|
| E1 | **Fly‑to‑target** | On wishlist/buy, a `motion.img` flies a **curved keyframe** path into the header wishlist/cart icon | Same → cart icon | new `FlyToCart` overlay | absolute `motion.img`, keyframe `x/y` curve + `scale`; cleanup on complete | Skip flight; badge just increments |
| E2 | **Header badge bounce** | Wishlist/cart count badge `scale:[1,1.4,1]` bounce | Same | `StorefrontShell` badge, `MobileBottomNav` | keyframe scale array | Number change only |
| E3 | **Swipe‑to‑delete row** | Drag row horizontally; past threshold → `exit={{height:0,opacity:0}}` collapse, neighbors shift up | Same (wishlist/cart list) | `wishlist` list, future cart | `drag="x"`, threshold in `onDragEnd`, `AnimatePresence` + `layout` | Delete button + instant removal |
| E4 | **"Did you buy?" sheet** | Existing `DidYouBuyBottomSheet`/`NicePickModal` — upgrade to spring slide‑up + `AnimatePresence` | — | `click-return/*` | `AnimatePresence` bottom‑sheet | Fade |

#### F. Checkout — *forward‑spec (when cart/checkout is built)*
| # | Interaction | Mobile & Desktop | Technique | Reduced‑motion |
|---|---|---|---|---|
| F1 | **Multi-step progress bar** | Width fills fluidly across container per step | Tailwind width transition (or `motion` width) + `layout` | Instant width jump |
| F2 | **Input error shake** | Field shakes horizontally on validation fail | keyframe `x:[0,-8,8,-6,6,0]`, ~300ms | No shake — red border + message only |
| F3 | **Order success checkmark** | Green circle + **SVG stroke‑draw** tick | `motion.path` `pathLength:0→1`; `canvas-confetti` (already a dep!) optional | Show static check |

#### G. Global feedback
| # | Interaction | Behavior | Technique | Reduced‑motion |
|---|---|---|---|---|
| G1 | Toasts | slide/fade in, auto‑dismiss 3–5s, `aria-live` | `AnimatePresence` | fade/instant |
| G2 | Page transition | keep `PageTransitionShell`; add directional slide (fwd left / back right) | opacity + small `x` | opacity only (current) |
| G3 | Haptics (mobile) | light tap on wishlist/buy confirm where supported | `navigator.vibrate?.(10)` guarded | n/a |

### 7.6 External references — what to mine from each
| Source | Use it for |
|---|---|
| **lenis.dev** | Smooth‑scroll spine (already installed). Reference for scroll‑linked animation patterns and correct `drag`/scroll coexistence — read Lenis value, don't stack a second scroll loop. |
| **motionsites.ai** | Curated Framer Motion site patterns — reference implementations for hero drag carousels, sticky‑hide headers, staggered reveals, layout morphs. |
| **designspells.com** | Catalog of delightful micro‑interaction "spells" — mine for the *small* details (badge bounce, heart pop, button press, success states) that make it feel native. |
| **uiverse.io** | Open‑source CSS/Tailwind element animations (buttons, loaders, toggles, skeletons) — quick wins for non‑gesture flourishes without Framer cost. |
| **dribbble.com/shots/popular** | Visual direction / choreography inspiration for e‑comm mobile — timing feel, sheet behavior, empty/success states. Translate, don't copy. |

> **Curation rule:** treat these as *pattern* references, not paste sources. Every borrowed
> interaction must pass §8 gates (reduced‑motion, contrast, 44px targets, CLS, budget) and
> use BranV tokens (§4) before it ships.

---

## 8. Accessibility & Performance Gates (non‑negotiable)

### 8.1 Accessibility (WCAG AA)
- Every semantic token **pair** (`ink`/canvas, `on-primary`/`primary`, accent/surface)
  verified ≥ **4.5:1** (3:1 large) using the `ui-design-system` contrast check. Colorful
  accents on white are the highest‑risk pairs — verify before adoption.
- Color never the sole signal (sale/new/error also carry icon/text — `color-not-only`).
- Focus rings: replace `accent-color:#000` with `--color-ring`; keep visible 2–4px rings.
- Touch targets ≥ 44×44; maintain across recolored buttons.
- Reduced‑motion parity for all new motion classes.

### 8.2 Performance (Core Web Vitals, §2.3 budgets)
- Theme is CSS‑led → **near‑zero JS delta**. Enforce via bundle check in CI.
- Fonts self‑hosted, `swap`, critical‑weight preload only.
- Gradients/blur used sparingly on mobile (backdrop‑filter is the one "moderate‑poor"
  perf item flagged for glass styles) — cap blur usage, test on mid‑tier Android.
- Maintain CLS: no layout‑animating properties; keep reserved image space.

---

## 9. Sequenced Phase‑Wise Execution Plan (Task 2)

Ordered so the **highest‑visibility surface flips earliest** and risk stays contained. The
sequence is **P0 → P8**. Each phase lists **ordered steps**, its **deliverable**, and an
**exit gate**. Every phase gate includes the **UI‑reskin check (§2.4)** — before/after
*content* diff must be empty (same data, same elements) — and visual QA on
**375 / 768 / 1080 / 1440px + reduced‑motion + Lighthouse**.

### 9.0 Total‑coverage guarantee (every page · sub‑page · section)
> **Requirement:** the new theme must reach **100% of pages, sub‑pages, and every section**
> — nothing left on the old skin.

Mechanism:
1. **Coverage registry** — a tracked checklist `theme-coverage.md` enumerating **every
   route** (§1.3 / §9.9 registry) and **every section within it** (hero, rails, strips,
   cards, filters, forms, footer, modals, empty/loading/error states). A route is "done"
   only when *all* its sections are ticked for **both** mobile and desktop.
2. **Zero‑literal enforcement** — the ESLint raw‑color guard (§3.4) fails CI on any
   remaining `bg-black`/`text-white`/`#000`/`#fff`. When the whole `apps/web/src` tree
   passes, no un‑themed color can physically remain.
3. **Automated audit** — a script greps for legacy color literals + non‑Lucide icons per
   route and prints an outstanding list until it reaches zero.
4. **Global surfaces first (P1)** — theming shared shells/components recolors most sections
   of every page at once; later phases are per‑route section sweeps to catch the remainder.

### 9.1 Phase summary
| Phase | Focus | Depends on |
|---|---|---|
| **P0** | Foundations: tokens, Tailwind, fonts, icons, Framer scaffolding, CI guards, coverage registry | — |
| **P1** | Global chrome & shared components (recolors most sections everywhere) | P0 |
| **P2** | Storefront core pages + all their sections | P1 |
| **P3** | Curated landing + content pages + all sections | P1 |
| **P4** | Account, auth, commerce pages + all sections | P1 |
| **P5** | Motion layer (Framer Motion §7.5) — mobile‑first, then desktop | P1 (per‑surface) |
| **P6** | Admin (`/admin/*`) reskin | P1 |
| **P7** | Cross‑cutting states: empty / loading / error / toast / 404 on every route | P2–P6 |
| **P8** | Full‑coverage QA, perf/a11y sign‑off, launch | P2–P7 |

### 9.2 P0 — Foundations *(no visible change)*
1. Confirm the four forcing assumptions (§2.3).
2. Generate primitive color scales from locked hues (§4.1) → `styles/design-tokens.css`.
3. Add semantic token layer (§3.2) + map into `tailwind.config.ts` (§4.3).
4. Install fonts via `next/font` (§5); wire base type scale.
5. Install **Lucide** (`lucide-react`); create an icon map (old symbol → Lucide equivalent, §4.5).
6. Install **`motion`**; add `LazyMotion` provider, `useReducedMotion` hook, `next/dynamic` motion wrappers (§7.4).
7. Add **ESLint raw‑color guard** + **per‑route JS budget check** to CI (§3.4, §2.3).
8. Create the **coverage registry** `theme-coverage.md` (§9.0) and the audit script.
- **Deliverable:** token system + tooling live. **Gate:** builds green; contrast passes; guards active; **zero visual change** confirmed.

### 9.3 P1 — Global chrome & shared components *(recolors most sections at once)*
Sequence (each = its own reviewable PR):
1. `StorefrontShell` — top bar (logo, search, wishlist, cart badge), footer, page canvas (gray) + card surfaces.
2. `MobileBottomNav` — 5 items, active blue, safe‑area.
3. `MobileNavDrawer` + nav dropdowns/flyouts — recolor only (choreography already exists).
4. `ProductCard` — white card, radius, shadow, coral badge, amber rating, swatches, wishlist heart (**image sizes preserved §4.7**).
5. `HeroCarousel*` — gradient wash, text block, "Shop Now" pill, dots (**banner sizes preserved §4.7**).
6. Shared `Filters`, `SubcategoryChips`, `CustomSelect`, `SearchBox` — pills/inputs/borders.
7. Shared modals/drawers/sheets (`animated-modal`, `animated-drawer`, `QuickAddModal`, `click-return/*`, `BrandFormModal`).
8. Swap all icons in these to Lucide (§4.5).
- **Deliverable:** every storefront page already reads "new theme" in its shared regions. **Gate:** zero literals in these files; content unchanged; both breakpoints.

### 9.4 P2 — Storefront core pages (all sections each)
Per‑route, tick **every section** in the registry:
1. `/` home — hero, category rail, trending rail, feature strip, promo band, any editorial blocks.
2. `/shop`, `/new`, `/sale` — filter bar, product grid, pagination/load‑more, empty state.
3. `/search` — query bar, results grid, no‑results state.
4. `category/[slug]` (dynamic — covers **all** categories) — header, chips, grid.
5. `products/[slug]` PDP — gallery, title/price, swatches, specs, description, reviews (`ReviewsSection`), related rail, buy/click‑out.
- **Deliverable:** P0‑group pages 100% themed. **Gate:** registry sections all ticked ×2 breakpoints; content diff empty.

### 9.5 P3 — Curated landing + content pages (all sections each)
1. Six curated pages — `fashion-forward`, `sharp-formals`, `classic-essentials`, `sports-wear`, `easy-casuals`, `trendy-wear` (optional category accent §4.4).
2. `articles` + `articles/[slug]` (`ArticleBody`, `EmbeddedProductCard`).
3. `lookbooks/[slug]` (`ShoppableImage`), `edits/[slug]`.
4. `brands` + `brands/[slug]` (`BrandStorySection`).
5. `help`, `terms`, `newsletter` + `newsletter/confirm|unsubscribe`.
- **Gate:** every section themed ×2 breakpoints; content unchanged.

### 9.6 P4 — Account, auth & commerce pages (all sections each)
1. `AuthShell` + `login`, `register`, `forgot-password`, `reset-password`, `verify-email`.
2. `account` + `account/preferences`, `account/notifications` (`NotificationsBell`).
3. `wishlist`, `wardrobe`.
- **Gate:** forms, states, and sections themed ×2 breakpoints; flows unchanged.

### 9.7 P5 — Motion layer (Framer Motion, §7.5) — mobile‑first
Build per interaction group, **mobile variant first, desktop second**, each with its
reduced‑motion fallback; can start on any surface once P1 has themed it:
1. Nav group **A** (sticky hide/show, hamburger→X, overlay, search morph, autocomplete, bottom‑nav indicator).
2. Discovery group **B** (drag carousels, skeletons, card press, wishlist pop).
3. Filters group **C** (bottom‑sheet, pills, grid reflow).
4. PDP group **D** (accordion, gallery swipe, CTA feedback).
5. Feedback/buy groups **E/G** (fly‑to‑target, badge bounce, swipe‑to‑delete on wishlist, "did you buy" sheet, toasts, page transition, haptics).
6. Checkout group **F** — forward‑spec only (build when a cart exists).
- **Gate:** every applicable §7.5 row done for **mobile + desktop**; 60fps on mid‑tier Android; per‑route JS within budget.

### 9.8 P6 — Admin reskin
1. `AdminShell` chrome (sidebar, top bar, tables).
2. `/admin/*` pages (products, brands, categories, articles, edits, lookbooks, banners, avatars, reviews, audit, affiliate/reconciliation, settings, login, setup‑2fa, dashboard) — utilitarian token application, readability over flourish; `MiniBarChart` on tokens.
- **Gate:** all admin routes on‑token and legible; data/tables unchanged.

### 9.9 P7 — Cross‑cutting states (every route)
Sweep the states that are easy to miss, on **every** route: **empty**, **loading/skeleton**,
**error**, **toast**, **404/not‑found**, disabled/focus states, and any modal/sheet reachable
from that route. Tick these in the registry per route.
- **Gate:** no un‑themed state remains in the audit script output.

### 9.10 P8 — Full‑coverage QA & launch
1. Run the audit script → **must report 0 outstanding routes/sections/legacy literals/non‑Lucide icons**.
2. Cross‑device visual QA (375/768/1080/1440) + reduced‑motion pass.
3. Lighthouse perf + a11y floors; per‑route JS budget check.
4. Content‑parity diff across the whole site (same data/categories/elements as pre‑reskin — §2.4).
5. Visual‑regression snapshot; stakeholder sign‑off; launch.

### 9.11 Dependency graph & coverage flow
```
P0 (foundations + registry)
   └─▶ P1 (global chrome  →  recolors most sections of ALL pages)
          ├─▶ P2 (storefront core)   ─┐
          ├─▶ P3 (curated + content) ─┤
          ├─▶ P4 (account + auth)    ─┼─▶ P7 (cross‑cutting states) ─▶ P8 (full‑coverage QA → launch)
          ├─▶ P5 (motion, mobile‑first, per‑surface) ─┤
          └─▶ P6 (admin)             ─┘
```
P0 blocks everything. After P1, P2–P6 run in parallel per surface. **The coverage registry
(§9.0) + zero‑literal CI guard are what make "every page, sub‑page, and section" verifiable,
not aspirational** — P8 cannot pass until the audit reports zero remaining surfaces.

---

## 10. Risks, Mitigations & Rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| Recoloring 51 files misses context (white‑on‑photo vs. white‑on‑button) | High | Codemod + **manual adjudication** of `text-white`/`bg-white`; per‑group PRs |
| "Colorful" drifts into low‑trust/toy look | Medium | §2.1 restraint principle; accent‑layer only; design review gate per phase |
| Contrast failures on saturated accents | Medium | Verify every pair pre‑adoption (§8.1); adjust scale step, not vibe |
| Perf regression from gradients/blur/parallax on mobile | Medium | Mobile motion budget (§7.2); cap blur; mid‑tier Android test |
| Scope creep across 58 pages | High | Strict P0→P8 phasing; token layer makes later pages cheap |
| **A page/section gets missed (incomplete coverage)** | Medium | Coverage registry (§9.0) + zero‑literal CI guard + audit script; P8 blocks launch until audit = 0 |
| **Reskin accidentally alters data/elements (violates §2.4)** | Medium | Per‑phase content‑diff gate; PRs limited to styling/presentational markup; content‑parity check in P8 |
| Regression to hardcoded colors over time | Medium | ESLint CI guard (§3.4) |
| Two competing scroll systems (Lenis + new RAF) | Low | Reuse `.in-view`/IO; no second scroll loop |
| **Framer Motion inflates bundle** | Medium | `LazyMotion`+`domAnimation` (~5–6 KB); `next/dynamic` code‑split to interactive routes; `m.*` not `motion.*`; CI per‑route budget |
| **Framer `drag` fights Lenis scroll** | Medium | `data-lenis-prevent` + `lenis.stop()/start()` on overlays (existing pattern); constrain drag to one axis; read Lenis scroll value, no parallel `useScroll` |
| **Gesture animations feel janky on mid‑tier Android** | Medium | transform/opacity only; spring configs tuned + tested on real device; reduced‑motion + `will-change` discipline |
| **Cart/checkout specs (E/F) assume a flow that doesn't exist yet** | Low | Written to work with current affiliate/wishlist flow now; cart/checkout rows are forward‑spec, gated on that feature landing |

**Rollback:** Because everything resolves to Layer‑2 semantic tokens, a full revert to the
black/white theme = **re‑point the semantic tokens to `#000/#fff/ink`** in one file.
The token architecture *is* the rollback switch (and the future dark‑mode / A‑B switch).

---

## 11. Success Metrics

| Dimension | Target |
|---|---|
| Visual coverage | 100% of pages resolve to semantic tokens; 0 raw color literals (CI‑enforced) |
| Accessibility | All token pairs WCAG AA; Lighthouse a11y ≥ existing floor |
| Performance | LCP ≤ 2.0s, INP ≤ 200ms, CLS ≤ 0.1 @ p75 mobile; per‑route JS within budget even with Framer (code‑split, `LazyMotion`) |
| Motion quality | Every §7.5 interaction shipped for mobile + desktop; native‑feeling gesture response (drag/swipe/tap) at 60fps; reduced‑motion parity per row; no CLS from motion |
| Business (post‑launch) | Monitor PDP→click‑out rate, add‑to‑wishlist rate, bounce, time‑on‑category — guard against regressions, ideally lift from stronger interaction affordances |

---

## 12. Immediate Next Actions

1. ~~Choose a palette~~ — **DONE.** Palette locked to "Confident Blue" from the reference (§4).
2. **Confirm the four forcing assumptions** (§2.3) — device, CWV targets, JS budget, WCAG owner.
3. Execute **P0 Foundations**: generate the token scales from the locked hues
   (`--color-primary #1D4ED8`, `--color-accent #FF5A4D`, canvas/surface/ink/border/rating),
   wire Tailwind (§4.3), add the Lucide icon set (§4.5), add fonts, run WCAG‑AA contrast
   verification on every pair, land the ESLint raw‑color guard. *(No visible change — safe first step.)*
4. **P1 global chrome**: restyle `StorefrontShell`, top bar, `MobileBottomNav`,
   `ProductCard`, hero, `Filters` into the card/pill/blue language of §4.6 — the first
   visible transformation across all pages. **Banner image sizes preserved (§4.7).**
5. Then sweep **P2–P7** per the sequenced plan (§9) — storefront, curated/content,
   account/auth, **motion layer (P5, mobile‑first)**, admin, and cross‑cutting states —
   tracked to **100% coverage** via the registry + audit script (§9.0), ending in **P8**
   full‑coverage QA and launch. Every phase enforces the **UI‑reskin scope (§2.4)**.

---

*This plan builds on BranV's existing motion foundation (`bv-*`, Lenis, motion‑tokens) and
now layers **Framer Motion** on top for a native‑feeling, gesture‑first mobile experience
(§7.4–7.6). Two efforts run in parallel: the **color migration** — the primary engineering
lift, because the theme is hardcoded across 51 files rather than tokenized (the §3 token
architecture turns "recolor the whole site" into "change one layer") — and the **interaction
layer** (§7.5), where mobile is designed to feel like a native app: drag carousels, morphing
search, swipe‑to‑delete, fly‑to‑cart, bottom‑sheets, and spring physics, all guarded by
reduced‑motion and per‑route bundle budgets.*
