# BranV - Animation & Micro-Interaction Plan

**Document owner:** BranV / Deccansoft  
**Date:** 2026-05-23  
**Scope:** Every animated surface on the BranV storefront (`apps/web/`).  
**Reference studied:** Pelgana UGC Animation Plan (Deccansoft internal) - patterns adapted, not copied; all timings, components, and contexts are BranV-specific.

---

## 1. Executive Summary

BranV is a curated men's fashion affiliate platform. The visual language is
**calm, premium, and editorial** - dark neutrals, clean white space, full-bleed
product imagery. Animation must reinforce that register: it should feel like
flipping through a well-designed lookbook, never like a discount flash-sale.

Every animation on this page follows three rules:

1. **Products are the hero.** Motion draws the eye to product imagery and
   pricing, never away from them.
2. **Entrances are one-shots; only cards loop on hover.** No infinite background
   animations on the storefront. Loops are reserved for hover states only.
3. **Compositor-only.** Every keyframe touches only `transform` and `opacity`.
   No `width`, `height`, `box-shadow`, `filter`, or `background-color` in hot
   animation paths.

---

## 2. Guiding Principles

| # | Principle | BranV reason |
|---|---|---|
| 1 | **Images are the content.** | Fashion sells on visuals. Never zoom, crop, or distort images during entrance - they must read as editorial photographs. |
| 2 | **Stagger reveals confidence.** | Grid entrances stagger left-to-right, row by row. This mimics a stylist laying out a collection - deliberate, not random. |
| 3 | **Hover = discovery.** | Product card hover reveals the CTA and the secondary image. The motion is the shopping trigger. |
| 4 | **No loops in static view.** | Nothing pulses, floats, or breathes on the storefront when the user is not interacting. This is a store, not a landing page. |
| 5 | **Speed matches price point.** | Entrances are 0.35–0.65s. Hover responses are 180–220ms. Anything faster feels cheap; anything slower feels broken. |
| 6 | **Accessibility first.** | `prefers-reduced-motion: reduce` disables all entrance animations and hover transforms. Elements appear at full opacity instantly. |

---

## 3. Technical Approach

### Animation system

- **Pure CSS keyframes** scoped per component in a local `<style>` block or a
  shared `animations.css` file imported once.
- **`AnimateOnScroll` wrapper component** (to be built - see §12) uses
  `IntersectionObserver` at a 10 % threshold. Adds `.in-view` to the root
  the first time it enters the viewport, then disconnects. Entrances never
  re-fire.
- **`animation-play-state: paused`** by default. The `.in-view` selector
  sets it to `running`.
- **`will-change: transform, opacity`** on actively animating elements, removed
  after the animation ends via `animation-fill-mode: both`.
- **`translate3d(x, y, 0)`** everywhere instead of `translate(x, y)` to force
  GPU layer promotion.
- **No runtime dependencies** added. No Framer Motion, no GSAP, no Lottie.

### Section tag conventions

| Tag | Component / Page |
|---|---|
| `bv1` | HeroCarousel |
| `bv2` | CategoryShowcase (homepage sections) |
| `bv3` | ProductCard (universal) |
| `bv4` | ShopMegaMenu (nav dropdown + flyout) |
| `bv5` | CategoryPage (listing header + subcategory pills) |
| `bv6` | BrandCard (brands page) |
| `bv7` | ArticleCard (articles page) |
| `bv8` | ProductDetail (PDP page) |
| `bv9` | Footer + NewsletterSignup |

### Easing palette (only these four, matching Pelgana vocabulary)

| Name | Value | When |
|---|---|---|
| `ease-out-quart` | `cubic-bezier(0.22, 1, 0.36, 1)` | All entrances (rise + fade). |
| `ease-in-out` | standard `ease-in-out` | Hover lifts, image cross-fades. |
| `ease-out-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Badge / pip pop-ins only. |
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Menu panel reveals. |

---

## 4. Section bv1 - HeroCarousel

**Component:** `components/HeroCarousel.tsx` - already `'use client'`, already has
700 ms slide transitions via inline `transform: translate3d()`.

### What exists

- 700 ms `ease-out` slide on the track.
- Dot indicator width/color transition.
- Touch drag with live transform tracking.

### What to add

#### 4a. Slide content entrance (text overlay)

Each slide's text content - eyebrow pill, headline, subhead, CTA - should
animate in *after* the slide has settled. Trigger: slide becomes active
(add/remove `.slide-active` class from the carousel controller).

| Delay | Element | Animation | Duration |
|---|---|---|---|
| +0 ms | Eyebrow pill (e.g. "New Season") | Fade up 10 px | 0.40 s |
| +80 ms | Headline line 1 | Fade up 14 px | 0.50 s |
| +160 ms | Headline line 2 | Fade up 14 px | 0.50 s |
| +280 ms | Subhead | Fade in (no rise) | 0.40 s |
| +400 ms | CTA button | Rise 10 px + fade | 0.40 s |

**Implementation note:** Reset the animation by toggling a CSS class. When the
carousel transitions to slide N, remove `.slide-active` from slide N−1 and
add it to slide N. Each text child has `animation-play-state: paused` until
`.slide-active` is present on the parent.

#### 4b. Ken Burns on slide image

Very slow scale: `1.0 → 1.04` over the entire duration the slide is visible
(default autoplay 5 s). Easing: linear. Resets instantly when slide leaves.
This is a background `<img>`, so it uses `transform: scale(...)` with
`overflow: hidden` on the parent.

```css
@keyframes bv1-kenburns {
  from { transform: translate3d(0, 0, 0) scale(1.0); }
  to   { transform: translate3d(0, -8px, 0) scale(1.04); }
}
.slide-active .slide-image {
  animation: bv1-kenburns 5s linear forwards;
}
```

#### 4c. Dot indicator

Already has `transition-all`. Add `transform: scale(1.0) → scale(1.15)` on
the active dot for a gentle pop. 200 ms ease-out-back.

#### 4d. Arrow chevrons (prev/next)

Hover: translate `+3 px` in direction of travel, 180 ms ease-in-out.

---

## 5. Section bv2 - CategoryShowcase (Homepage)

**Component:** `components/CategoryShowcase.tsx` - server component, rendered
N times on the homepage (Shirts, T-Shirts, Jeans, Tracks, Footwear, Watches).

### Section header entrance

Wrap the `<section>` in `<AnimateOnScroll>`. When in-view:

| Delay | Element | Animation | Duration |
|---|---|---|---|
| +0 ms | Section title (h2) | Fade up 16 px | 0.55 s |
| +80 ms | "View all" pill button | Fade in + scale `0.96 → 1` | 0.40 s |

### Product grid stagger

The 5-card grid reveals left-to-right, with a 60 ms stagger per card:

| Card index | Delay | Animation | Duration |
|---|---|---|---|
| 0 | +200 ms | Fade up 12 px | 0.45 s |
| 1 | +260 ms | Fade up 12 px | 0.45 s |
| 2 | +320 ms | Fade up 12 px | 0.45 s |
| 3 | +380 ms | Fade up 12 px | 0.45 s |
| 4 | +440 ms | Fade up 12 px | 0.45 s |

**Total section intro: ~0.89 s.**

Cards start `opacity: 0; transform: translate3d(0, 12px, 0)` and settle to
`opacity: 1; transform: translate3d(0, 0, 0)`.

### "View all" button hover

Current: `hover:bg-neutral-800`. Add:
- Scale: `1.0 → 1.03`, 200 ms ease-in-out.
- Arrow icon inside: translate `+2 px` rightward, 180 ms ease-in-out.

---

## 6. Section bv3 - ProductCard (Universal)

**Component:** `components/ProductCard.tsx` - `'use client'`. This is the single
most important animated surface on the site.

### Current state

- `transition-opacity duration-300` on image (secondary image cross-fade on hover).
- `hover:scale-110` on wishlist heart button.
- `transition hover:bg-neutral-800` on CTA button.

### Enhancements

#### 6a. Card lift on hover

```css
.product-card {
  transition: transform 200ms ease-in-out, box-shadow 200ms ease-in-out;
}
.product-card:hover {
  transform: translate3d(0, -4px, 0);
  box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.12);
}
```

This is done via Tailwind: `transition-transform duration-200 hover:-translate-y-1`
plus a shadow utility. **Do not animate `box-shadow` in a keyframe** - use
a CSS transition on the hover selector only (one paint, composited thereafter).

#### 6b. Image zoom on hover

The product image wrapper (`aspect-[4/5]`) has `overflow-hidden`. The inner
`<img>` transitions scale:

```css
.product-card-image {
  transition: transform 400ms ease-in-out;
}
.product-card:hover .product-card-image {
  transform: scale(1.04);
}
```

This runs simultaneously with the secondary-image cross-fade. The scale is
on the primary image only; secondary image swaps in at scale 1.0 already.

#### 6c. CTA "Buy Now" button - slide-up reveal

Currently the CTA button is always visible. The upgrade: hide it by default
(translate down 100 % within the card bottom), reveal on card hover.

```css
.product-card-cta {
  transform: translate3d(0, 100%, 0);
  opacity: 0;
  transition: transform 220ms ease-out-quart, opacity 180ms ease-in-out;
}
.product-card:hover .product-card-cta {
  transform: translate3d(0, 0, 0);
  opacity: 1;
}
```

The card bottom section already uses `absolute` positioning, so this fits
without layout shift.

#### 6d. Wishlist heart - existing `hover:scale-110` is good

When the user *adds* to wishlist (filled state), add a one-shot pop:
scale `1 → 1.35 → 1` over 300 ms ease-out-back. Triggered by state change
in the existing wishlist toggle handler.

#### 6e. Discount badge - entrance pop

On page load / section entrance, discount badges (e.g. "−30 %") scale in:
`0 → 1.15 → 1` over 350 ms ease-out-back, with a 300 ms delay after the
card itself fades in. This is a one-shot, not a loop.

### Interactive summary

| Interaction | Element | Effect | Duration |
|---|---|---|---|
| Hover card | Whole card | Lift −4 px, shadow | 200 ms |
| Hover card | Image | Scale 1.04 | 400 ms |
| Hover card | CTA button | Slide up + fade in | 220 ms |
| Hover card | Secondary image | Cross-fade (existing) | 300 ms |
| Hover wishlist btn | Heart icon | Scale 1.10 (existing) | - |
| Click wishlist | Heart icon | Pop 1 → 1.35 → 1 | 300 ms |
| Hover CTA btn | Button bg | Darken (existing) | - |

---

## 7. Section bv4 - ShopMegaMenu

**Component:** `components/StorefrontShell.tsx` - server component, CSS-only hover.

### Current state

- L1 dropdown: `invisible → visible` + `opacity-0 → opacity-100` on
  `group-hover`. Instant (no translate).
- L2 flyout: same pattern.

### Enhancements

#### 7a. L1 dropdown panel entrance

Add a Y-axis drop:

```css
/* Before */
.l1-panel {
  opacity: 0;
  visibility: hidden;
  transform: translate3d(0, -6px, 0);
  transition: opacity 180ms ease-out-expo,
              transform 180ms ease-out-expo,
              visibility 0s linear 180ms;
}
.group:hover .l1-panel {
  opacity: 1;
  visibility: visible;
  transform: translate3d(0, 0, 0);
  transition: opacity 180ms ease-out-expo,
              transform 180ms ease-out-expo,
              visibility 0s linear 0s;
}
```

In Tailwind terms: replace `invisible/opacity-0` with a custom class or
use inline `style` on the panel div, since Tailwind does not expose
`transition-visibility` natively.

#### 7b. L2 flyout panel entrance

Same as L1, but X-axis slide instead of Y:

```css
.l2-panel {
  transform: translate3d(-6px, 0, 0);
  opacity: 0;
  visibility: hidden;
  transition: opacity 160ms ease-out-expo,
              transform 160ms ease-out-expo,
              visibility 0s linear 160ms;
}
.group\/cat:hover .l2-panel {
  transform: translate3d(0, 0, 0);
  opacity: 1;
  visibility: visible;
  transition: opacity 160ms ease-out-expo,
              transform 160ms ease-out-expo,
              visibility 0s linear 0s;
}
```

#### 7c. Menu item hover state

Add `transition-colors duration-150` to each `<Link>` item so the background
highlight (neutral-100 / white/10) fades in instead of snapping.

---

## 8. Section bv5 - Category Listing Page

**Component:** `apps/web/src/app/category/[slug]/page.tsx`

### 8a. Category header entrance

Wrap `<CategoryHeader>` content in `<AnimateOnScroll>`:

| Delay | Element | Animation | Duration |
|---|---|---|---|
| +0 ms | Breadcrumb nav | Fade in | 0.30 s |
| +60 ms | Category title (h1) | Fade up 14 px | 0.50 s |
| +130 ms | Product count | Fade in | 0.30 s |
| +180 ms | Subcategory pill chips | Stagger, 40 ms apart, fade up 8 px | 0.30 s each |

### 8b. Subcategory pill chips

Active chip (matching current hash): scale `1.0 → 1.04` on mount, 250 ms
ease-out-back. This draws attention to the currently selected filter without
being distracting.

### 8c. Filter sidebar

On desktop (md+), the filter sidebar slides in from the left:
`translate3d(-12px, 0, 0) → translate3d(0, 0, 0)` + `opacity-0 → opacity-1`
over 400 ms ease-out-quart, triggered by `<AnimateOnScroll>` on the whole
`<ListingShell>`.

### 8d. Product grid in CategoryHashFilter

When the hash changes (subcategory filter applied), the grid re-renders.
Add a brief fade transition to the outgoing grid:
- Outgoing: `opacity: 1 → 0`, 150 ms.
- Incoming: grid mounts with each card at `opacity: 0, translate 8px`, then
  staggers in (40 ms apart, 0.35 s per card).

---

## 9. Section bv6 - Brand Cards

**Page:** `apps/web/src/app/brands/page.tsx`

### 9a. Grid section entrances

Two sections: "Featured brands" + "All brands". Each section:

| Element | Animation | Duration |
|---|---|---|
| Section title | Fade up 14 px | 0.45 s |
| Brand cards | Stagger fade up 10 px, 50 ms apart | 0.40 s each |

### 9b. Brand card hover

Current: `hover:border-neutral-400`. Add:

- Card lift: `translate3d(0, -3px, 0)`, 180 ms ease-in-out.
- Logo image: scale `1.0 → 1.06`, 300 ms ease-in-out (inside `overflow-hidden`
  container). Reinforces "explore this brand" intent.
- Border: existing color change is fine; add `transition-colors duration-200`.

---

## 10. Section bv7 - Article Cards

**Page:** `apps/web/src/app/articles/page.tsx`

### 10a. Grid entrance

| Element | Animation | Duration |
|---|---|---|
| Page title | Fade up 16 px | 0.50 s |
| Article cards | Stagger fade up 12 px, 60 ms apart, in rows of 3 | 0.45 s each |

### 10b. Article card hover

| Element | Effect | Duration |
|---|---|---|
| Card | Lift `−4 px`, soft shadow | 200 ms |
| Hero image | Scale `1.05` inside `overflow-hidden` | 400 ms |
| Title | Underline color transition from `transparent → neutral-900` | 200 ms |
| Read-time chip | Slight brightness increase (opacity `0.7 → 1`) | 200 ms |

---

## 11. Section bv8 - Product Detail Page (PDP)

**Page:** `apps/web/src/app/products/[slug]/page.tsx`

### 11a. Breadcrumb + title entrance

| Delay | Element | Animation |
|---|---|---|
| +0 ms | Breadcrumb | Fade in, 0.30 s |
| +60 ms | Product title (h1) | Fade up 12 px, 0.50 s |
| +120 ms | Brand link | Fade in, 0.30 s |
| +160 ms | Price row | Fade up 8 px, 0.35 s |
| +240 ms | "Where to buy" section | Fade in, 0.40 s |

### 11b. Image gallery entrance

Primary image: fade in only (no rise - it is a photograph, same rule as
the hero carousel). `opacity: 0 → 1`, 0.40 s. Thumbnail images stagger
in 40 ms after the primary.

### 11c. Retailer offer cards

Each "Buy Now" card (retailers list) staggers in 50 ms apart from top:
fade up 8 px, 0.35 s.

### 11d. Related products grid

Treated identically to a CategoryShowcase grid (§5): stagger 60 ms,
fade up 12 px, 0.45 s per card. Triggered when the section enters the
viewport.

---

## 12. Section bv9 - Footer + NewsletterSignup

### 12a. Footer entrance

Wrap footer content columns in `<AnimateOnScroll>`:

| Delay | Element | Animation |
|---|---|---|
| +0 ms | BranV wordmark + description | Fade up 10 px, 0.40 s |
| +80 ms | Newsletter block | Fade up 10 px, 0.40 s |

### 12b. Newsletter subscribe button hover

Current: `hover:bg-neutral-800`. Add scale `1.0 → 1.02`, 180 ms. Arrow
icon inside nudges `+2 px` right.

### 12c. Success / error feedback message

When subscription submits, the feedback `<p>` tag mounts with:
- Success: scale `0.96 → 1` + `opacity: 0 → 1`, 300 ms ease-out-back.
- Error: same entrance, no scale spring.

---

## 13. `AnimateOnScroll` - Component Spec

**File to create:** `apps/web/src/components/AnimateOnScroll.tsx`

```tsx
'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export function AnimateOnScroll({
  children,
  className = '',
  threshold = 0.1,
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in-view');
          observer.disconnect(); // fire once
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
```

Usage example in CategoryShowcase:
```tsx
<AnimateOnScroll>
  <section className="bv2-section ...">
    {/* title, grid, etc. */}
  </section>
</AnimateOnScroll>
```

---

## 14. Global CSS - Keyframes Reference

Add to `apps/web/src/app/globals.css` (or a new `animations.css` imported there):

```css
/* ── BranV entrance keyframes ──────────────────────────────────────── */

@keyframes bv-fade-up {
  from {
    opacity: 0;
    transform: translate3d(0, var(--rise, 12px), 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes bv-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes bv-pop {
  0%   { transform: scale(0); }
  70%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}

@keyframes bv-slide-up {
  from { transform: translate3d(0, 100%, 0); opacity: 0; }
  to   { transform: translate3d(0, 0, 0);   opacity: 1; }
}

/* ── Entrance helpers ───────────────────────────────────────────────── */

.bv-enter {
  opacity: 0;
  animation: bv-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-play-state: paused;
}

.in-view .bv-enter {
  animation-play-state: running;
}

/* Stagger delays: add class bv-delay-{n} on children */
.bv-delay-1  { animation-delay: 60ms;  }
.bv-delay-2  { animation-delay: 120ms; }
.bv-delay-3  { animation-delay: 180ms; }
.bv-delay-4  { animation-delay: 240ms; }
.bv-delay-5  { animation-delay: 300ms; }
.bv-delay-6  { animation-delay: 360ms; }
.bv-delay-7  { animation-delay: 420ms; }

/* ── Reduced motion ─────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .bv-enter,
  .bv-enter * {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

---

## 15. Cross-Component Rules

### What never animates in BranV

| Element | Reason |
|---|---|
| Product image aspect ratio / crop | Sacred - must look like a real photograph. |
| Price text | Counting up price figures is a pattern for "earned income" pages (UGC), not for retail. Customers expect stable prices. |
| The BranV wordmark | Brand anchor must feel permanent. |
| Loading skeletons | `animate-pulse` is already correct. Do not change. |
| Admin pages | Out of scope. |

### Loop budget

**Zero persistent loops** in the storefront idle state. The only motion in
a static view is hover-triggered. This distinguishes BranV from flashier
competitors and reinforces the premium editorial feel.

### Timing fast-reference

| Context | Duration |
|---|---|
| Hover response (card lift, image zoom) | 180–220 ms |
| Menu panel appear/disappear | 160–200 ms |
| Section entrance (title) | 450–550 ms |
| Section entrance (card stagger, per card) | 380–450 ms |
| One-shot badge pop | 300–350 ms |
| Ken Burns (hero image) | 5 000 ms (per slide) |
| CTA reveal (slide-up) | 220 ms |

---

## 16. Implementation Order

Build in this order so each phase is independently testable:

| Phase | What to build | Est. |
|---|---|---|
| 1 | `AnimateOnScroll` component + global keyframes CSS | 0.5 days |
| 2 | **ProductCard** - lift, image zoom, CTA slide-up, wishlist pop | 1 day |
| 3 | **CategoryShowcase** - title + grid stagger entrance | 0.5 days |
| 4 | **ShopMegaMenu** - L1 drop + L2 slide-in | 0.5 days |
| 5 | **HeroCarousel** - text stagger on slide change + Ken Burns | 0.5 days |
| 6 | **CategoryPage** - header stagger + subcategory chips + filter sidebar slide | 0.5 days |
| 7 | **BrandCard + ArticleCard** - hover lift + image zoom + grid stagger | 0.5 days |
| 8 | **PDP** - breadcrumb + gallery + retailer cards entrance | 0.5 days |
| 9 | **Footer** entrance + newsletter feedback | 0.25 days |
| 10 | Cross-browser QA + reduced-motion audit | 0.5 days |

**Total estimate: ~5 developer days.**

---

## 17. How to Verify Completion

1. `pnpm build && pnpm start` - test animations under production build only.
   Next.js dev mode (StrictMode) double-invokes effects and can introduce
   false jitter.
2. Scroll from the top of the homepage to the footer. Every CategoryShowcase
   section should animate in once. No section re-fires when scrolled back up.
3. Hover each product card type (with image, without image, featured, discounted).
   CTA slides up. Card lifts. Image zooms.
4. Open Shop menu → hover each L1 category → hover each L2 flyout item.
   Both panels appear with their respective slide animations.
5. Toggle OS "Reduce motion" preference. Reload. Every element must be
   immediately visible at full opacity. No entrance, no lift, no ken burns.
6. Resize browser 360 px → 1920 px. No entrance re-fires; grid reflows cleanly.
7. Lighthouse Performance ≥ 95 desktop, ≥ 88 mobile (images are the bottleneck
   on mobile, not animation).

---

*Version 1.0 - Ready for implementation. Update this document when new
components are added or timings are adjusted after client review.*
