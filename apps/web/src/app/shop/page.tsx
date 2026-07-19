import Link from 'next/link';
import { apiServer } from '@/lib/api-server';
import { CategoryCard } from '@/lib/storefront-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { isCollectionSlug } from '@/lib/collections';

export const dynamic = 'force-dynamic';

const CATEGORY_STAGGER = ['bv-delay-1', 'bv-delay-2', 'bv-delay-3', 'bv-delay-4', 'bv-delay-5', 'bv-delay-6'];

export default async function ShopPage() {
  const categories = (await apiServer<CategoryCard[]>('/categories')) ?? [];
  const topLevel = categories
    // Collection categories (Sharp Formals, etc.) are reached via the homepage
    // banner CTAs, not the Shop grid — exclude them here.
    .filter((c) => c.parentId === null && !isCollectionSlug(c.slug))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <StorefrontShell>
      <AnimateOnScroll>
        <section className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="bv-enter mb-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Shop
          </h1>
          
        </section>
      </AnimateOnScroll>

      {topLevel.length > 0 ? (
        <AnimateOnScroll>
          <section className="mx-auto max-w-7xl px-6 pb-12">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {topLevel.map((c, i) => (
                <li key={c.slug} className={`bv-enter ${CATEGORY_STAGGER[i % CATEGORY_STAGGER.length] ?? ''}`}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="group flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-center transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-neutral-400 hover:shadow-md"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-700 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <p className="text-sm font-medium text-neutral-900">{c.name}</p>
                      <p className="text-xs text-neutral-500">
                        {c._count.productsAsCategory}{' '}
                        {c._count.productsAsCategory === 1 ? 'product' : 'products'}
                      </p>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </AnimateOnScroll>
      ) : (
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
            No categories yet.
          </p>
        </section>
      )}
    </StorefrontShell>
  );
}
