'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ProductGridSkeleton } from '@/components/skeletons/ProductGridSkeleton';

interface WishlistItem {
  id: string;
  productId: string;
  notifyOnPriceDrop: boolean;
  createdAt: string;
  product: {
    id: string;
    slug: string;
    title: string;
    price: number;
    mrp: number | null;
    discountPct: number | null;
    currency: string;
    brand: { id: string; name: string; slug: string };
    primaryImage: {
      url: string;
      altText: string | null;
      isAiGenerated: boolean;
    } | null;
  };
}

interface WishlistPage {
  items: WishlistItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function WishlistPage() {

  const router = useRouter();
  const [data, setData] = useState<WishlistPage | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<WishlistPage>('/me/wishlist');
    if (result.status === 401 || result.status === 403) {
      router.replace('/login?next=/wishlist');
      return;
    }
    setData(result.data);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRemove(productId: string) {
    const result = await apiFetch(`/wishlist/items/${productId}`, {
      method: 'DELETE',
    });
    if (result.ok) void load();
  }

  async function onToggleNotify(productId: string, current: boolean) {
    const result = await apiFetch(`/wishlist/items/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ notifyOnPriceDrop: !current }),
    });
    if (result.ok) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.productId === productId
              ? { ...it, notifyOnPriceDrop: !current }
              : it,
          ),
        };
      });
    }
  }

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-7xl px-6 py-8 grid grid-cols-1 gap-y-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">My Wishlist</h1>

        {loading && (
          <div className="mt-4">
            <ProductGridSkeleton count={8} />
          </div>
        )}


        {data && data.items.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface-muted p-10 text-center text-sm text-content-soft">
            Your wishlist is empty. Tap the heart on any product to save it
            here.
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {data.items.map((item) => (
              <WishlistCard
                key={item.id}
                item={item}
                onRemove={onRemove}
                onToggleNotify={onToggleNotify}
              />
            ))}
          </div>
        )}
      </section>
    </StorefrontShell>
  );
}

function WishlistCard({
  item,
  onRemove,
  onToggleNotify,
}: {
  item: WishlistItem;
  onRemove: (productId: string) => void;
  onToggleNotify: (productId: string, current: boolean) => void;
}) {
  const img = item.product.primaryImage;
  return (
    <article className="group flex flex-col">
      <Link
        href={`/products/${item.product.slug}`}
        className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-muted"
      >
        {img ? (
          <Image
            src={img.url}
            alt={img.altText ?? item.product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1080px) 33vw, 25vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-content-muted">
            no image
          </div>
        )}
      </Link>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <Link
          href={`/brands/${item.product.brand.slug}`}
          className="text-[11px] font-medium uppercase tracking-wider text-content-soft hover:text-primary"
        >
          {item.product.brand.name}
        </Link>
        <Link
          href={`/products/${item.product.slug}`}
          className="line-clamp-2 text-sm font-medium leading-snug text-content hover:underline"
        >
          {item.product.title}
        </Link>
        {/* Amount visibility removed per request */}
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-content-soft">
          <input
            type="checkbox"
            checked={item.notifyOnPriceDrop}
            onChange={() =>
              onToggleNotify(item.productId, item.notifyOnPriceDrop)
            }
            className="h-3.5 w-3.5 rounded border-line"
          />
          Notify on price drop
        </label>
        <button
          type="button"
          onClick={() => onRemove(item.productId)}
          className="mt-1 self-start text-xs text-content-soft underline hover:text-primary"
        >
          Remove
        </button>
      </div>
    </article>
  );
}
