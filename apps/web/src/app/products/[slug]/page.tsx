import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiServer } from '@/lib/api-server';
import { resolveBuyNowHref, resolveRetailerLabel } from '@/lib/click-tracking';
import { ProductCardData } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ProductCard, BuyNowButton } from '@/components/ProductCard';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { RecordRecentlyViewed } from '@/components/RecordRecentlyViewed';
import { ProductGallery } from '@/components/ProductGallery';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await apiServer<ProductCardData>(`/products/${slug}`);
  if (!product) return { title: 'BranV - Product' };
  const desc = product.description?.slice(0, 160) ?? `${product.brand.name} on BranV.`;
  return {
    title: `${product.title} · ${product.brand.name} · BranV`,
    description: desc,
    openGraph: {
      title: product.title,
      description: desc,
      images: product.primaryImage ? [product.primaryImage.url] : [],
    },
  };
}

export default async function ProductDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const [product, related] = await Promise.all([
    apiServer<ProductCardData>(`/products/${slug}`),
    apiServer<ProductCardData[]>(`/products/${slug}/related`),
  ]);
  if (!product) notFound();

  return (
    <StorefrontShell>
      <RecordRecentlyViewed product={product} />
      <ProductSchema product={product} />
      <AnimateOnScroll>
        <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-10 sm:pb-12 pt-4 sm:pt-6 w-full overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start min-w-0 w-full">
            <div className="lg:col-span-6 min-w-0 w-full">
              <ProductGallery product={product} />
            </div>
            <div className="bv-enter bv-delay-2 lg:col-span-6 min-w-0 w-full">
              <Summary product={product} />
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      <WhereToBuy product={product} />

      {related && related.length > 0 && (
        <AnimateOnScroll>
          <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-14 w-full overflow-hidden">
            <h2 className="bv-enter mb-4 sm:mb-5 text-lg sm:text-xl font-semibold tracking-tight">
              You may also like
            </h2>

            {/* Phone (<768px): horizontal scroll strip — bounded to parent padding */}
            <div className="md:hidden -mx-4 px-4 pb-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-[calc(100%+2rem)] min-w-0">
              <ul className="flex snap-x snap-mandatory gap-3 min-w-0">
                {related.map((p, i) => (
                  <li
                    key={p.id}
                    className={`bv-enter bv-delay-${Math.min((i % 7) + 1, 7)} w-[65vw] max-w-[220px] shrink-0 snap-start`}
                  >
                    <ProductCard product={p} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Tablet & desktop (>=768px): grid */}
            <div className="hidden gap-x-4 gap-y-8 md:grid md:grid-cols-3 lg:grid-cols-4">
              {related.slice(0, 8).map((p, i) => (
                <div key={p.id} className={`bv-enter bv-delay-${Math.min(i + 1, 7)}`}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        </AnimateOnScroll>
      )}
    </StorefrontShell>
  );
}

function Summary({ product }: { product: ProductCardData }) {
  return (
    <div className="flex flex-col gap-0 min-w-0 w-full">
      <Link
        href={`/brands/${product.brand.slug}`}
        className="text-xs font-medium uppercase tracking-wider text-content-soft hover:text-primary"
      >
        {product.brand.name}
      </Link>
      <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl text-content break-words">
        {product.title}
      </h1>

      {(product.colors.length > 0 || product.sizes.length > 0) && (
        <div className="mt-4 sm:mt-5 space-y-3">
          {product.colors.length > 0 && (
            <DisplayList label="Colors" values={product.colors} />
          )}
          {product.sizes.length > 0 && (
            <DisplayList label="Sizes" values={product.sizes} />
          )}
          <p className="text-xs text-content-soft">
            Size/colour selection happens on the retailer&apos;s site after you
            click Buy Now.
          </p>
        </div>
      )}

      {product.buyNow && (
        <div className="mt-5 sm:mt-6 w-full">
          <BuyNowButton
            href={resolveBuyNowHref(product.buyNow)}
            retailer={product.buyNow.retailer}
            retailerDisplayName={product.buyNow.retailerDisplayName}
            size="lg"
            trackingId={product.buyNow.trackingId}
            productTitle={product.title}
            fullWidthOnMobile={true}
          />
          <p className="mt-2 text-xs text-content-soft">
            We earn a small commission when you buy through our link - at no
            extra cost to you.
          </p>
        </div>
      )}

      {product.description && (
        <div className="mt-6 sm:mt-8 border-t border-line pt-5 sm:pt-6">
          <h2 className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-content-soft">
            Description
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-content-soft break-words">
            {product.description}
          </p>
        </div>
      )}

      {product.tags.length > 0 && (
        <div className="mt-5 sm:mt-6 flex flex-wrap gap-1.5">
          {product.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-content-soft"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DisplayList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-content-soft">
        {label}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <li
            key={v}
            className="rounded-md border border-line px-2 py-1 text-xs"
          >
            {v}
          </li>
        ))}
      </ul>
    </div>
  );
}

const RETAILER_STAGGER = ['bv-delay-1', 'bv-delay-2', 'bv-delay-3', 'bv-delay-4', 'bv-delay-5', 'bv-delay-6'];

function WhereToBuy({ product }: { product: ProductCardData }) {
  if (product.retailers.length === 0) return null;
  return (
    <AnimateOnScroll>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-10 sm:pb-12 w-full overflow-hidden">
        <h2 className="bv-enter mb-4 text-lg sm:text-xl font-semibold tracking-tight">Where to buy</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 min-w-0 w-full">
          {product.retailers.map((r, i) => {
            const label = resolveRetailerLabel(r.retailer, r.retailerDisplayName);
            return (
              <li
                key={r.retailer}
                className={`bv-enter ${RETAILER_STAGGER[i % RETAILER_STAGGER.length] ?? ''} flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-shadow duration-200 hover:shadow-card-hover min-w-0`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium capitalize truncate">{label}</p>
                </div>
                <div className="shrink-0">
                  <BuyNowButton
                    href={r.affiliateUrl}
                    retailer={r.retailer}
                    retailerDisplayName={r.retailerDisplayName}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </AnimateOnScroll>
  );
}

function ProductSchema({ product }: { product: ProductCardData }) {
  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.title,
    image: product.primaryImage?.url,
    description: product.description ?? undefined,
    brand: { '@type': 'Brand', name: product.brand.name },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
