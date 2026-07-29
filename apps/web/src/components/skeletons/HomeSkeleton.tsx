export function HomeSkeleton() {
  return (
    <div className="space-y-12 pb-16 animate-pulse">
      {/* Hero Skeleton */}
      <div className="w-full px-4 pt-6 md:px-8 lg:px-12">
        <div className="h-[360px] md:h-[460px] w-full overflow-hidden rounded-3xl bg-surface-muted" />
      </div>

      {/* Category Showcase Section Skeleton */}
      <div className="w-full px-4 py-6 md:px-8 lg:px-12">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 rounded-lg bg-surface-muted" />
          <div className="hidden md:block h-8 w-28 rounded-full bg-surface-muted" />
        </div>
        
        {/* Mobile snap strip */}
        <div className="flex gap-3 overflow-x-auto md:hidden pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[60vw] max-w-[240px] shrink-0 aspect-[4/5] rounded-card bg-surface-muted" />
          ))}
        </div>

        {/* Tablet 3-col grid */}
        <div className="hidden md:grid lg:hidden grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-card bg-surface-muted" />
          ))}
        </div>

        {/* Desktop 4/5-col grid */}
        <div className="hidden lg:grid grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-card bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

