import { ProductGridSkeleton } from './ProductGridSkeleton';

export function SearchSkeleton() {
  return (
    <div className="animate-pulse">
      <section className="mx-auto max-w-7xl px-6 pt-8">
        <div className="h-9 w-64 rounded-lg bg-surface-muted" />
        <div className="mt-2 h-4 w-24 rounded bg-line" />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-6">
        <div className="w-full space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="h-4 w-20 rounded bg-line" />
            <div className="h-8 w-32 rounded-md bg-surface-muted" />
          </div>
          <ProductGridSkeleton count={12} />
        </div>
      </section>
    </div>
  );
}

