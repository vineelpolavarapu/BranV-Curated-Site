import { apiServer } from '@/lib/api-server';
import { HomePayload } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { HeroCarousel } from '@/components/HeroCarousel';
import { CategoryShowcase } from '@/components/CategoryShowcase';

export const dynamic = 'force-dynamic';

const STATIC_CATEGORIES = [
  { title: 'Shirts', slug: 'shirts' },
  { title: 'T-Shirts', slug: 't-shirts' },
  { title: 'Jeans', slug: 'jeans' },
  { title: 'Tracks', slug: 'tracks' },
  { title: 'Footwear', slug: 'footwear' },
  { title: 'Watches', slug: 'watches' },
];

export default async function HomePage() {
  const home = await apiServer<HomePayload>('/home');

  const apiSlugs = new Set((home?.categorySections ?? []).map((s) => s.category.slug));

  return (
    <StorefrontShell heroOverlay>
      <HeroCarousel />
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
      {/* Static category sections — show placeholders until seeded */}
      {STATIC_CATEGORIES.filter((c) => !apiSlugs.has(c.slug)).map((c) => (
        <CategoryShowcase key={c.slug} title={c.title} slug={c.slug} products={[]} />
      ))}
      <DisclosureStrip />
    </StorefrontShell>
  );
}

function DisclosureStrip() {
  return (
    <section className="border-y border-line bg-surface-muted">
      <div className="mx-auto max-w-7xl px-6 py-6 text-center text-xs text-content-soft">
        <strong className="text-content">Affiliate disclosure:</strong>{' '}
        BranV is a curated affiliate platform. Clicking Buy Now redirects you to
        the retailer. We earn a small commission on qualifying sales — at no
        extra cost to you.
      </div>
    </section>
  );
}
