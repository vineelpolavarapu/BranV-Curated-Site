import Link from 'next/link';
import Image from 'next/image';
import { apiServer } from '@/lib/api-server';
import { HomePayload } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ProductCard } from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const home = await apiServer<HomePayload>('/home');

  return (
    <StorefrontShell>
      <Hero />
      {home && home.featuredBrands.length > 0 && (
        <FeaturedBrands brands={home.featuredBrands} />
      )}
      {home && home.newArrivals.length > 0 && (
        <NewArrivals products={home.newArrivals} />
      )}
      <DisclosureStrip />
    </StorefrontShell>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:py-20">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
            Curated · Affiliate · Editorial
          </p>
          <h1 className="mb-6 text-5xl font-semibold tracking-tight text-neutral-950 md:text-6xl lg:text-7xl">
            Menswear,
            <br />
            with an eye.
          </h1>
          <p className="mb-8 max-w-md text-lg leading-relaxed text-neutral-600 md:text-xl">
            Outfits and accessories sourced from Flipkart, Amazon, Myntra and
            more — styled, curated, and one tap from your cart.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/new"
              className="rounded-md bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-800"
            >
              Shop new arrivals
            </Link>
            <Link
              href="/brands"
              className="rounded-md border border-neutral-300 px-6 py-3 text-base font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              Browse brands
            </Link>
          </div>
          <p className="mt-6 text-xs text-neutral-500">
            We earn a small commission when you buy through our links — at no
            extra cost to you.
          </p>
        </div>
        <HeroImagePlaceholder />
      </div>
    </section>
  );
}

function HeroImagePlaceholder() {
  return (
    <div
      role="img"
      aria-label="Hero image placeholder"
      className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-dashed border-neutral-300 bg-neutral-100"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(to right, #e5e5e5 1px, transparent 1px), linear-gradient(to bottom, #e5e5e5 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative flex h-full w-full flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-neutral-500">Hero image</p>
        <p className="mt-1 text-xs text-neutral-400">4:5 · place asset here</p>
      </div>
    </div>
  );
}

function FeaturedBrands({
  brands,
}: {
  brands: HomePayload['featuredBrands'];
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">
          Featured brands
        </h2>
        <Link
          href="/brands"
          className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
        >
          See all →
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {brands.map((b) => (
          <li key={b.slug}>
            <Link
              href={`/brands/${b.slug}`}
              className="flex h-24 items-center justify-center rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-400"
            >
              {b.logoUrl ? (
                <Image
                  src={b.logoUrl}
                  alt={b.name}
                  width={80}
                  height={48}
                  unoptimized
                  className="max-h-12 w-auto object-contain"
                />
              ) : (
                <span className="text-sm font-medium">{b.name}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NewArrivals({
  products,
}: {
  products: HomePayload['newArrivals'];
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">New arrivals</h2>
        <Link
          href="/new"
          className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
        >
          See all →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
        {products.slice(0, 8).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function DisclosureStrip() {
  return (
    <section className="border-y border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-6 text-center text-xs text-neutral-600">
        <strong className="text-neutral-900">Affiliate disclosure:</strong>{' '}
        BranV is a curated affiliate platform. Clicking Buy Now redirects you to
        the retailer. We earn a small commission on qualifying sales — at no
        extra cost to you.
      </div>
    </section>
  );
}
