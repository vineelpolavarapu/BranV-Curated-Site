import { ProductGridSkeleton } from '@/components/skeletons/ProductGridSkeleton';

export default function CategoryLoading() {
  return (
    <div className="animate-pulse">
      {/* Category Header Skeleton */}
      <section className="mx-auto max-w-7xl px-6 pt-8">
        <div className="mb-2 h-3 w-32 rounded bg-line" />
        <div className="h-9 w-64 rounded-lg bg-surface-muted" />
        <div className="mt-2 h-4 w-24 rounded bg-line" />
      </section>

      {/* Listing Shell Grid Skeleton */}
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-6">
        <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
          <div className="h-4 w-20 rounded bg-line" />
          <div className="h-8 w-32 rounded-md bg-surface-muted" />
        </div>
        <ProductGridSkeleton count={12} />
      </section>
    </div>
  );
}

