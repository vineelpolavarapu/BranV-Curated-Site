import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiServer, buildQuery } from '@/lib/api-server';
import { ProductPage, BrandCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { Filters, SortPicker, FilterDefinition } from '@/components/Filters';
import { CategoryHashFilter } from '@/components/CategoryHashFilter';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';

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
        categorySlug={slug}
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
    <AnimateOnScroll>
      <section className="mx-auto max-w-7xl px-6 pt-8">
        <nav className="bv-enter-fade mb-2 text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-900">{category.name}</span>
        </nav>
        <h1 className="bv-enter bv-delay-1 text-3xl font-semibold tracking-tight md:text-4xl">
          {category.name}
        </h1>
        <p className="bv-enter-fade bv-delay-2 mt-1 text-sm text-neutral-600">
          {total} {total === 1 ? 'product' : 'products'}
        </p>
        {category.children.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {category.children.map((c, i) => (
              <li key={c.slug} className={`bv-enter bv-delay-${Math.min(i + 3, 7)}`}>
                <Link
                  href={`/category/${c.slug}`}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium transition-colors hover:bg-neutral-100"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AnimateOnScroll>
  );
}

export function ListingShell({
  filters,
  brands,
  list,
  categorySlug,
}: {
  filters: FilterDefinition[];
  brands: Array<{ slug: string; name: string }>;
  list: ProductPage | null;
  categorySlug: string;
}) {
  const retailers = new Set<string>();
  for (const p of list?.data ?? []) {
    for (const r of p.retailers) retailers.add(r.retailer);
  }
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12 pt-6">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <AnimateOnScroll>
          <div className="bv-enter">
            <Filters
              context={{
                categoryFilters: filters,
                brands,
                retailers: Array.from(retailers),
              }}
            />
          </div>
        </AnimateOnScroll>
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              {list?.total ?? 0} results
            </p>
            <SortPicker />
          </div>
          <CategoryHashFilter
            categorySlug={categorySlug}
            allProducts={list?.data ?? []}
          />
        </div>
      </div>
    </section>
  );
}
