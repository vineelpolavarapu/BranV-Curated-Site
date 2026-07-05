import { apiServer, buildQuery } from '@/lib/api-server';
import { ProductPage, BrandCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ProductCard } from '@/components/ProductCard';
import { Filters, SortPicker } from '@/components/Filters';

export const dynamic = 'force-dynamic';

export default async function SearchPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';

  const [list, brands] = await Promise.all([
    apiServer<ProductPage>(
      `/products${buildQuery({ ...sp, search: q })}`,
    ),
    apiServer<BrandCard[]>('/brands'),
  ]);

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-7xl px-6 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Search {q && (
            <span className="text-neutral-500">
              for &ldquo;{q}&rdquo;
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {list?.total ?? 0} {(list?.total ?? 0) === 1 ? 'result' : 'results'}
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-6">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <Filters context={{ brands: brands ?? [] }} />
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                {list?.total ?? 0} results
              </p>
              <SortPicker />
            </div>
            {!list || list.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
                {q ? 'No results.' : 'Type something to search.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {list.data.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}
