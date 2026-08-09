# BranV Theme Coverage Registry

Tracks the "Confident Blue" reskin (THEME_REDESIGN_PLAN §9.0) across **every page,
sub-page, and section**. A row is **done** only when all its sections are restyled for
**both** mobile (M) and desktop (D), with **content unchanged** (Scope Contract §2.4).

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done (M+D verified) · `n/a` not applicable

**Live counter:** run `pnpm --filter @branv/web theme:audit`.
Baseline at P0: **161 legacy literals / 51 files**. After P1: **77 / 30**. Target: **0**.

**Progress log:**
- ✅ **P0** Foundations: design-tokens.css, Tailwind semantic tokens, Poppins/Inter fonts, Lucide icon map, Framer Motion (`LazyMotion`) + `useReducedMotion`, audit script + npm scripts, this registry. Build green, zero visual change.
- ✅ **P1** Global chrome (all build-green): StorefrontShell, MobileBottomNav, MobileNavDrawer, AccountPopup, NotificationsBell, ProductCard, HeroCarousel (Desktop+Mobile+wrapper), Filters, SubcategoryChips, CustomSelect, SearchBox, animated-modal, animated-drawer, animated-option-group, DidYouBuyBottomSheet, NicePickModal, NewsletterSignup, CategoryShowcase, ReviewsSection, EmbeddedProductCard, ShoppableImage, global typography, **global gray canvas + blue form accents** (globals.css). Icons swapped to Lucide across chrome.
- ✅ **P2** Storefront core pages: home, shop, new, sale, search, category/[slug], products/[slug] (PDP). Typecheck+build green.
- ✅ **P3 + P4** Curated (6 pages, shared-driven), content (articles, lookbooks, edits, brands, help, terms, newsletter) and account/auth pages + AuthShell - migrated via reviewed codemod (`scripts/theme-codemod.mjs`, admin excluded). **Audit: 161→44, and every remaining literal is admin-only (P6).** Full build green.
- ✅ **P6** Admin reskin: AdminShell + all `/admin/*` pages + admin editors/pickers + QuickAddModal/BrandFormModal, via codemod (light shell, blue primaries). Build green.
- ✅ **Reskin verification**: `typecheck` clean, production `build` green, **`theme:audit --strict` = 0 legacy literals across the whole `apps/web/src` tree** (every page, sub-page, section - §9.0 satisfied for color/layout/icons).
- ⏳ **P5** Framer Motion interaction layer (§7.5) - remaining (scaffolding in place: `motion` + `LazyMotion` provider + `useReducedMotion`).
- ⏳ **P7/P8** cross-cutting-state polish + on-device visual QA (375/768/1080/1440 + reduced-motion) - remaining manual pass.

---

## P1 - Global chrome & shared components (recolors most sections everywhere)
Order = build sequence; one component per PR, no overlap.

| # | Component | M | D | Notes (sections) |
|---|---|---|---|---|
| 1 | `StorefrontShell` | [ ] | [ ] | top bar (logo, search, wishlist, cart badge), footer, page canvas + surfaces |
| 2 | `MobileBottomNav` | [ ] | n/a | 5 items, active blue, safe-area |
| 3 | `MobileNavDrawer` | [ ] | [ ] | slide-in panel, links, backdrop |
| 4 | `AccountPopup` | [ ] | [ ] | menu items |
| 5 | `NotificationsBell` | [ ] | [ ] | bell + dropdown |
| 6 | `ProductCard` | [ ] | [ ] | card, badge, rating, swatches, wishlist heart (image size preserved §4.7) |
| 7 | `HeroCarousel` / `HeroCarouselDesktop` / `HeroCarouselMobile` | [ ] | [ ] | gradient wash, text block, CTA pill, dots (banner size preserved §4.7) |
| 8 | `Filters` | [ ] | [ ] | pills, ranges, apply |
| 9 | `SubcategoryChips` | [ ] | [ ] | chips active/inactive |
| 10 | `CategoryHashFilter` | [ ] | [ ] | tabs |
| 11 | `CategoryShowcase` | [ ] | [ ] | category tiles |
| 12 | `CategoryCatalog` | [ ] | [ ] | grid of categories |
| 13 | `CustomSelect` | [ ] | [ ] | select control |
| 14 | `SearchBox` | [ ] | [ ] | input + results |
| 15 | `QuickAddModal` | [ ] | [ ] | modal chrome |
| 16 | `motion/animated-modal` | [ ] | [ ] | shared modal |
| 17 | `motion/animated-drawer` | [ ] | [ ] | shared drawer |
| 18 | `motion/animated-option-group` | [ ] | [ ] | option group |
| 19 | `BrandFormModal` | [ ] | [ ] | modal |
| 20 | `newsletter/NewsletterSignup` | [ ] | [ ] | inline form |
| 21 | `click-return/DidYouBuyBottomSheet` | [ ] | [ ] | bottom sheet |
| 22 | `click-return/NicePickModal` | [ ] | [ ] | modal |
| 23 | `reviews/ReviewsSection` | [ ] | [ ] | rating, list, form |
| 24 | `article/ArticleBody` + `EmbeddedProductCard` | [ ] | [ ] | prose, embeds |
| 25 | `brand/BrandStorySection` | [ ] | [ ] | story blocks |
| 26 | `lookbooks/ShoppableImage` | [ ] | [ ] | hotspots |
| 27 | Icon swaps → Lucide across all above | [ ] | [ ] | 1:1 meaning (§4.5) |

---

## P2 - Storefront core pages (every section each)
| # | Route | M | D | Sections |
|---|---|---|---|---|
| 1 | `/` | [ ] | [ ] | hero, category rail, trending rail, feature strip, promo band, editorial blocks |
| 2 | `/shop` | [ ] | [ ] | filter bar, grid, load-more, empty |
| 3 | `/new` | [ ] | [ ] | header, grid, empty |
| 4 | `/sale` | [ ] | [ ] | header, grid, empty |
| 5 | `/search` | [ ] | [ ] | query bar, results, no-results |
| 6 | `/category/[slug]` | [ ] | [ ] | header, chips, grid (covers ALL categories) |
| 7 | `/products/[slug]` | [ ] | [ ] | gallery, title/price, swatches, specs, description, reviews, related, buy CTA |

---

## P3 - Curated landing + content pages (every section each)
| # | Route | M | D |
|---|---|---|---|
| 1 | `/fashion-forward` | [ ] | [ ] |
| 2 | `/sharp-formals` | [ ] | [ ] |
| 3 | `/classic-essentials` | [ ] | [ ] |
| 4 | `/sports-wear` | [ ] | [ ] |
| 5 | `/easy-casuals` | [ ] | [ ] |
| 6 | `/trendy-wear` | [ ] | [ ] |
| 7 | `/articles` | [ ] | [ ] |
| 8 | `/articles/[slug]` | [ ] | [ ] |
| 9 | `/lookbooks/[slug]` | [ ] | [ ] |
| 10 | `/edits/[slug]` | [ ] | [ ] |
| 11 | `/brands` | [ ] | [ ] |
| 12 | `/brands/[slug]` | [ ] | [ ] |
| 13 | `/help` | [ ] | [ ] |
| 14 | `/terms` | [ ] | [ ] |
| 15 | `/newsletter` | [ ] | [ ] |
| 16 | `/newsletter/confirm` | [ ] | [ ] |
| 17 | `/newsletter/unsubscribe` | [ ] | [ ] |

---

## P4 - Account, auth & commerce pages (every section each)
| # | Route | M | D |
|---|---|---|---|
| 1 | `/login` | [ ] | [ ] |
| 2 | `/register` | [ ] | [ ] |
| 3 | `/forgot-password` | [ ] | [ ] |
| 4 | `/reset-password` | [ ] | [ ] |
| 5 | `/verify-email` | [ ] | [ ] |
| 6 | `/account` | [ ] | [ ] |
| 7 | `/account/preferences` | [ ] | [ ] |
| 8 | `/account/notifications` | [ ] | [ ] |
| 9 | `/wishlist` | [ ] | [ ] |
| 10 | `/wardrobe` | [ ] | [ ] |
| - | `AuthShell` | [ ] | [ ] |

---

## P5 - Motion layer (Framer Motion §7.5) - mobile-first, then desktop
| Group | Interactions | M | D |
|---|---|---|---|
| A Nav | sticky hide/show, hamburger→X, overlay, search morph, autocomplete, bottom-nav indicator | [ ] | [ ] |
| B Discovery | drag carousels, skeletons, card press, wishlist pop | [ ] | [ ] |
| C Filters | bottom-sheet, pills, grid reflow | [ ] | [ ] |
| D PDP | accordion, gallery swipe, CTA feedback | [ ] | [ ] |
| E/G Feedback | fly-to-target, badge bounce, swipe-to-delete, "did you buy" sheet, toasts, page transition, haptics | [ ] | [ ] |
| F Checkout | forward-spec only (no cart route yet) | n/a | n/a |

---

## P6 - Admin (`/admin/*`) - utilitarian token application
| # | Route / component | Done |
|---|---|---|
| 1 | `AdminShell` | [ ] |
| 2 | `/admin` | [ ] |
| 3 | `/admin/login` | [ ] |
| 4 | `/admin/setup-2fa` | [ ] |
| 5 | `/admin/products` `/new` `/[id]` | [ ] |
| 6 | `/admin/brands` `/[id]/story` | [ ] |
| 7 | `/admin/categories` | [ ] |
| 8 | `/admin/articles` `/new` `/[id]` | [ ] |
| 9 | `/admin/edits` `/new` `/[id]` | [ ] |
| 10 | `/admin/lookbooks` `/new` `/[id]` | [ ] |
| 11 | `/admin/banners` | [ ] |
| 12 | `/admin/avatars` | [ ] |
| 13 | `/admin/reviews` | [ ] |
| 14 | `/admin/audit` | [ ] |
| 15 | `/admin/affiliate/reconciliation` | [ ] |
| 16 | `/admin/settings` | [ ] |
| 17 | admin editors/pickers (`ArticleEditor`, `EditEditor`, `LookbookEditor`, `ProductPicker`, `MultiProductPicker`, `MiniBarChart`) | [ ] |

---

## P7 - Cross-cutting states (every route)
| State | Covered |
|---|---|
| Empty states | [ ] |
| Loading / skeletons | [ ] |
| Error states | [ ] |
| Toasts | [ ] |
| 404 / not-found | [ ] |
| Disabled / focus states | [ ] |

---

## P8 - Full-coverage QA gate (blocks launch)
- [ ] `theme:audit:strict` reports **0** legacy literals
- [ ] All rows above `[x]` (M+D)
- [ ] Cross-device QA 375 / 768 / 1080 / 1440
- [ ] reduced-motion pass
- [ ] Lighthouse perf + a11y floors
- [ ] Content-parity diff empty (same data/categories/elements - §2.4)
