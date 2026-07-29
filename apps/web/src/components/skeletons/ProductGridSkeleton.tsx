export function ProductCardSkeleton() {
  return (
    <div className="group flex flex-col overflow-hidden rounded-card bg-surface shadow-card animate-pulse">
      {/* Image Container Skeleton */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-muted" />

      {/* Content Skeleton matching ProductCard */}
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {/* Brand line */}
        <div className="h-2.5 w-16 rounded bg-line" />
        {/* Title line 1 */}
        <div className="mt-1 h-3.5 w-full rounded bg-line" />
        {/* Title line 2 */}
        <div className="h-3.5 w-3/4 rounded bg-line" />
        {/* CTA Button skeleton */}
        <div className="mt-2 h-7 w-24 rounded-md bg-surface-muted" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

