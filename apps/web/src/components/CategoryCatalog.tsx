import { notFound } from 'next/navigation';
import { apiServer, buildQuery } from '@/lib/api-server';
import { ProductPage, BrandCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { Filters, SortPicker, FilterDefinition } from '@/components/Filters';
import { CategoryHashFilter } from '@/components/CategoryHashFilter';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { SubcategoryChips } from '@/components/SubcategoryChips';
import { CategoryIcon } from '@/components/category-icons';
import { SHOP_CATEGORIES } from '@/lib/shop-categories';
import { isCollectionSlug } from '@/lib/collections';

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
  const isBannerCollection = isCollectionSlug(category.slug);
  const subcategories =
    category.children && category.children.length > 0
      ? category.children
      : (SHOP_CATEGORIES.find((c) => c.slug === category.slug)?.subcategories ?? []);

  return (
    <AnimateOnScroll>
      <section className="mx-auto max-w-7xl px-6 pt-8">
        <div className="flex items-center gap-3.5">
          {!isBannerCollection && (
            <span className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center overflow-hidden rounded-full bg-slate-100 p-1 shadow-xs shrink-0 border border-slate-200">
              <CategoryIcon slug={category.slug} className="h-full w-full object-cover rounded-full" />
            </span>
          )}
          <div>
            <h1 className="bv-enter bv-delay-1 text-3xl font-semibold tracking-tight md:text-4xl">
              {category.name}
            </h1>
            <p className="bv-enter-fade bv-delay-2 mt-0.5 text-sm text-content-soft">
              {total} {total === 1 ? 'product' : 'products'}
            </p>
          </div>
        </div>
        {subcategories.length > 0 && (
          <SubcategoryChips categorySlug={category.slug}>
            {subcategories}
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
