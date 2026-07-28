export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12">
        {/* Gallery Column Skeleton */}
        <div className="flex flex-col-reverse gap-4 sm:flex-row">
          <div className="flex sm:flex-col gap-3 overflow-x-auto sm:overflow-y-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 w-20 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
          <div className="aspect-4/5 w-full overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Product Meta Column Skeleton */}
        <div className="mt-10 px-4 sm:mt-16 sm:px-0 lg:mt-0 space-y-6">
          <div className="h-4 w-24 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-3/4 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-6 w-1/3 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-2 pt-4">
            <div className="h-4 w-full rounded-xs bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-5/6 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-4/6 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* Sizes Skeleton */}
          <div className="pt-6 space-y-3">
            <div className="h-4 w-20 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              ))}
            </div>
          </div>

          {/* CTAs Skeleton */}
          <div className="flex gap-4 pt-8">
            <div className="h-12 flex-1 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-12 w-12 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
