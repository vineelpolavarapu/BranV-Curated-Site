'use client';

import Link from 'next/link';
import Image from 'next/image';
import { EmbeddedProduct } from '@/lib/article-types';
import { resolveBuyNowHref, resolveRetailerLabel } from '@/lib/click-tracking';
import { formatINR } from '@/lib/format';
import { useClickReturn } from '@/components/click-return/ClickReturnProvider';

/**
 * Inline product card rendered inside an article body where the author placed
 * a `<div data-product="slug">` marker. Wider than the grid card so it reads
 * as a deliberate editorial embed.
 */
export function EmbeddedProductCard({ product }: { product: EmbeddedProduct }) {
  const { startTracking } = useClickReturn();
  const img = product.primaryImage;
  const buyHref = product.buyNow
    ? resolveBuyNowHref(product.buyNow)
    : null;

  return (
    <aside
      // Pull out of the prose flow so it doesn't get prose's tight max-width.
      className="not-prose my-8 overflow-hidden rounded-card border border-line bg-surface shadow-card sm:flex"
    >
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] w-full bg-surface-muted sm:w-56 sm:flex-none"
      >
        {img ? (
          <Image
            src={img.url}
            alt={img.altText ?? product.title}
            fill
            sizes="(max-width: 640px) 100vw, 220px"
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-content-muted">
            no image
          </div>
        )}
        {img?.isAiGenerated && (
          <span className="absolute bottom-2 right-2 rounded bg-content/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary-fg backdrop-blur">
            AI-rendered
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link
          href={`/brands/${product.brand.slug}`}
          className="text-[11px] font-medium uppercase tracking-wider text-content-soft hover:text-primary"
        >
          {product.brand.name}
        </Link>
        <Link
          href={`/products/${product.slug}`}
          className="mt-0.5 text-lg font-semibold leading-snug text-content hover:underline"
        >
          {product.title}
        </Link>
        {product.price > 0 && (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-semibold">
              ₹{formatINR(product.price)}
            </span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-xs text-content-muted line-through">
                ₹{formatINR(product.mrp)}
              </span>
            )}
          </div>
        )}
        {buyHref && (
          <a
            href={buyHref}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            onClick={() => {
              if (product.buyNow?.trackingId) {
                startTracking({
                  trackingId: product.buyNow.trackingId,
                  productTitle: product.title,
                });
              }
            }}
            className="mt-auto inline-flex items-center justify-center self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition hover:bg-primary-hover"
          >
            Buy on {resolveRetailerLabel(product.buyNow?.retailer ?? '', product.buyNow?.retailerDisplayName)}
            <span aria-hidden className="ml-1.5">↗</span>
          </a>
        )}
      </div>
    </aside>
  );
}
