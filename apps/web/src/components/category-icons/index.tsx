'use client';

import React, { useState } from 'react';

export interface CategoryIconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
  slug?: string;
}

export function getCategoryIconImageBySlug(slug?: string): string {
  if (!slug || typeof slug !== 'string') return '/category-icons/tshirt.png';
  const lower = slug.toLowerCase();

  if (lower.includes('t-shirt') || lower.includes('tshirt') || lower.includes('polo') || lower.includes('tee')) {
    return '/category-icons/tshirt.png';
  }
  if (lower.includes('inner') || lower === 'inners') {
    return '/category-icons/inner.png';
  }
  if (lower.includes('sweatshirt')) {
    return '/category-icons/sweatshirts.png';
  }
  if (lower.includes('hoodie')) {
    return '/category-icons/hoodies.png';
  }
  if (lower.includes('jacket')) {
    return '/category-icons/jackets.png';
  }
  if (lower.includes('jean')) {
    return '/category-icons/jeans.png';
  }
  if (lower.includes('footwear') || lower.includes('shoe') || lower.includes('sneaker') || lower.includes('boot')) {
    return '/category-icons/footwear.png';
  }
  if (lower.includes('watch')) {
    return '/category-icons/watches.png';
  }
  if (lower.includes('trouser') || lower.includes('chino')) {
    return '/category-icons/trousers.png';
  }
  if (lower.includes('track') || lower.includes('jogger')) {
    return '/category-icons/tracks.png';
  }
  if (lower.includes('shirt')) {
    return '/category-icons/shirts.png';
  }
  if (lower.includes('short')) {
    return '/category-icons/shorts.png';
  }

  return `/category-icons/${lower}.png`;
}

export function CategoryIcon({ slug, className = 'h-full w-full object-cover rounded-md' }: { slug?: string; className?: string }) {
  const targetSrc = getCategoryIconImageBySlug(slug);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const finalSrc = failedSrc === targetSrc ? '/category-icons/tshirt.png' : targetSrc;

  return (
    <img
      src={finalSrc}
      alt={slug || 'Category'}
      className={className}
      onError={() => {
        if (finalSrc !== '/category-icons/tshirt.png') {
          setFailedSrc(targetSrc);
        }
      }}
    />
  );
}

export function ShirtCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="shirts" className={className} />;
}

export function TShirtCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="t-shirts" className={className} />;
}

export function JeansCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="jeans" className={className} />;
}

export function JacketCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="jackets" className={className} />;
}

export function HoodieCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="hoodies" className={className} />;
}

export function FootwearCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="footwear" className={className} />;
}

export function WatchCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="watches" className={className} />;
}

export function InnerCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="inners" className={className} />;
}

export function SweatshirtCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="sweatshirts" className={className} />;
}

export function TrouserCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="trousers" className={className} />;
}

export function TrackCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="tracks" className={className} />;
}

export function AccessoryCategoryIcon({ className = 'h-6 w-6' }: CategoryIconProps) {
  return <CategoryIcon slug="watches" className={className} />;
}

export function getCategoryIconBySlug(slug?: string, className?: string) {
  return <CategoryIcon slug={slug} className={className} />;
}



