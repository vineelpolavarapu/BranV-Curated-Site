export function ProductDetailSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Main Grid */}
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Gallery Column (6 cols) */}
          <div className="lg:col-span-6">
            <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl bg-surface-muted" />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] overflow-hidden rounded-md bg-surface-muted" />
              ))}
            </div>
          </div>

          {/* Summary Column (6 cols) */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="h-3 w-20 rounded bg-line" />
            <div className="mt-2 h-8 w-3/4 rounded bg-line" />

            {/* Colors / Sizes Skeleton */}
            <div className="mt-6 space-y-4">
              <div>
                <div className="h-3 w-16 rounded bg-line mb-2" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-7 w-12 rounded-md bg-surface-muted" />
                  ))}
                </div>
              </div>
              <div>
                <div className="h-3 w-14 rounded bg-line mb-2" />
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-7 w-10 rounded-md bg-surface-muted" />
                  ))}
                </div>
              </div>
            </div>

            {/* Buy Now CTA */}
            <div className="mt-8">
              <div className="h-12 w-full rounded-md bg-surface-muted" />
              <div className="mt-2 h-3 w-64 rounded bg-line" />
            </div>

            {/* Description Skeleton */}
            <div className="mt-8 border-t border-line pt-6 space-y-2">
              <div className="h-3.5 w-24 rounded bg-line mb-3" />
              <div className="h-3.5 w-full rounded bg-line" />
              <div className="h-3.5 w-5/6 rounded bg-line" />
              <div className="h-3.5 w-2/3 rounded bg-line" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

