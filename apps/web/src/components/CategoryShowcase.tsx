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

function ViewAllCard({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col"
      aria-label={`View all ${title}`}
    >
      <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-lg bg-neutral-900 text-white transition-transform duration-200 group-hover:scale-[1.02]">
        <div className="flex flex-col items-center gap-3 px-4 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 9h12M10 4l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em]">
            View all
          </span>
          <span className="text-sm font-semibold tracking-tight">{title}</span>
        </div>
      </div>
    </Link>
  );
}

export function CategoryShowcase({
  title,
  slug,
  href: hrefOverride,
  products,
}: {
  title: string;
  slug: string;
  href?: string;
  products: ProductCardData[];
}) {
  const items = products.slice(0, 5);
  const hasProducts = items.length > 0;
  const href = hrefOverride ?? `/category/${slug}`;

  return (
    <AnimateOnScroll>
      <section className="w-full px-4 py-12 md:px-8 lg:px-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="bv-enter text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            {title}
          </h2>
          <Link
            href={href}
            className="bv-enter bv-delay-1 group hidden shrink-0 rounded-full bg-neutral-900 px-6 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition-[background-color,transform] duration-200 hover:scale-[1.03] hover:bg-neutral-800 md:inline-flex items-center gap-1"
          >
            View all <span className="transition-transform duration-180 ease-in-out group-hover:translate-x-0.5">→</span>
          </Link>
        </div>

        {/* Phone (<768px): horizontal scroll strip + trailing view-all card */}
        <ul
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
        >
          {hasProducts
            ? items.map((p, i) => (
                <li
                  key={p.id}
                  className={`bv-enter ${STAGGER[i] ?? ''} w-[60vw] max-w-[240px] shrink-0 snap-start`}
                >
                  <ProductCard product={p} />
                </li>
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className={`bv-enter ${STAGGER[i] ?? ''} w-[60vw] max-w-[240px] shrink-0 snap-start`}
                >
                  <PlaceholderProductCard />
                </li>
              ))}
          <li className="bv-enter bv-delay-5 w-[60vw] max-w-[240px] shrink-0 snap-end">
            <ViewAllCard href={href} title={title} />
          </li>
        </ul>

        {/* Tablet (768–1023px): 3-column grid */}
        <ul className="hidden md:grid lg:hidden grid-cols-3 gap-4">
          {hasProducts
            ? items.slice(0, 5).map((p, i) => (
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

        {/* Desktop (1080px+): 4–5 column grid */}
        <ul className="hidden lg:grid grid-cols-4 xl:grid-cols-5 gap-4">
          {hasProducts
            ? items.map((p, i) => (
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
