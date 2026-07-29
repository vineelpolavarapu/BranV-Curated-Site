export function LookbookSkeleton() {
  return (
    <div className="animate-pulse">
      <nav className="mx-auto max-w-7xl px-6 pt-6 flex items-center gap-2">
        <div className="h-3 w-12 rounded bg-line" />
        <span className="text-content-soft">/</span>
        <div className="h-3 w-24 rounded bg-line" />
      </nav>

      <section className="mx-auto max-w-7xl px-6 pt-4">
        <div className="aspect-[16/9] w-full rounded-2xl bg-surface-muted" />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-10 pt-6 space-y-3">
        <div className="h-9 w-64 rounded-lg bg-surface-muted" />
        <div className="h-4 w-full rounded bg-line" />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16 space-y-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] w-full rounded-2xl bg-surface-muted" />
        ))}
      </section>
    </div>
  );
}
