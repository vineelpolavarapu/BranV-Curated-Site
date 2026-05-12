'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StorefrontShell } from '@/components/StorefrontShell';
import { formatINR } from '@/components/ProductCard';

interface WardrobeItem {
  id: string;
  retailer: string;
  selfReportedPrice: number | null;
  selfReportedDate: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  product: {
    id: string;
    slug: string;
    title: string;
    price: number;
    currency: string;
    brand: { id: string; name: string; slug: string };
    primaryImage: {
      url: string;
      altText: string | null;
      isAiGenerated: boolean;
    } | null;
  };
}

interface WardrobePage {
  items: WardrobeItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    totalItems: number;
    totalSpend: number;
    favoriteBrand: { name: string; slug: string; count: number } | null;
  };
}

export default function WardrobePage() {
  const router = useRouter();
  const [data, setData] = useState<WardrobePage | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<WardrobePage>('/me/wardrobe');
    if (result.status === 401 || result.status === 403) {
      router.replace('/login?next=/wardrobe');
      return;
    }
    setData(result.data);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRemove(id: string) {
    const result = await apiFetch(`/wardrobe/items/${id}`, {
      method: 'DELETE',
    });
    if (result.ok) void load();
  }

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">My Wardrobe</h1>

        {loading && (
          <div className="mt-6 h-2 w-32 animate-pulse rounded bg-neutral-200" />
        )}

        {data && (
          <>
            <StatsBlock stats={data.stats} />

            {data.items.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {data.items.map((item) => (
                  <WardrobeCard key={item.id} item={item} onRemove={onRemove} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </StorefrontShell>
  );
}

function StatsBlock({ stats }: { stats: WardrobePage['stats'] }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <Stat label="Items" value={String(stats.totalItems)} />
      <Stat
        label="Self-reported spend"
        value={stats.totalSpend > 0 ? `₹${formatINR(stats.totalSpend)}` : '—'}
      />
      <Stat
        label="Favorite brand"
        value={
          stats.favoriteBrand
            ? `${stats.favoriteBrand.name} (${stats.favoriteBrand.count})`
            : '—'
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-600">
      Your wardrobe is empty. After you confirm &ldquo;Yes, I bought it&rdquo; on a
      product, it&apos;ll show up here.
    </div>
  );
}

function WardrobeCard({
  item,
  onRemove,
}: {
  item: WardrobeItem;
  onRemove: (id: string) => void;
}) {
  const img = item.product.primaryImage;
  return (
    <article className="group flex flex-col">
      <Link
        href={`/products/${item.product.slug}`}
        className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-neutral-100"
      >
        {img ? (
          <Image
            src={img.url}
            alt={img.altText ?? item.product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            no image
          </div>
        )}
      </Link>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <Link
          href={`/brands/${item.product.brand.slug}`}
          className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          {item.product.brand.name}
        </Link>
        <Link
          href={`/products/${item.product.slug}`}
          className="line-clamp-2 text-sm font-medium leading-snug text-neutral-900 hover:underline"
        >
          {item.product.title}
        </Link>
        <p className="mt-1 text-xs text-neutral-500">
          via {item.retailer} · added{' '}
          {new Date(item.createdAt).toLocaleDateString()}
        </p>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="mt-2 self-start text-xs text-neutral-500 underline hover:text-neutral-900"
        >
          Remove from wardrobe
        </button>
      </div>
    </article>
  );
}
