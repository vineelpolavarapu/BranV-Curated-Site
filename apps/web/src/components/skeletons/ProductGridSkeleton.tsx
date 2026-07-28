export function ProductCardSkeleton() {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 animate-pulse">
      {/* Image Container Skeleton */}
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800" />

      {/* Content Skeleton */}
      <div className="mt-3 flex flex-1 flex-col space-y-2">
        <div className="h-3 w-1/3 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-5/6 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-1/2 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="h-5 w-20 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-24 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
