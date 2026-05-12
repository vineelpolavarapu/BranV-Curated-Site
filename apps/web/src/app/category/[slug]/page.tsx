import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiServer, buildQuery } from '@/lib/api-server';
import { ProductPage, BrandCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ProductCard } from '@/components/ProductCard';
import { Filters, SortPicker, FilterDefinition } from '@/components/Filters';

export const dynamic = 'force-dynamic';

interface CategoryDetail {
  id: string;
  slug: string;
  name: string;
  path: string;
  parentId: string | null;
  attributeSchemas: FilterDefinition[];
  children: Array<{ slug: string; name: string }>;
}

export default async function CategoryPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await props.params;
  const sp = await props.searchParams;

  const [category, list, brands] = await Promise.all([
    apiServer<CategoryDetail>(`/categories/${slug}`),
    apiServer<ProductPage>(`/products${buildQuery({ ...sp, category: slug })}`),
    apiServer<BrandCard[]>('/brands'),
  ]);

  if (!category) notFound();

  return (
    <StorefrontShell>
      <CategoryHeader category={category} total={list?.total ?? 0} />
      <ListingShell
        filters={category.attributeSchemas}
        brands={brands ?? []}
        list={list}
      />
    </StorefrontShell>
  );
}

function CategoryHeader({
  category,
  total,
}: {
  category: CategoryDetail;
  total: number;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-8">
      <nav className="mb-2 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-900">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-900">{category.name}</span>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {category.name}
      </h1>
      <p className="mt-1 text-sm text-neutral-600">
        {total} {total === 1 ? 'product' : 'products'}
      </p>
      {category.children.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}`}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ListingShell({
  filters,
  brands,
  list,
}: {
  filters: FilterDefinition[];
  brands: Array<{ slug: string; name: string }>;
  list: ProductPage | null;
}) {
  const retailers = new Set<string>();
  for (const p of list?.data ?? []) {
    for (const r of p.retailers) retailers.add(r.retailer);
  }
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12 pt-6">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <Filters
          context={{
            categoryFilters: filters,
            brands,
            retailers: Array.from(retailers),
          }}
        />
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              {list?.total ?? 0} results
            </p>
            <SortPicker />
          </div>
          {!list || list.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
              No products match these filters.
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
  );
}
