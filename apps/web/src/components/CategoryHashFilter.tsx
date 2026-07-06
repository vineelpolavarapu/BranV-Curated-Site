'use client';
import { useEffect, useState } from 'react';
import { ProductCard } from './ProductCard';
import type { ProductCardData } from '@/lib/storefront-types';

export function CategoryHashFilter({
  categorySlug,
  allProducts,
}: {
  categorySlug: string;
  allProducts: ProductCardData[];
}) {
  const [filtered, setFiltered] = useState<ProductCardData[]>(allProducts);
  const [transitioning, setTransitioning] = useState(false);
  const [pendingProducts, setPendingProducts] = useState<ProductCardData[]>(allProducts);

  function applyHash(rawHash: string) {
    const sub = rawHash.replace(/^#/, '').trim();
    let nextProducts = allProducts;
    if (sub) {
      const fullSlug = `${categorySlug}-${sub}`;
      nextProducts = allProducts.filter((p) => p.subcategory?.slug === fullSlug);
    }
    setTransitioning(true);
    setPendingProducts(nextProducts);
  }

  useEffect(() => {
    applyHash(window.location.hash);
    const onHashChange = () => applyHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, categorySlug]);

  useEffect(() => {
    if (transitioning) {
      const timer = setTimeout(() => {
        setFiltered(pendingProducts);
        setTransitioning(false);
      }, 150); // Matches the 150ms fade-out duration
      return () => clearTimeout(timer);
    }
  }, [transitioning, pendingProducts]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
        No products match these filters.
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 transition-opacity duration-150 ease-in-out ${
        transitioning ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {filtered.map((p, idx) => (
        <div
          key={p.id}
          style={{
            animationDelay: `${idx * 40}ms`,
            willChange: 'transform, opacity',
          }}
          className="opacity-0 translate-y-2 animate-[bv-fade-up_350ms_var(--ease-decelerate)_both]"
        >
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
