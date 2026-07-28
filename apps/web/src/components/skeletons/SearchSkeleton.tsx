import { ProductGridSkeleton } from './ProductGridSkeleton';

export function SearchSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-8 w-64 rounded-xs bg-zinc-200 dark:bg-zinc-800 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar Skeleton */}
        <div className="hidden lg:block space-y-6">
          <div className="h-6 w-32 rounded-xs bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-32 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-48 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Results Grid Skeleton */}
        <div className="lg:col-span-3">
          <ProductGridSkeleton count={9} />
        </div>
      </div>
    </div>
  );
}
