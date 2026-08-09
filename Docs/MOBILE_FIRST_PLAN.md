# Mobile-First Responsive Implementation Plan - BranV

> **Date:** 2026-07-03
> **Author:** Senior Frontend Architecture Review
> **Scope:** `apps/web` - Next.js 15 / React 19 / Tailwind CSS 3.4

---

## Executive Summary

Every component in the codebase uses a **single `md:` (768px) flip point** as the only responsive boundary. This causes tablets to receive the full desktop layout prematurely, both mobile and desktop hero carousels to load simultaneously (double image download), the mega-menu to be invisible on all interior pages, and critical image scale bugs on the mobile hero.

This plan migrates the site to a true **three-tier mobile-first architecture** using `lg:` (1024px) as the primary layout split, with `md:` (768px) reserved for tablet-specific tweaks.

---

## Confirmed Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Primary split point | `lg:` 1024px | Phones + tablets share the mobile layout; desktop kicks in at laptop size - used by Myntra, ASOS, most fashion e-commerce |
| Tablet hero | Portrait mobile hero with `max-h-[80vh]` cap | Keeps existing portrait art, prevents overflow on wide tablets |
| Interior page navigation | Fix the bug - add mega menu to all desktop pages | Desktop users on category/product pages currently have no way to navigate |

---

## Root Problems Identified

### 1. Single breakpoint architecture
All responsive logic uses only `md:` (768px). No tablet range is addressed. The complete list of affected flip-points:

| Element | Current | Impact |
|---|---|---|
| Mobile bottom nav | `md:hidden` | Disappears on iPad (768px), leaving no navigation |
| Desktop hero | `hidden md:block` | Landscape hero appears at 768px - too early |
| Mega menu | `hidden md:flex` + `overlay &&` guard | Never appears on interior pages |
| Filter sidebar | `hidden md:block` | 220px sidebar on 768px tablet consumes 30% of screen |
| Product detail layout | `md:grid-cols-2` | Side-by-side layout forces onto tablet |
| Category sidebar grid | `md:grid-cols-[220px_1fr]` | Same as filter sidebar |
| Body padding for bottom nav | `pb-16 md:pb-0` | Bottom nav padding removed at 768px while nav still visible |

### 2. Dual hero image loading
`HeroCarousel.tsx` renders **both** `<HeroCarouselMobile />` and `<HeroCarouselDesktop />` in the DOM simultaneously. One is hidden via CSS, but both components initialise and **all 16 images load** regardless of viewport. On mobile this downloads 8 unnecessary landscape images.

### 3. Interior page navigation broken
The `<nav>` block containing `ShopMegaMenu` is wrapped in `{overlay && (...)}` in `StorefrontShell.tsx`. It only renders on the home page (which passes `heroOverlay={true}`). Desktop users on `/category`, `/products`, `/brands` have **no navigation links** - only a search icon and account icon.

### 4. Hero image scale typos
`HeroCarouselMobile.tsx` line 248 applies `scale-15` (15× zoom) and `scale-125` (12.5× zoom) to specific slides. These are typographic errors for `scale-[1.15]` and `scale-[1.25]`. Also contains a space: `object-[center_110 %]` → `object-[center_110%]`.

### 5. Responsive image `sizes` mismatch
Components use `sizes` hints based on 640px/768px breakpoints while actual layout changes happen at different points. The browser selects the wrong resolution variant.

---

## Breakpoint Semantics (Post-Fix)

| Screen range | Tailwind prefix | Semantic label | Design intent |
|---|---|---|---|
| 0–639px | (base) | Phone | All default styles |
| 640–767px | `sm:` | Large phone / phablet | Column count +1, slight spacing bump |
| 768–1023px | `md:` | Tablet | 3-col grids, tablet-specific tweaks, bottom sheet filters |
| 1024px+ | `lg:` | Desktop | Full mega menu, desktop hero, sidebar filters |
| 1280px+ | `xl:` | Wide desktop | Max-width expansions, 5-col grids |

> **Migration rule:** Every `md:` usage that was meant to split mobile vs. desktop moves to `lg:`. The `md:` prefix becomes reserved for **tablet-specific adjustments only**.

---

## Phase 1 - Tailwind Config: Document Breakpoint Semantics

**File:** `apps/web/tailwind.config.ts`
**Effort:** 15 min | **Risk:** None

No custom screens needed - Tailwind defaults align exactly with the target. Add a comment block documenting semantic intent so future contributors use breakpoints correctly.

```ts
const config: Config = {
  // Breakpoint semantics:
  //   base          → phone (0–639px)
  //   sm: 640px     → large phone / phablet
  //   md: 768px     → tablet  (tablet-specific tweaks only)
  //   lg: 1024px    → desktop (primary layout split point)
  //   xl: 1280px    → wide desktop
  theme: {
    extend: { ... }
  }
};
```

---

## Phase 2 - StorefrontShell: Fix Navigation + Split Point

**File:** `apps/web/src/components/StorefrontShell.tsx`
**Effort:** 1 hour | **Risk:** Medium - touches every page's header

This is the highest-impact change. Three separate fixes in one file.

### 2a - Fix interior page navigation (bug fix)

The `<nav>` block is gated behind `{overlay && (...)}` at line 48. Remove the guard. The `overlay` prop now only controls **styling** (white vs dark text), not **visibility**.

**Before (line 48–55):**
```tsx
{overlay && (
  <nav className="bv-nav-links hidden items-center gap-6 text-sm font-medium md:flex ml-12">
    <ShopMegaMenu overlay={overlay} />
    <Link href="/new" ...>New</Link>
    <Link href="/brands" ...>Brands</Link>
    <Link href="/articles" ...>Articles</Link>
  </nav>
)}
```

**After:**
```tsx
<nav className="bv-nav-links hidden items-center gap-6 text-sm font-medium lg:flex ml-12">
  <ShopMegaMenu overlay={overlay} />
  <Link href="/new" className={`bv-nav-link ${linkHoverClass}`}>New</Link>
  <Link href="/brands" className={`bv-nav-link ${linkHoverClass}`}>Brands</Link>
  <Link href="/articles" className={`bv-nav-link ${linkHoverClass}`}>Articles</Link>
</nav>
```

### 2b - Fix header padding

Line 42: `md:pl-0 md:pr-6` → `lg:pl-0 lg:pr-6`

### 2c - Fix body bottom padding for bottom nav

Line 24: `pb-16 md:pb-0` → `pb-16 lg:pb-0`

(Bottom nav is now visible through tablet, so the bottom padding must persist through 1023px.)

### What to verify after this change
- [ ] Home page (overlay=true): white text nav visible on desktop, hidden on tablet/phone
- [ ] Category page (overlay=false): dark text nav visible on desktop, hidden on tablet/phone
- [ ] Product detail page: same as category
- [ ] Mobile (< 1024px): no mega menu, hamburger drawer visible
- [ ] Tablet 768px: no mega menu, hamburger drawer + bottom nav visible

---

## Phase 3 - MobileBottomNav: Extend Visibility to Tablet

**File:** `apps/web/src/components/MobileBottomNav.tsx`
**Effort:** 5 min | **Risk:** None

Line 19: `md:hidden` → `lg:hidden`

The 5-tab bottom nav now appears on phones **and tablets** (0–1023px), disappearing only at true desktop (1024px+).

---

## Phase 4 - HeroCarousel: Fix Split Point + Dual Image Loading

**File:** `apps/web/src/components/HeroCarousel.tsx`
**Effort:** 2 hours | **Risk:** Medium - test hydration / SSR boundary

### 4a - Change swap breakpoint

Line 12: `md:hidden` → `lg:hidden`
Line 15: `hidden md:block` → `hidden lg:block`

Tablets (768–1023px) now correctly display the portrait mobile hero.

### 4b - Eliminate dual image loading

Replace the always-render pattern with a `useMediaQuery`-gated dynamic import. This ensures only the active carousel's images are downloaded.

```tsx
'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const HeroCarouselMobile = dynamic(
  () => import('./HeroCarouselMobile').then(m => ({ default: m.HeroCarouselMobile })),
  { ssr: false }
);
const HeroCarouselDesktop = dynamic(
  () => import('./HeroCarouselDesktop').then(m => ({ default: m.HeroCarouselDesktop })),
  { ssr: false }
);

export function HeroCarousel() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Skeleton prevents CLS while JS hydrates
  if (isDesktop === null) {
    return (
      <div className="aspect-[9/16] max-h-[80vh] w-full bg-neutral-900 lg:aspect-video lg:max-h-screen" />
    );
  }

  return isDesktop ? <HeroCarouselDesktop /> : <HeroCarouselMobile />;
}
```

> **Note:** `ssr: false` means the carousel is client-only. The skeleton div prevents layout shift. Ensure `fetchPriority="high"` and `loading="eager"` remain on the first slide image in each carousel file.

---

## Phase 5 - HeroCarouselMobile: Fix Bugs + Tablet Height Cap

**File:** `apps/web/src/components/HeroCarouselMobile.tsx`
**Effort:** 30 min | **Risk:** Low

### 5a - Fix scale typos and spacing error (line 248)

```tsx
// Before
className={`... ${slide.key === 'fashion' ? ' scale-15 object-[center_110 %]' : ''} ${slide.key === 'classic' ? ' scale-125 object-[center_115%]' : ''}`}

// After
className={`... ${slide.key === 'fashion' ? ' scale-[1.15] object-[center_110%]' : ''} ${slide.key === 'classic' ? ' scale-[1.25] object-[center_115%]' : ''}`}
```

Changes:
- `scale-15` → `scale-[1.15]` (was 15× zoom, now 115% scale)
- `scale-125` → `scale-[1.25]` (was 12.5× zoom, now 125% scale)
- Remove space in `110 %` → `110%`

### 5b - Add portrait height cap for tablet

On a 768px-wide tablet in portrait, `aspect-[9/16]` produces an intrinsic height of 1365px. The existing `max-h-screen` caps this, but can cause side black bars. Use a tighter cap:

**Before (line 210):**
```tsx
className="relative aspect-[9/16] max-h-screen w-full touch-pan-y ..."
```

**After:**
```tsx
className="relative aspect-[9/16] max-h-[80vh] w-full touch-pan-y ..."
```

---

## Phase 6 - Category Showcase: 3-Tier Grid

**File:** `apps/web/src/components/CategoryShowcase.tsx`
**Effort:** 1.5 hours | **Risk:** Low

Replace the 2-state (scroll/grid) pattern with a 3-tier pattern:

```tsx
{/* Mobile: horizontal scroll strip (0–767px) */}
<div className="md:hidden -mx-4 flex snap-x snap-mandatory overflow-x-auto gap-3 px-4 pb-2">
  {products.map(p => <ProductCard key={p.id} {...p} />)}
</div>

{/* Tablet: 3-column grid (768–1023px) */}
<div className="hidden md:grid lg:hidden grid-cols-3 gap-4">
  {products.map(p => <ProductCard key={p.id} {...p} />)}
</div>

{/* Desktop: 4–5 column grid (1024px+) */}
<div className="hidden lg:grid grid-cols-4 xl:grid-cols-5 gap-4">
  {products.map(p => <ProductCard key={p.id} {...p} />)}
</div>
```

---

## Phase 7 - Category Page Layout

**File:** `apps/web/src/app/category/[slug]/page.tsx`
**Effort:** 1 hour | **Risk:** Low

### 7a - Filter sidebar grid: shift trigger from `md:` to `lg:`

```tsx
// Before
<div className="md:grid-cols-[220px_1fr]">

// After
<div className="lg:grid-cols-[220px_1fr]">
```

Tablets (768–1023px) no longer have a 220px sidebar - they use the bottom sheet filter (see Phase 8).

### 7b - Product grid column counts

| Viewport | Columns | Class |
|---|---|---|
| Phone (base) | 2 | `grid-cols-2` |
| Tablet (`sm:`) | 3 | `sm:grid-cols-3` |
| Desktop (`lg:`) | 3–4 | `lg:grid-cols-3 xl:grid-cols-4` |

---

## Phase 8 - Filters: Extend Bottom Sheet to Tablet

**File:** `apps/web/src/components/Filters.tsx`
**Effort:** 20 min | **Risk:** Low

Since tablets now use the mobile layout (Phase 7 removes the sidebar), the filter button must remain visible through 1023px:

| Element | Before | After |
|---|---|---|
| Mobile trigger button | `md:hidden` | `lg:hidden` |
| Desktop sidebar | `hidden md:block` | `hidden lg:block` |
| Mobile sheet container | `flex md:hidden` | `flex lg:hidden` |

> **z-index check:** Bottom nav is `z-20`, filter sheet overlay is `z-40`. The filter sheet correctly overlaps the bottom nav. No changes needed.

---

## Phase 9 - Product Detail Page

**File:** `apps/web/src/app/products/[slug]/page.tsx`
**Effort:** 30 min | **Risk:** Low

### 9a - Layout split

```tsx
// Before
<div className="grid gap-8 md:grid-cols-2">

// After
<div className="grid gap-8 lg:grid-cols-2">
```

Tablets (768–1023px) stack vertically (image → details), which is the expected mobile-first PDP behavior.

### 9b - Correct `sizes` attribute

```tsx
// Before
sizes="(max-width: 768px) 100vw, 50vw"

// After
sizes="(max-width: 1023px) 100vw, 50vw"
```

---

## Phase 10 - Header Overlay Styling Audit

**File:** `apps/web/src/components/StorefrontShell.tsx`
**Effort:** 30 min testing | **Risk:** Low (audit only)

After Phase 2a (nav always visible), verify that `overlay=false` styling is correct on all interior pages:

- [ ] `ShopMegaMenu` - `panelClasses`: `border-neutral-200 bg-white shadow-xl` ✓
- [ ] `ShopMegaMenu` - hover: `hover:bg-neutral-100` ✓
- [ ] `SiteHeader` - link color: `text-neutral-700` on sticky white header ✓
- [ ] `SiteHeader` - on scroll: `bg-white/95 backdrop-blur` persists ✓

No code changes expected; this is a visual verification pass.

---

## Phase 11 - Responsive Image `sizes` Alignment

**Effort:** 1 hour | **Risk:** None (no visual change - only changes which resolution variant the browser downloads)

Align `sizes` props with actual layout breakpoints across all product-displaying components:

| Component | Current `sizes` | Corrected `sizes` |
|---|---|---|
| `ProductCard.tsx` | `(max-width: 640px) 50vw, 25vw` | `(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw` |
| Product detail image | `(max-width: 768px) 100vw, 50vw` | `(max-width: 1023px) 100vw, 50vw` |
| `CategoryShowcase` | none | `(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw` |
| Hero mobile (each slide) | none | `100vw` |
| Hero desktop (each slide) | none | `100vw` |

---

## Phase 12 - Typography Fluid Scaling

**Effort:** 1.5 hours | **Risk:** Low

Apply consistent 3-tier text scaling. Current pattern uses only base + occasional `md:` / `lg:` - add `sm:` and `md:` intermediate steps.

| Element | Mobile (base) | Phablet (`sm:`) | Tablet (`md:`) | Desktop (`lg:`) |
|---|---|---|---|---|
| Hero headline | `text-3xl` | - | `text-3xl` | `text-4xl xl:text-5xl` |
| Section heading | `text-xl` | - | `text-2xl` | `text-3xl` |
| Product card title | `text-sm` | - | `text-base` | `text-base` |
| Eyebrow | `text-[10px]` | - | `text-[11px]` | `text-[11px]` |
| Page heading (H1) | `text-2xl` | - | `text-3xl` | `text-4xl` |

**Files to update:** `HeroCarouselMobile.tsx`, `HeroCarouselDesktop.tsx`, `ProductCard.tsx`, category/product page headings.

---

## Phase 13 - MobileNavDrawer: Tablet Width Adjustment

**File:** `apps/web/src/components/MobileNavDrawer.tsx`
**Effort:** 15 min | **Risk:** None

Current drawer is `82vw` wide. On a 1023px tablet, 82vw = 840px - almost full screen.

```tsx
// Before
className="... w-[82vw] ..."

// After
className="... w-[82vw] max-w-sm md:max-w-md ..."
```

`max-w-md` = 448px - comfortable on a 768px tablet without covering the full screen.

---

## Quick Win Bugs (Fix Before Any Phase)

These are isolated one-line fixes. Do these first regardless of phase order.

| # | Bug | File | Line | Fix |
|---|---|---|---|---|
| 1 | `scale-15` - 15× zoom | `HeroCarouselMobile.tsx` | 248 | → `scale-[1.15]` |
| 2 | `scale-125` - 12.5× zoom | `HeroCarouselMobile.tsx` | 248 | → `scale-[1.25]` |
| 3 | Space in `110 %` | `HeroCarouselMobile.tsx` | 248 | → `object-[center_110%]` |
| 4 | Interior desktop nav hidden | `StorefrontShell.tsx` | 48 | Remove `overlay &&` guard |

---

## Implementation Order & Dependencies

```
Phase 1  (Tailwind docs)              → Independent, do first
    │
    ├─► Phase 4  (HeroCarousel split)      → Then Phase 5 (hero bugs)
    │       └─► Phase 5  (Hero bugs)
    │
    └─► Phase 2  (StorefrontShell)         → CRITICAL PATH start
            │
            ├─► Phase 3  (MobileBottomNav)
            ├─► Phase 10 (Header audit)
            │
            └─► Phase 7  (Category page)
                    └─► Phase 8  (Filters)

Phase 6  (CategoryShowcase)           → After Phase 1
Phase 9  (Product detail)             → After Phase 1
Phase 11 (Image sizes)                → Any time
Phase 12 (Typography)                 → Any time after Phase 9
Phase 13 (NavDrawer width)            → Any time
```

**Critical path (do these sequentially):**
`Phase 2` → `Phase 3` → `Phase 7` → `Phase 8`

---

## Device Test Matrix

Run after each phase against these 7 checkpoints in Chrome DevTools (or real devices):

| Device | Width | Primary checks |
|---|---|---|
| iPhone SE | 375px | Bottom nav visible, portrait hero full-height, 2-col product grid, hamburger menu |
| Pixel 7 / Galaxy S24 | 412px | Same + swipe carousel, filter bottom sheet |
| iPad Mini (portrait) | 768px | Bottom nav visible, portrait hero with 80vh cap, 3-col grid, no mega menu, filter sheet |
| iPad Pro 11" (portrait) | 834px | Same as 768px - confirm mobile layout throughout |
| iPad Pro / desktop boundary | 1024px | Desktop layout begins: mega menu appears, desktop hero, sidebar filter, bottom nav gone |
| MacBook 13" | 1280px | Full desktop: mega menu, desktop hero, sidebar filters, 4-col grid |
| Desktop 1440px | 1440px | Wide desktop: `xl:` column counts, max-width centering |

### Checklist per viewport
- [ ] Hero carousel shows correct variant (portrait/landscape)
- [ ] No layout overlap between header and hero on home page
- [ ] Bottom nav visible / hidden at correct breakpoint
- [ ] Filter: bottom sheet on mobile/tablet, sidebar on desktop
- [ ] Navigation: hamburger on mobile/tablet, mega menu on desktop
- [ ] Product grid columns match the breakpoint tier
- [ ] No horizontal overflow / scrollbar on body

---

## Performance Targets (Post-Implementation)

| Metric | Current (estimated) | Target |
|---|---|---|
| Hero images loaded on mobile | 16 (both carousels) | 8 (mobile only) |
| LCP (mobile, mid-range Android 4G) | >3s | <2.5s |
| CLS (hero swap) | Medium (no skeleton) | <0.1 |
| Image `sizes` accuracy | Mismatched at 640/768px | Aligned to 768/1024px breakpoints |

---

## Effort Summary

| Phase | Files touched | Effort | Priority |
|---|---|---|---|
| Quick wins | HeroCarouselMobile.tsx, StorefrontShell.tsx | 30 min | **Do now** |
| 1 | tailwind.config.ts | 15 min | High |
| 2 | StorefrontShell.tsx | 1 hr | **Critical** |
| 3 | MobileBottomNav.tsx | 5 min | High |
| 4 | HeroCarousel.tsx | 2 hr | **Critical** |
| 5 | HeroCarouselMobile.tsx | 30 min | High |
| 6 | CategoryShowcase.tsx | 1.5 hr | Medium |
| 7 | category/[slug]/page.tsx | 1 hr | High |
| 8 | Filters.tsx | 20 min | High |
| 9 | products/[slug]/page.tsx | 30 min | Medium |
| 10 | StorefrontShell.tsx | 30 min | Low (audit) |
| 11 | ProductCard.tsx, pages | 1 hr | Medium |
| 12 | Multiple | 1.5 hr | Low |
| 13 | MobileNavDrawer.tsx | 15 min | Low |

**Total estimated effort: ~10–11 hours**

---

## Reference: Industry Patterns Consulted

- Myntra, ASOS, H&M - bottom nav visible on tablet, `lg:` desktop split
- Flipkart - 3-col tablet grid, filter sheet on mobile and tablet
- Zara - minimal header on interior pages, mega menu on hover
- ASOS - `<picture>` element with art direction for hero images
- MDN responsive images guide - `srcset` + `sizes` strategy for resolution switching
