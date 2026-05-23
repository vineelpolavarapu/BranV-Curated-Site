import Link from 'next/link';
import { ProductCardData } from '@/lib/storefront-types';
import { ProductCard } from './ProductCard';
import { AnimateOnScroll } from './AnimateOnScroll';

const STAGGER = ['bv-delay-1', 'bv-delay-2', 'bv-delay-3', 'bv-delay-4', 'bv-delay-5'];

function PlaceholderProductCard() {
  return (
    <div className="flex flex-col">
      <div className="aspect-[4/5] w-full rounded-lg bg-neutral-200" />
      <div className="mt-3 flex flex-col gap-2">
        <div className="h-2.5 w-16 rounded bg-neutral-200" />
        <div className="h-3 w-full rounded bg-neutral-200" />
        <div className="h-3 w-3/4 rounded bg-neutral-200" />
        <div className="h-3 w-1/2 rounded bg-neutral-200" />
      </div>
    </div>
  );
}

export function CategoryShowcase({
  title,
  slug,
  products,
}: {
  title: string;
  slug: string;
  products: ProductCardData[];
}) {
  return (
    <AnimateOnScroll>
      <section className="w-full px-4 py-12 md:px-8 lg:px-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="bv-enter text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h2>
          <Link
            href={`/category/${slug}`}
            className="bv-enter bv-delay-1 shrink-0 rounded-full bg-neutral-900 px-6 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition-[background-color,transform] duration-200 hover:scale-[1.03] hover:bg-neutral-800"
          >
            View all →
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.length > 0
            ? products.slice(0, 5).map((p, i) => (
                <li key={p.id} className={`bv-enter ${STAGGER[i] ?? ''}`}>
                  <ProductCard product={p} />
                </li>
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className={`bv-enter ${STAGGER[i] ?? ''}`}>
                  <PlaceholderProductCard />
                </li>
              ))}
        </ul>
      </section>
    </AnimateOnScroll>
  );
}
