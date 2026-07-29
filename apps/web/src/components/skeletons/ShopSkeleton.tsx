export function ShopSkeleton() {
  return (
    <div className="animate-pulse">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="h-9 w-48 rounded-lg bg-surface-muted" />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="h-16 w-16 rounded-full bg-slate-100" />
              <div className="flex flex-col items-center gap-1 w-full">
                <div className="h-4 w-20 rounded bg-line" />
                <div className="h-3 w-14 rounded bg-line" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
