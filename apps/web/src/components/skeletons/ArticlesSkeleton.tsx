export function ArticlesSkeleton() {
  return (
    <div className="animate-pulse">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="h-9 w-48 rounded-lg bg-surface-muted mb-2" />
        <div className="h-4 w-64 rounded bg-line" />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col rounded-xl p-3 bg-surface border border-line">
              <div className="aspect-[16/10] w-full rounded-lg bg-surface-muted" />
              <div className="mt-4 flex flex-col gap-2">
                <div className="h-3 w-16 rounded-full bg-line" />
                <div className="h-5 w-full rounded bg-line" />
                <div className="h-4 w-5/6 rounded bg-line" />
                <div className="h-3 w-1/3 rounded bg-line mt-2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
