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

  function applyHash(rawHash: string) {
    const sub = rawHash.replace(/^#/, '').trim();
    if (!sub) {
      setFiltered(allProducts);
    } else {
      const fullSlug = `${categorySlug}-${sub}`;
      setFiltered(allProducts.filter((p) => p.subcategory?.slug === fullSlug));
    }
  }

  useEffect(() => {
    applyHash(window.location.hash);
    const onHashChange = () => applyHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, categorySlug]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
        No products match these filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {filtered.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
