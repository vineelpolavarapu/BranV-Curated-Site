import { notFound, redirect } from 'next/navigation';
import { apiServer } from '@/lib/api-server';
import { CategoryCatalog, CategoryDetail } from '@/components/CategoryCatalog';
import { categoryHrefL2 } from '@/lib/category-href';
import { isCollectionSlug } from '@/lib/collections';

export const dynamic = 'force-dynamic';

export default async function CategoryPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await props.params;
  const sp = await props.searchParams;

  // Collection categories are canonically served at their bare URL
  // (e.g. /sharp-formals), so redirect any /category/<collection> hit there.
  if (isCollectionSlug(slug)) {
    redirect(`/${slug}`);
  }

  // Resolve the category first; if it's an L2, the canonical URL is the L1
  // page with the L2 suffix as a hash fragment. Redirect before any extra
  // fetches so direct visits to `/category/shirts-checks` (legacy links, SEO,
  // hand-typed URLs) all settle on `/category/shirts#checks`.
  const category = await apiServer<CategoryDetail>(`/categories/${slug}`);
  if (!category) notFound();
  if (category.parent?.slug) {
    redirect(categoryHrefL2(category.parent.slug, category.slug));
  }

  return <CategoryCatalog slug={slug} searchParams={sp} />;
}
