'use client';

import { useEffect } from 'react';
import { recordRecentlyViewed } from '@/lib/recently-viewed';
import { ProductCardData } from '@/lib/storefront-types';

export function RecordRecentlyViewed({ product }: { product: ProductCardData }) {
  useEffect(() => {
    recordRecentlyViewed({
      slug: product.slug,
      title: product.title,
      brandName: product.brand.name,
      price: product.price,
      mrp: product.mrp,
      imageUrl: product.primaryImage?.url ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  return null;
}
