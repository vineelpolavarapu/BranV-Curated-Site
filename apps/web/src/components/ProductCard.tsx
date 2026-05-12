'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ProductCardData } from '@/lib/storefront-types';
import { resolveBuyNowHref } from '@/lib/click-tracking';
import { useClickReturn } from './click-return/ClickReturnProvider';

const retailerLabel: Record<string, string> = {
  flipkart: 'Flipkart',
  amazon: 'Amazon',
  myntra: 'Myntra',
  ajio: 'Ajio',
  meesho: 'Meesho',
  nykaa: 'Nykaa',
  snitch: 'Snitch',
  bewakoof: 'Bewakoof',
  thesouledstore: 'The Souled Store',
  other: 'Retailer',
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const [hovered, setHovered] = useState(false);
  const [liked, setLiked] = useState(false);

  const primary = product.primaryImage;
  const secondary = product.secondaryImage;
  const showSecondary = hovered && !!secondary;
  const shownImage = showSecondary ? secondary! : primary;

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex flex-col"
    >
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-neutral-100"
      >
        {shownImage ? (
          <Image
            src={shownImage.url}
            alt={shownImage.altText ?? product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-opacity duration-300"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            no image
          </div>
        )}

        {/* AI-rendered disclosure badge */}
        {shownImage?.isAiGenerated && <AiBadge />}

        {/* Discount badge */}
        {product.discountPct && product.discountPct > 0 && (
          <span className="absolute left-2 top-2 rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            -{Math.round(product.discountPct)}%
          </span>
        )}

        {/* Wishlist heart (UI placeholder; wires in Phase 5) */}
        <button
          type="button"
          aria-pressed={liked}
          aria-label="Save to wishlist"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLiked((v) => !v);
          }}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm transition hover:scale-110"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 21s-7-4.5-9-9.5C1 6 6 3 9 6c1 1 3 2 3 2s2-1 3-2c3-3 8 0 6 5.5C19 16.5 12 21 12 21z"
              fill={liked ? '#dc2626' : 'none'}
              stroke={liked ? '#dc2626' : 'currentColor'}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </Link>

      <div className="mt-3 flex flex-1 flex-col gap-1">
        <Link
          href={`/brands/${product.brand.slug}`}
          className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          {product.brand.name}
        </Link>
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 text-sm font-medium leading-snug text-neutral-900 hover:underline"
        >
          {product.title}
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            ₹{formatINR(product.price)}
          </span>
          {product.mrp && product.mrp > product.price && (
            <>
              <span className="text-xs text-neutral-400 line-through">
                ₹{formatINR(product.mrp)}
              </span>
              {product.discountPct && (
                <span className="text-xs font-medium text-emerald-700">
                  {Math.round(product.discountPct)}% off
                </span>
              )}
            </>
          )}
        </div>

        {product.buyNow && (
          <BuyNowButton
            href={resolveBuyNowHref(product.buyNow)}
            retailer={product.buyNow.retailer}
            trackingId={product.buyNow.trackingId}
            productTitle={product.title}
          />
        )}
      </div>
    </article>
  );
}

export function BuyNowButton({
  href,
  retailer,
  size = 'sm',
  trackingId,
  productTitle,
}: {
  href: string;
  retailer: string;
  size?: 'sm' | 'lg';
  trackingId?: string | null;
  productTitle?: string;
}) {
  const label = retailerLabel[retailer] ?? retailer;
  const { startTracking } = useClickReturn();
  const onClick = () => {
    if (trackingId && productTitle) {
      startTracking({ trackingId, productTitle });
    }
  };
  return (
    <a
      // PRD §14.1: every affiliate Buy Now is `nofollow sponsored` per Google policy.
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      onClick={onClick}
      className={`mt-2 inline-flex items-center justify-center rounded-md bg-neutral-900 font-medium text-white transition hover:bg-neutral-800 ${
        size === 'lg' ? 'px-5 py-3 text-base' : 'px-3 py-2 text-xs'
      }`}
    >
      Buy on {label}
      <span aria-hidden className="ml-1.5">↗</span>
    </a>
  );
}

function AiBadge() {
  return (
    <span
      title="This image is AI-rendered on Vineel's avatar model"
      className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white backdrop-blur"
    >
      AI-rendered
    </span>
  );
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(n);
}
