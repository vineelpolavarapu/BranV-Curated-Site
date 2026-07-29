import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiServer, buildQuery } from '@/lib/api-server';
import { ProductPage, BrandCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { Filters, SortPicker, FilterDefinition } from '@/components/Filters';
import { CategoryHashFilter } from '@/components/CategoryHashFilter';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { SubcategoryChips } from '@/components/SubcategoryChips';

export interface CategoryDetail {
  id: string;
  slug: string;
  name: string;
  path: string;
  parentId: string | null;
  parent: { slug: string } | null;
  attributeSchemas: FilterDefinition[];
  children: Array<{ slug: string; name: string }>;
}

/**
 * Full category product-catalog page (header + filters + product grid), shared
 * by the /category/[slug] route and the bare collection routes
 * (/sharp-formals etc.). Callers resolve any slug-normalization / redirects
 * before rendering this; it assumes `slug` is the canonical category to show.
 */
export async function CategoryCatalog({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const category = await apiServer<CategoryDetail>(`/categories/${slug}`);
  if (!category) notFound();

  const [list, brands] = await Promise.all([
    apiServer<ProductPage>(`/products${buildQuery({ ...searchParams, category: slug })}`),
    apiServer<BrandCard[]>('/brands'),
  ]);

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
        <nav className="bv-enter-fade mb-2 text-xs text-content-soft">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-content">{category.name}</span>
        </nav>
        <h1 className="bv-enter bv-delay-1 text-3xl font-semibold tracking-tight md:text-4xl">
          {category.name}
        </h1>
        <p className="bv-enter-fade bv-delay-2 mt-1 text-sm text-content-soft">
          {total} {total === 1 ? 'product' : 'products'}
        </p>
        {category.children.length > 0 && (
          <SubcategoryChips categorySlug={category.slug}>
            {category.children}
          </SubcategoryChips>
        )}
      </section>
    </AnimateOnScroll>
  );
}

function ListingShell({
  list,
  categorySlug,
}: {
  filters?: FilterDefinition[];
  brands?: Array<{ slug: string; name: string }>;
  list: ProductPage | null;
  categorySlug: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12 pt-6">
      <div className="grid grid-cols-1 gap-y-6 w-full">
        <div className="grid grid-cols-2 items-center justify-between border-b border-slate-100 pb-4">
          <p className="text-sm font-medium text-slate-500 col-span-1">
            {list?.total ?? 0} {list?.total === 1 ? 'result' : 'results'}
          </p>
          <div className="col-span-1 justify-self-end">
            <SortPicker />
          </div>
        </div>
        <CategoryHashFilter
          categorySlug={categorySlug}
          allProducts={list?.data ?? []}
        />
      </div>
    </section>
  );
}
