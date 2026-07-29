export function EditDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <nav className="mx-auto max-w-7xl px-6 pt-6 flex items-center gap-2">
        <div className="h-3 w-12 rounded bg-line" />
        <span className="text-content-soft">/</span>
        <div className="h-3 w-12 rounded bg-line" />
        <span className="text-content-soft">/</span>
        <div className="h-3 w-24 rounded bg-line" />
      </nav>

      <section className="mx-auto max-w-7xl px-6 pt-6">
        <div className="aspect-[16/9] sm:aspect-[21/9] w-full rounded-2xl bg-surface-muted" />
        <div className="mt-6 max-w-3xl space-y-2">
          <div className="h-4 w-20 rounded bg-line" />
          <div className="h-8 w-64 rounded-lg bg-surface-muted" />
          <div className="h-4 w-full rounded bg-line" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-xl border border-line p-4 bg-surface">
              <div className="aspect-[4/5] w-28 shrink-0 rounded-lg bg-surface-muted" />
              <div className="flex flex-col justify-between py-1 w-full">
                <div className="space-y-2">
                  <div className="h-3 w-16 rounded bg-line" />
                  <div className="h-4 w-3/4 rounded bg-line" />
                </div>
                <div className="h-8 w-24 rounded-md bg-surface-muted" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
