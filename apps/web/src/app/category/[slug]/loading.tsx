import { ProductGridSkeleton } from '@/components/skeletons/ProductGridSkeleton';

export default function CategoryLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-10 w-64 rounded-xl bg-zinc-200 dark:bg-zinc-800 mb-4" />
      <div className="h-4 w-96 rounded-xs bg-zinc-200 dark:bg-zinc-800 mb-8" />
      <ProductGridSkeleton count={12} />
    </div>
  );
}
