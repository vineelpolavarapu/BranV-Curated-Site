export function BrandGridSkeleton() {
  return (
    <div className="animate-pulse">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="h-9 w-48 rounded-lg bg-surface-muted mb-2" />
        <div className="h-4 w-36 rounded bg-line" />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="h-6 w-32 rounded bg-line mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-5 flex flex-col justify-between h-32">
              <div className="h-14 w-full rounded bg-surface-muted" />
              <div className="space-y-1">
                <div className="h-3.5 w-3/4 rounded bg-line" />
                <div className="h-3 w-1/2 rounded bg-line" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
