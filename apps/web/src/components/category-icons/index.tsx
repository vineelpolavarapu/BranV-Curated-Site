import React from 'react';

export interface CategoryIconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export function ShirtCategoryIcon({ className = 'h-6 w-6', size = 26, strokeWidth = 1.8 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <path d="M6 3h12l3 5v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8l3-5z" />
      <line x1="12" y1="3" x2="12" y2="22" />
      <polyline points="9 8 12 10 15 8" />
    </svg>
  );
}

export function TShirtCategoryIcon({ className = 'h-6 w-6', size = 26, strokeWidth = 1.8 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  );
}

export function JeansCategoryIcon({ className = 'h-6 w-6', size = 26, strokeWidth = 1.8 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <path d="M4 2h16v4l-2 16h-4l-2-10-2 10H6L4 6V2z" />
      <line x1="4" y1="6" x2="20" y2="6" />
    </svg>
  );
}

export function JacketCategoryIcon({ className = 'h-6 w-6', size = 26, strokeWidth = 1.8 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <path d="M4 4l4-2h8l4 2v16H4V4z" />
      <line x1="12" y1="2" x2="12" y2="20" />
      <polyline points="8 4 12 7 16 4" />
    </svg>
  );
}

export function HoodieCategoryIcon({ className = 'h-6 w-6', size = 26, strokeWidth = 1.8 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <path d="M4 6l8-4 8 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
      <circle cx="12" cy="11" r="3" />
    </svg>
  );
}

export function FootwearCategoryIcon({ className = 'h-6 w-6', size = 26, strokeWidth = 1.8 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <path d="M2 17h20v2H2zM4 17l2-7h6l4 3h6v4H4z" />
    </svg>
  );
}

export function WatchCategoryIcon({ className = 'h-6 w-6', size = 26, strokeWidth = 1.8 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="12" r="6" />
      <polyline points="12 9 12 12 14 14" />
      <path d="M9 3h6v3H9zM9 18h6v3H9z" />
    </svg>
  );
}

export function AccessoryCategoryIcon({ className = 'h-6 w-6', size = 26, strokeWidth = 1.8 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <path d="M2 14h20M5 14A7 7 0 0 1 19 14M2 14c0 2 2 4 5 4h10c3 0 5-2 5-4" />
    </svg>
  );
}

/** Dynamic resolver for category slug → custom SVG React component */
export function getCategoryIconBySlug(slug: string, className?: string) {
  const lower = slug.toLowerCase();
  if (lower.includes('shirt') && !lower.includes('t-shirt') && !lower.includes('sweatshirt')) return <ShirtCategoryIcon className={className} />;
  if (lower.includes('t-shirt') || lower.includes('polo')) return <TShirtCategoryIcon className={className} />;
  if (lower.includes('jean') || lower.includes('denim') || lower.includes('pant') || lower.includes('track')) return <JeansCategoryIcon className={className} />;
  if (lower.includes('jacket') || lower.includes('outerwear') || lower.includes('coat')) return <JacketCategoryIcon className={className} />;
  if (lower.includes('hoodie')) return <HoodieCategoryIcon className={className} />;
  if (lower.includes('sweatshirt') || lower.includes('sweater')) return <HoodieCategoryIcon className={className} />;
  if (lower.includes('footwear') || lower.includes('shoe') || lower.includes('sneaker') || lower.includes('boot')) return <FootwearCategoryIcon className={className} />;
  if (lower.includes('watch')) return <WatchCategoryIcon className={className} />;
  return <AccessoryCategoryIcon className={className} />;
}

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  return getCategoryIconBySlug(slug, className);
}
