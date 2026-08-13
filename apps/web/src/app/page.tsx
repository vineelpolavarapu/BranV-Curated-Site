import { Suspense } from 'react';
import { apiServer } from '@/lib/api-server';
import { HomePayload } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { HeroCarousel } from '@/components/HeroCarousel';
import { CategoryShowcase } from '@/components/CategoryShowcase';
import { HERO_SLIDES, HERO_DESKTOP_BREAKPOINT } from '@/components/hero-data';

export const dynamic = 'force-dynamic';

// Preload the first hero banner so it is the very first bytes the browser
// fetches — the hero is the LCP element and must paint before anything else.
// A media-query per link ensures mobile loads the portrait art and desktop
// loads the landscape art (no double download). Rendered in the page tree so
// Next hoists these <link>s into <head>.
function HeroPreload() {
  const first = HERO_SLIDES[0];
  return (
    <>
      <link
        rel="preload"
        as="image"
        href={first.mobileImage}
        media={`(max-width: ${HERO_DESKTOP_BREAKPOINT - 1}px)`}
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href={first.desktopImage}
        media={`(min-width: ${HERO_DESKTOP_BREAKPOINT}px)`}
        fetchPriority="high"
      />
    </>
  );
}

const STATIC_CATEGORIES = [
  { title: 'Shirts', slug: 'shirts' },
  { title: 'T-Shirts', slug: 't-shirts' },
  { title: 'Jeans', slug: 'jeans' },
  { title: 'Tracks', slug: 'tracks' },
  { title: 'Footwear', slug: 'footwear' },
  { title: 'Watches', slug: 'watches' },
  { title: 'Trousers', slug: 'trousers' },
  { title: 'Shorts', slug: 'shorts' },
  { title: 'Jackets', slug: 'jackets' },
  { title: 'Inners', slug: 'inners' },
  { title: 'Sweatshirts', slug: 'sweatshirts' },
  { title: 'Hoodies', slug: 'hoodies' },
];

export default function HomePage() {
  return (
    <StorefrontShell heroOverlay>
      <HeroPreload />
      <div className="grid grid-cols-1 gap-y-6 w-full">
        {/* Hero renders instantly with no API dependency — the banner image is
            server-rendered (HeroInitial) and preloaded above. */}
        <HeroCarousel />

        {/* Catalogs stream in once /home resolves. Suspense keeps the hero as
            the only thing visible on first paint; the catalogs appear below the
            fold as they arrive instead of blocking the whole page. */}
        <Suspense fallback={<HomeCatalogsSkeleton />}>
          <HomeCatalogs />
        </Suspense>

        <DisclosureStrip />
      </div>
    </StorefrontShell>
  );
}

async function HomeCatalogs() {
  const home = await apiServer<HomePayload>('/home');
  const apiSlugs = new Set((home?.categorySections ?? []).map((s) => s.category.slug));

  return (
    <>
      {/* New Arrivals always first */}
      <CategoryShowcase
        title="New Arrivals"
        slug="new"
        href="/new"
        products={home?.newArrivals ?? []}
      />
      {/* API-driven category sections (e.g. Clothing once seeded) */}
      {(home?.categorySections ?? []).map((section) => (
        <CategoryShowcase
          key={section.category.slug}
          title={section.category.name}
          slug={section.category.slug}
          products={section.products}
        />
      ))}
      {/* Static category sections - show placeholders until seeded */}
      {STATIC_CATEGORIES.filter((c) => !apiSlugs.has(c.slug)).map((c) => (
        <CategoryShowcase key={c.slug} title={c.title} slug={c.slug} products={[]} />
      ))}
    </>
  );
}

function HomeCatalogsSkeleton() {
  // Lightweight, non-blocking placeholder. The catalogs live below the
  // full-screen hero, so this skeleton only becomes visible if the user
  // scrolls before /home resolves. Kept minimal to avoid layout shift.
  return (
    <div aria-hidden className="w-full px-4 py-12 md:px-8 lg:px-12">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
      <div className="flex gap-3 overflow-hidden md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-[60vw] max-w-[240px] shrink-0 aspect-[4/5] animate-pulse rounded-card bg-surface-muted"
          />
        ))}
      </div>
      <div className="hidden gap-4 md:grid lg:hidden grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-surface-muted" />
        ))}
      </div>
      <div className="hidden gap-4 lg:grid grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}

function DisclosureStrip() {
  return (
    <section className="border-y border-line bg-surface-muted">
      <div className="mx-auto max-w-7xl px-6 py-6 text-center text-xs text-content-soft">
        <strong className="text-content">Affiliate disclosure:</strong>{' '}
        BranV is a curated affiliate platform. Clicking Buy Now redirects you to
        the retailer. We earn a small commission on qualifying sales - at no
        extra cost to you.
      </div>
    </section>
  );
}