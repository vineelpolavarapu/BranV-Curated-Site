# BranV — Lenis UI Transition Implementation Plan

**Owner:** UX Engineering / UI Motion
**Date:** 2026-07-06
**Status:** Planning document
**Primary reference:** `darkroomengineering/lenis`
**Scope:** Desktop + mobile responsive web interactions in `apps/web`

---

## 1. Objective

This document defines a **structured implementation plan** for interactive UI transition animations across BranV using a **Lenis-centered motion foundation**.

The goal is to create a motion system that feels:

- **Premium** instead of flashy
- **Smooth** instead of floaty
- **Responsive** on mobile and desktop
- **Accessible** for reduced-motion users
- **Composable** so the same motion rules can be reused across components

This is not intended to replace the existing broad animation document in `ANIMATION_PLAN.md`. Instead, this file focuses on **how to implement the interaction layer using Lenis-style smooth scrolling behavior and coordinated UI transitions**.

---

## 2. Why Lenis for BranV

Lenis is a strong fit for BranV because it provides a clean foundation for scroll-driven smoothness without forcing a heavy animation runtime architecture.

### Benefits for this project

- Smooth, controllable scroll interpolation for editorial-style browsing
- Better perceived polish for image-heavy pages
- Predictable hooks for scroll-linked reveal behavior
- Centralized scroll lifecycle that can coordinate page sections and in-view transitions
- Cleaner integration path with React/Next.js than ad-hoc wheel/touch smoothing

### Recommended usage philosophy

Use Lenis as the **scroll orchestration layer**, not as the only animation tool.

- **Lenis handles:** smooth scroll behavior, scroll state, velocity-aware interactions, section reveal timing coordination
- **CSS handles:** button hover, opacity/transform transitions, menu enter/exit, selection state changes
- **Small React utilities handle:** in-view state, route transition state, modal state, mount/unmount timing

---

## 3. Motion Design Principles

All BranV interactive transitions should follow these rules.

### 3.1 Motion tone

- Calm
- Confident
- Editorial
- Precise
- Never bouncy unless explicitly used for tiny selection feedback

### 3.2 Performance rules

Animate only:

- `transform`
- `opacity`

Avoid animating in hot paths:

- `width`
- `height`
- `top`
- `left`
- `box-shadow`
- `filter`
- `backdrop-filter`

### 3.3 Accessibility rules

When `prefers-reduced-motion: reduce` is enabled:

- Disable Lenis smoothing
- Remove parallax-like motion
- Remove delayed staggered entrances
- Keep opacity changes instant or near-instant
- Preserve focus visibility and keyboard predictability

### 3.4 Interaction rules

- Scroll should feel guided, not heavy
- Hover should confirm interactivity, not distract
- Route/page transitions should be subtle and quick
- Entry/exit animations should support reading order
- Option picking should prioritize clarity over flourish

---

## 4. Motion Architecture

### 4.1 Recommended implementation layers

#### Layer A — Scroll foundation

Create a single app-level Lenis provider for the storefront experience.

**Responsibilities:**

- Initialize Lenis once on the client
- Manage RAF lifecycle
- Expose scroll position/velocity if needed
- Disable/adjust behavior for reduced motion
- Pause when overlays or modals lock the page

#### Layer B — UI transition tokens

Create a shared motion token file for durations, easing, distances, and opacity patterns.

Suggested token groups:

- Scroll smoothing
- Hover timings
- Page transition timings
- Enter/exit timings
- Stagger intervals
- Selection feedback timings

#### Layer C — Reusable primitives

Create reusable wrappers/hooks such as:

- `LenisProvider`
- `useReducedMotion()`
- `useInViewOnce()`
- `PageTransitionShell`
- `FadeSlideIn`
- `AnimatedOptionGroup`
- `AnimatedDrawer`
- `AnimatedModal`

#### Layer D — Component-specific choreography

Apply the shared primitives to:

- Buttons
- Navigation dropdowns
- Product cards
- Filter chips
- Sort options
- Page sections
- Drawers and overlays
- Route/page transitions

---

## 5. Recommended Lenis Configuration Strategy

The exact values can be tuned during implementation, but this is the recommended starting strategy based on BranV’s premium editorial positioning.

### 5.1 Desktop baseline

Use a smooth but controlled profile.

**Recommended baseline:**

- `smoothWheel: true`
- `syncTouch: false`
- `lerp`: low-to-medium smoothing
- `wheelMultiplier`: conservative
- `touchMultiplier`: neutral
- `infinite: false`
- `autoRaf: false` if manually controlled in React

**Intent:**

- Wheel interactions feel polished without lag
- Scroll never feels detached from the pointer
- Long content remains readable and controlled

### 5.2 Mobile baseline

Mobile should feel lighter than desktop.

**Recommended baseline:**

- Avoid over-smoothing touch scroll
- Prefer native-feeling touch behavior
- Enable touch sync only if it improves consistency after testing
- Keep momentum perception natural

**Intent:**

- Preserve OS-native expectations
- Avoid “fighting” touch scrolling
- Keep performance stable on lower-end devices

### 5.3 Reduced motion mode

When reduced motion is active:

- Turn off smoothing behavior
- Fall back to native scroll
- Disable scroll-reactive transforms
- Keep UI transitions short and functional

---

## 6. Animation Categories and Implementation Plan

## 6.1 Smooth scrolling

### Purpose

Provide a premium continuous browsing feel for content-heavy storefront pages.

### Use cases

- Homepage section flow
- Editorial listings
- Brand and article exploration
- Long-form product pages

### Implementation notes

- Mount Lenis high in the app tree for storefront layouts
- Avoid nested custom scroll containers unless necessary
- Keep sticky sections compatible with the chosen wrapper/content structure
- Do not couple every animation directly to scroll position

### UX rules

- Smoothness must be felt, not noticed
- No exaggerated inertial delay
- Scroll-to-anchor interactions should feel precise
- Keyboard navigation and skip links must still work cleanly

---

## 6.2 Buttons and tap interactions

### Purpose

Communicate responsiveness and intent confirmation.

### Patterns

- Hover raise
- Soft opacity shift
- Press compression
- Focus-visible ring reveal
- Loading state transition

### Recommended motion behavior

- Hover: subtle `translateY(-1px)` or scale-equivalent feel
- Press: micro `scale(0.98)` or downward offset
- Disabled: opacity/static state, no playful motion
- Loading: fade content to spinner, do not reflow button width if avoidable

### Timing guidance

- Hover in: fast
- Hover out: slightly faster or equal
- Press: immediate
- Loading swap: short cross-fade

### Lenis relationship

Buttons should **not** directly depend on Lenis. They should remain CSS-driven. Lenis simply improves the surrounding page feel.

---

## 6.3 Page transitions

### Purpose

Make route changes feel intentional without slowing navigation.

### Recommended pattern

Use a **content fade + slight vertical translate** transition.

### Enter

- New page begins slightly offset and low-opacity
- Settles into place quickly

### Exit

- Current page fades slightly and shifts minimally
- Avoid dramatic wipes or full-screen theatrical transitions

### Good candidates

- Homepage to listing
- Listing to PDP
- Article index to article detail
- Account subsections

### Avoid

- Full-screen slide panels for every route
- Long blocking transitions before content becomes usable
- Complex cross-page shared element transitions unless scoped carefully

### Lenis relationship

- Reset scroll intentionally on route change where expected
- Preserve scroll where UX requires it
- Pause/refresh Lenis state during route shell swaps if needed

---

## 6.4 Option picking and selection interactions

### Purpose

Support clarity during decisions such as selecting filters, sizes, tabs, sort orders, or category chips.

### Patterns

- Pill/chip active-state transition
- Segmented control highlight slide
- Radio/checkbox state reveal
- Selection confirmation micro-animation

### Recommended motion behavior

- Active background should glide or fade, not snap harshly
- Text color transition should be immediate but smooth
- Selected icon/checkmark can fade+scale in
- Deselection should be simpler than selection

### Examples

- Filter chip selected
- Sort dropdown item active
- Size option chosen
- Tab switch in PDP details

### Accessibility rules

- Keyboard selection must get the same visible feedback
- State change must be obvious without relying only on movement
- Motion must not obscure final selected state

---

## 6.5 In-view enter animations

### Purpose

Guide reading order as content appears during scroll.

### Suitable targets

- Section headers
- Product grids
- Brand cards
- Editorial blocks
- Supporting content modules

### Recommended pattern

Use **fade + upward settle** only.

### Rules

- Animate once per page visit unless strong reason exists otherwise
- Stagger only siblings in a list/grid
- Keep distance small
- Never animate essential content so late that it feels hidden

### Lenis relationship

Lenis improves reveal smoothness because scroll progression is more controlled, but actual enter/exit state should still be triggered with viewport observation logic.

---

## 6.6 Exit animations

### Purpose

Make dismissals and state changes feel completed rather than abruptly removed.

### Suitable targets

- Toasts
- Drawers
- Modals
- Dropdowns
- Temporary banners
- Filter panels

### Recommended pattern

- Fade out
- Slight directional translate
- Short duration
- Then unmount

### Rules

- Exit must be faster than enter
- Escape key and close button behavior must remain immediate
- Never trap the user in a long dismissal animation

---

## 6.7 Overlays, drawers, and modals

### Purpose

Support layered interactions cleanly across desktop and mobile.

### Animation model

Backdrop:

- quick opacity fade

Panel:

- desktop modal: fade + slight scale/translate
- mobile drawer: slide from bottom or side with fade support

### Lenis relationship

When overlays open:

- pause or stop Lenis updates for the page behind
- lock background scroll safely
- resume Lenis after close and state cleanup

### UX rules

- Opening should feel immediate
- Closing should feel even faster
- Background should not continue drifting while modal is open

---

## 6.8 Navigation and menus

### Purpose

Give hierarchy and direction to discovery flows.

### Targets

- Header reveal behavior
- Mega menu open/close
- Mobile nav drawer
- Submenu transitions

### Recommended pattern

- Header on scroll: subtle translate/opacity, never jumpy
- Mega menu: fade + vertical settle
- Submenus: directional slide with low distance
- Mobile nav: panel slide with staggered item reveal kept minimal

### Lenis relationship

- Header hide/reveal can optionally use Lenis scroll direction/velocity
- Keep thresholds conservative to prevent flicker

---

## 7. Suggested Motion Tokens

Create a shared motion token set so the whole UI feels consistent.

### 7.1 Duration scale

Suggested semantic tokens:

- `--motion-instant`
- `--motion-fast`
- `--motion-medium`
- `--motion-slow`
- `--motion-page`

### 7.2 Easing scale

Suggested semantic tokens:

- `--ease-standard`
- `--ease-decelerate`
- `--ease-accelerate`
- `--ease-emphasized`

### 7.3 Distance scale

Suggested semantic tokens:

- `--distance-micro`
- `--distance-sm`
- `--distance-md`
- `--distance-lg`

### 7.4 Opacity states

Suggested semantic states:

- `--opacity-enter-start`
- `--opacity-enter-end`
- `--opacity-exit-start`
- `--opacity-exit-end`

---

## 8. Proposed File Structure

This is the recommended structure for implementing the system in `apps/web`.

```text
apps/web/src/
  components/
    motion/
      lenis-provider.tsx
      page-transition-shell.tsx
      fade-slide-in.tsx
      animated-option-group.tsx
      animated-drawer.tsx
      animated-modal.tsx
  hooks/
    use-reduced-motion.ts
    use-in-view-once.ts
    use-route-transition.ts
  styles/
    motion-tokens.css
    motion-utilities.css
    lenis.css
```

### Responsibility split

- `lenis-provider.tsx` ? Lenis setup and lifecycle
- `page-transition-shell.tsx` ? route enter/exit wrappers
- `fade-slide-in.tsx` ? reusable reveal primitive
- `animated-option-group.tsx` ? tabs, chips, segmented controls
- `animated-drawer.tsx` / `animated-modal.tsx` ? layered UI patterns
- `motion-tokens.css` ? durations, easing, distance tokens
- `motion-utilities.css` ? reusable classes/utilities
- `lenis.css` ? Lenis-related wrapper/content behavior if needed

---

## 9. Rollout Plan by Phase

## Phase 1 — Foundation

### Deliverables

- Add Lenis dependency
- Create global Lenis provider
- Create reduced-motion fallback
- Add motion tokens
- Add utility classes for fade/slide/scale transitions

### Success criteria

- Smooth scrolling works reliably on storefront pages
- No broken sticky elements
- No keyboard/focus regression
- No obvious mobile scroll fighting

---

## Phase 2 — Core UI interactions

### Deliverables

- Button hover/press/loading transitions
- Chip/option picking transitions
- Dropdown and menu transitions
- Modal/drawer open-close primitives

### Success criteria

- Interaction language feels consistent
- Tap/hover states feel immediate
- Overlay behavior does not break scroll locking

---

## Phase 3 — In-view reveals

### Deliverables

- Section header reveals
- Grid/card staggered entrances
- Editorial content block reveals

### Success criteria

- Content hierarchy improves readability
- Reveals are subtle and performant
- Reduced-motion fallback is complete

---

## Phase 4 — Route/page transitions

### Deliverables

- Shared page transition shell
- Listing/detail transition patterns
- Account/admin subsection transitions only where appropriate

### Success criteria

- Navigation feels smoother without added delay
- Scroll reset/preservation rules feel intentional

---

## Phase 5 — Refinement and QA

### Deliverables

- Tune Lenis parameters for desktop/mobile
- Audit performance on lower-end devices
- Audit reduced-motion behavior
- Remove over-animation

### Success criteria

- Stable 60fps feel on common devices
- No motion that feels ornamental or distracting
- Clear interaction consistency across the app

---

## 10. Component-by-Component Recommendations

## 10.1 Header

- Add subtle show/hide based on scroll direction
- Keep threshold high enough to avoid jitter
- Animate transform and opacity only

## 10.2 Hero sections

- Avoid over-designed kinetic motion
- Use staged text/image reveal on first load only
- No aggressive parallax on mobile

## 10.3 Product cards

- Hover image swap or CTA reveal
- Slight lift only
- Keep product image stable and premium

## 10.4 Filters and chips

- Animate selection background and check/icon reveal
- Keep transition short and legible

## 10.5 Dropdowns

- Fade and settle in
- Keep menu alignment fixed during animation

## 10.6 Drawers

- Mobile filters/cart/wishlist drawers should slide decisively
- Background scroll must fully lock

## 10.7 Modals

- Scale/fade with quick backdrop appearance
- Restore focus on close

## 10.8 Toasts

- Slide/fade in from edge
- Exit faster than enter

---

## 11. QA Checklist

Before shipping, validate the following.

### Performance

- No layout thrashing during transitions
- No animated heavy paint properties in key UI flows
- No dropped-frame feeling during long scroll

### Accessibility

- `prefers-reduced-motion` is respected globally
- Focus order remains correct
- Keyboard-only users see equivalent state changes
- Motion does not hide important content timing

### Responsive behavior

- Mobile touch scroll feels natural
- Drawer transitions fit thumb interactions
- Hover-only effects degrade correctly on touch devices

### UX consistency

- Same interaction types use the same timing family
- Enter/exit patterns feel related
- Page transitions are subtle, not theatrical

---

## 12. Implementation Do / Don’t

### Do

- Use Lenis as a foundation, not a gimmick
- Keep motion tokens centralized
- Prefer reusable transition primitives
- Test desktop trackpad, mouse wheel, and mobile touch separately
- Respect reduced-motion from day one

### Don’t

- Don’t animate everything just because smoothing exists
- Don’t over-smooth mobile scrolling
- Don’t create long blocking page transitions
- Don’t animate layout properties in hot UI paths
- Don’t let motion compete with product content

---

## 13. Recommended Next Implementation Order

1. Add Lenis provider and motion tokens
2. Implement button and option-picking transitions
3. Implement modal/drawer/menu transitions
4. Add in-view reveal primitives
5. Add page transition shell
6. Tune behavior for desktop/mobile separately
7. Run accessibility and performance QA

---

## 14. Final UX Direction

The BranV motion system should feel like a **luxury editorial interface**:

- scrolling is fluid
- buttons feel crisp
- selections feel assured
- overlays feel polished
- page transitions feel intentional
- nothing feels noisy

Lenis should provide the **movement foundation**, while CSS and small reusable React primitives provide the **interaction language**.
