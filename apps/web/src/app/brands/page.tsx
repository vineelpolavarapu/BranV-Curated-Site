import Link from 'next/link';
import Image from 'next/image';
import { apiServer } from '@/lib/api-server';
import { BrandCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';

export const dynamic = 'force-dynamic';

export default async function BrandsIndexPage() {
  const brands = (await apiServer<BrandCard[]>('/brands')) ?? [];
  const featured = brands.filter((b) => b.isFeatured);
  const rest = brands.filter((b) => !b.isFeatured);

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Brands
        </h1>
        <p className="text-sm text-neutral-600">
          {brands.length} {brands.length === 1 ? 'brand' : 'brands'} curated for BranV.
        </p>
      </section>

      {featured.length > 0 && (
        <BrandGrid title="Featured" brands={featured} />
      )}
      {rest.length > 0 && <BrandGrid title="All brands" brands={rest} />}
      {brands.length === 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
            No brands yet.
          </p>
        </section>
      )}
    </StorefrontShell>
  );
}

function BrandGrid({
  title,
  brands,
}: {
  title: string;
  brands: BrandCard[];
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {brands.map((b) => (
          <li key={b.slug}>
            <Link
              href={`/brands/${b.slug}`}
              className="block rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400"
            >
              {b.logoUrl ? (
                <div className="mb-3 flex h-14 items-center justify-center">
                  <Image
                    src={b.logoUrl}
                    alt={b.name}
                    width={100}
                    height={56}
                    unoptimized
                    className="max-h-14 w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="mb-3 flex h-14 items-center justify-center rounded bg-neutral-100">
                  <span className="text-xs text-neutral-500">no logo</span>
                </div>
              )}
              <p className="text-sm font-medium">{b.name}</p>
              <p className="text-xs text-neutral-500">
                {b._count.products} {b._count.products === 1 ? 'product' : 'products'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
