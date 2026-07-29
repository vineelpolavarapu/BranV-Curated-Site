import Link from 'next/link';
import Image from 'next/image';
import { apiServer } from '@/lib/api-server';
import { BrandCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';

export const dynamic = 'force-dynamic';

export default async function BrandsIndexPage() {
  const brands = (await apiServer<BrandCard[]>('/brands')) ?? [];
  const featured = brands.filter((b) => b.isFeatured);
  const rest = brands.filter((b) => !b.isFeatured);

  return (
    <StorefrontShell>
      <AnimateOnScroll>
        <section className="mx-auto max-w-7xl px-6 py-8 grid grid-cols-1 gap-y-6">
          <h1 className="bv-enter mb-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Brands
          </h1>
          <p className="bv-enter-fade bv-delay-1 text-sm text-content-soft">
            {brands.length} {brands.length === 1 ? 'brand' : 'brands'} curated for BranV.
          </p>
        </section>
      </AnimateOnScroll>

      {featured.length > 0 && (
        <BrandGrid title="Featured" brands={featured} />
      )}
      {rest.length > 0 && <BrandGrid title="All brands" brands={rest} />}
      {brands.length === 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-content-soft">
            No brands yet.
          </p>
        </section>
      )}
    </StorefrontShell>
  );
}

const BRAND_STAGGER = ['bv-delay-1', 'bv-delay-2', 'bv-delay-3', 'bv-delay-4', 'bv-delay-5', 'bv-delay-6'];

function BrandGrid({
  title,
  brands,
}: {
  title: string;
  brands: BrandCard[];
}) {
  return (
    <AnimateOnScroll>
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="bv-enter mb-4 text-lg font-semibold tracking-tight">{title}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {brands.map((b, i) => (
            <li key={b.slug} className={`bv-enter ${BRAND_STAGGER[i % BRAND_STAGGER.length] ?? ''}`}>
              <Link
                href={`/brands/${b.slug}`}
                className="group block rounded-xl border border-line bg-surface p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                {b.logoUrl ? (
                  <div className="mb-3 flex h-14 items-center justify-center overflow-hidden">
                    <Image
                      src={b.logoUrl}
                      alt={b.name}
                      width={100}
                      height={56}
                      unoptimized
                      className="max-h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.06]"
                    />
                  </div>
                ) : (
                  <div className="mb-3 flex h-14 items-center justify-center rounded bg-surface-muted">
                    <span className="text-xs text-content-soft">no logo</span>
                  </div>
                )}
                <p className="text-sm font-medium">{b.name}</p>
                <p className="text-xs text-content-soft">
                  {b._count.products} {b._count.products === 1 ? 'product' : 'products'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AnimateOnScroll>
  );
}
