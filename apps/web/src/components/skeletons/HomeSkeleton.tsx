import { ProductGridSkeleton } from './ProductGridSkeleton';

export function HomeSkeleton() {
  return (
    <div className="space-y-16 pb-16 animate-pulse">
      {/* Hero Skeleton */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <div className="h-[420px] w-full overflow-hidden rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Brand Carousel Skeleton */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="h-6 w-48 rounded-xs bg-zinc-200 dark:bg-zinc-800 mb-6" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </div>

      {/* New Arrivals Section Skeleton */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-56 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-24 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}
