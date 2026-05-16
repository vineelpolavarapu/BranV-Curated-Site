import Link from 'next/link';
import { ProductCardData } from '@/lib/storefront-types';
import { ProductCard } from './ProductCard';

/**
 * One BSC-style home section: heading + "View all" pill + up to 5 product
 * cards. Rendering is suppressed entirely when there are no products in the
 * category — the home page hides empty sections per spec.
 */
export function CategoryShowcase({
  title,
  slug,
  products,
}: {
  title: string;
  slug: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="w-full px-4 py-12 md:px-8 lg:px-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h2>
        <Link
          href={`/category/${slug}`}
          className="shrink-0 rounded-full bg-neutral-900 px-6 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition hover:bg-neutral-800"
        >
          View all
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {products.slice(0, 5).map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
