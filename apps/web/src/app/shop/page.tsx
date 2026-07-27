import Link from 'next/link';
import { apiServer } from '@/lib/api-server';
import { CategoryCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { CategoryIcon } from '@/components/category-icons';
import { SHOP_CATEGORIES } from '@/lib/shop-categories';

export const dynamic = 'force-dynamic';

const CATEGORY_STAGGER = ['bv-delay-1', 'bv-delay-2', 'bv-delay-3', 'bv-delay-4', 'bv-delay-5', 'bv-delay-6'];

export default async function ShopPage() {
  const apiCategories = (await apiServer<CategoryCard[]>('/categories')) ?? [];

  const countMap = new Map<string, number>();
  for (const c of apiCategories) {
    if (c && c.slug) {
      countMap.set(c.slug, c._count?.productsAsCategory ?? 0);
    }
  }

  // SHOP_CATEGORIES is the single source of truth for top-level shop categories
  const topLevel = SHOP_CATEGORIES.map((c, i) => ({
    id: c.slug,
    slug: c.slug,
    name: c.name,
    parentId: null,
    displayOrder: i,
    _count: { productsAsCategory: countMap.get(c.slug) ?? 0 },
  }));

  return (
    <StorefrontShell>
      <AnimateOnScroll>
        <section className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="bv-enter mb-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Categories
          </h1>
        </section>
      </AnimateOnScroll>

      <AnimateOnScroll>
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {topLevel.map((c, i) => {
              const count = c._count?.productsAsCategory ?? 0;
              return (
                <li key={c.slug} className={`bv-enter ${CATEGORY_STAGGER[i % CATEGORY_STAGGER.length] ?? ''}`}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                      <CategoryIcon slug={c.slug} className="h-7 w-7" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{c.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {count} {count === 1 ? 'product' : 'products'}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </AnimateOnScroll>
    </StorefrontShell>
  );
}
