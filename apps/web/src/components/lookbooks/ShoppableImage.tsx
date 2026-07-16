'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { LookbookPublicImage } from '@/lib/phase7-types';
import { formatINR } from '@/lib/format';
import { resolveBuyNowHref, resolveRetailerLabel } from '@/lib/click-tracking';
import { useClickReturn } from '@/components/click-return/ClickReturnProvider';

interface Props {
  image: LookbookPublicImage;
}

/**
 * Full-bleed lookbook image with click-to-shop hotspots. Tapping a hotspot
 * opens a small product popover anchored to that hotspot; the Buy Now there
 * routes through /go/:trackingId like everywhere else.
 */
export function ShoppableImage({ image }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <figure className="relative w-full overflow-hidden rounded-2xl bg-neutral-100">
      <Image
        src={image.imageUrl}
        alt=""
        width={1600}
        height={2000}
        unoptimized
        sizes="(max-width: 1023px) 100vw, 800px"
        className="w-full object-cover"
      />
      {image.tags.map((t, idx) => (
        <Hotspot
          key={t.id}
          tag={t}
          index={idx + 1}
          open={open === t.id}
          onToggle={() => setOpen(open === t.id ? null : t.id)}
          onClose={() => setOpen(null)}
        />
      ))}
    </figure>
  );
}

function Hotspot({
  tag,
  index,
  open,
  onToggle,
  onClose,
}: {
  tag: LookbookPublicImage['tags'][number];
  index: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const product = tag.product;
  const { startTracking } = useClickReturn();
  const buyHref = product.buyNow ? resolveBuyNowHref(product.buyNow) : null;

  return (
    <div
      className="absolute"
      style={{ left: `${tag.xPercent}%`, top: `${tag.yPercent}%` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Shop ${product.title}`}
        aria-expanded={open}
        className={`grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-lg transition ${
          open ? 'bg-emerald-500 scale-110' : 'bg-neutral-900 hover:scale-110'
        } text-xs font-semibold text-white`}
      >
        {index}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${product.title} popover`}
          className="absolute z-10 -translate-x-1/2 translate-y-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
        >
          <div className="flex gap-3">
            <Link
              href={`/products/${product.slug}`}
              className="relative aspect-[4/5] w-16 flex-none overflow-hidden rounded-md bg-neutral-100"
            >
              {product.primaryImage ? (
                <Image
                  src={product.primaryImage.url}
                  alt=""
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-cover"
                />
              ) : null}
            </Link>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                {product.brand.name}
              </p>
              <Link
                href={`/products/${product.slug}`}
                className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
              >
                {product.title}
              </Link>
              <p className="mt-1 text-xs font-semibold">
                ₹{formatINR(product.price)}
                {product.mrp && product.mrp > product.price && (
                  <span className="ml-1.5 font-normal text-neutral-400 line-through">
                    ₹{formatINR(product.mrp)}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-neutral-400 hover:text-neutral-900"
            >
              ✕
            </button>
          </div>
          {buyHref && product.buyNow && (
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
              className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Buy on {resolveRetailerLabel(product.buyNow.retailer, product.buyNow.retailerDisplayName)}
              <span aria-hidden className="ml-1.5">↗</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
