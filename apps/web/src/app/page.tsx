import Link from 'next/link';
import Image from 'next/image';
import { apiServer } from '@/lib/api-server';
import { HomePayload } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ProductCard } from '@/components/ProductCard';
import { HeroCarousel } from '@/components/HeroCarousel';
import { CategoryShowcase } from '@/components/CategoryShowcase';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const home = await apiServer<HomePayload>('/home');

  return (
    <StorefrontShell heroOverlay>
      <HeroCarousel />
      {home?.categorySections?.map((section) => (
        <CategoryShowcase
          key={section.category.slug}
          title={section.category.name}
          slug={section.category.slug}
          products={section.products}
        />
      ))}
      {home && home.banners.length > 0 && (
        <BannerStrip banners={home.banners} />
      )}
      {home && home.featuredEdit && <FeaturedEdit edit={home.featuredEdit} />}
      {home && home.activeDrops.length > 0 && (
        <ActiveDrops drops={home.activeDrops} />
      )}
      {home && home.newArrivals.length > 0 && (
        <NewArrivals products={home.newArrivals} />
      )}
      {home && home.featuredBrands.length > 0 && (
        <FeaturedBrands brands={home.featuredBrands} />
      )}
      {home && home.latestArticles.length > 0 && (
        <LatestArticles articles={home.latestArticles} />
      )}
      <DisclosureStrip />
    </StorefrontShell>
  );
}

function BannerStrip({ banners }: { banners: HomePayload['banners'] }) {
  // First banner becomes the hero; any extras render as smaller cards below.
  const [primary, ...rest] = banners;
  return (
    <>
      <section className="mx-auto max-w-7xl px-6 pt-6">
        <BannerHero banner={primary} />
      </section>
      {rest.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pt-6">
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((b) => (
              <li key={b.id}>
                <BannerHero banner={b} compact />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function BannerHero({
  banner,
  compact = false,
}: {
  banner: HomePayload['banners'][number];
  compact?: boolean;
}) {
  const href = banner.ctaLink ?? '#';
  return (
    <Link
      href={href}
      className={`relative block overflow-hidden rounded-2xl bg-neutral-100 ${
        compact ? 'aspect-[3/2]' : 'aspect-[16/9]'
      }`}
    >
      <Image
        src={banner.imageUrl}
        alt={banner.headline ?? ''}
        fill
        unoptimized
        sizes={compact ? '(max-width: 768px) 100vw, 33vw' : '(max-width: 1200px) 100vw, 1200px'}
        priority={!compact}
        className="object-cover"
      />
      {(banner.headline || banner.ctaLabel) && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent">
          <div className="w-full p-6 text-white">
            {banner.headline && (
              <p
                className={`font-semibold tracking-tight ${
                  compact ? 'text-lg' : 'text-3xl md:text-5xl'
                }`}
              >
                {banner.headline}
              </p>
            )}
            {banner.ctaLabel && (
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-neutral-900">
                {banner.ctaLabel} →
              </span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}

function FeaturedEdit({ edit }: { edit: NonNullable<HomePayload['featuredEdit']> }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <Link
        href={`/edits/${edit.slug}`}
        className="group relative block aspect-[21/9] overflow-hidden rounded-2xl bg-neutral-900"
      >
        {edit.heroUrl && (
          <Image
            src={edit.heroUrl}
            alt={edit.title}
            fill
            unoptimized
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="object-cover opacity-80 transition group-hover:opacity-100"
          />
        )}
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-8 text-white">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-80">
              The Edit
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {edit.title}
            </p>
            {edit.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-90">
                {edit.description}
              </p>
            )}
            <span className="mt-4 inline-flex rounded-full bg-white px-4 py-1.5 text-xs font-medium text-neutral-900">
              Shop the edit · {edit.productCount} pieces →
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}

function ActiveDrops({ drops }: { drops: HomePayload['activeDrops'] }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
            Live now
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Active drops
          </h2>
        </div>
        <Link
          href="/drops"
          className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
        >
          All drops →
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drops.map((d) => (
          <li key={d.id}>
            <Link
              href={`/drops/${d.slug}`}
              className="relative block aspect-[16/10] overflow-hidden rounded-xl bg-neutral-100"
            >
              {d.heroUrl && (
                <Image
                  src={d.heroUrl}
                  alt={d.name}
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
              )}
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Live
              </span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                <p className="font-medium">{d.name}</p>
                {d.endsAt && (
                  <p className="text-xs opacity-80">
                    Ends {new Date(d.endsAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                    })}
                  </p>
                )}
              </div>
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

function LatestArticles({
  articles,
}: {
  articles: HomePayload['latestArticles'];
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">From the journal</h2>
        <Link
          href="/articles"
          className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
        >
          All articles →
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <li key={a.id}>
            <Link href={`/articles/${a.slug}`} className="block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-neutral-100">
                {a.heroUrl && (
                  <Image
                    src={a.heroUrl}
                    alt={a.title}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover"
                  />
                )}
              </div>
              <p className="mt-3 text-lg font-semibold leading-snug tracking-tight">
                {a.title}
              </p>
              {a.excerpt && (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                  {a.excerpt}
                </p>
              )}
              <p className="mt-2 text-xs text-neutral-500">
                {a.publishedAt &&
                  new Date(a.publishedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                {a.readingMinutes && ` · ${a.readingMinutes} min read`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
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
