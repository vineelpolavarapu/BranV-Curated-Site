'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ProductCardData } from '@/lib/storefront-types';
import { resolveBuyNowHref, resolveRetailerLabel } from '@/lib/click-tracking';
import { formatINR } from '@/lib/format';
import { m } from 'motion/react';
import { useClickReturn } from './click-return/ClickReturnProvider';
import { useWishlist } from './wishlist/WishlistProvider';
import { Icon } from './icons';

export function ProductCard({ product }: { product: ProductCardData }) {
  const [hovered, setHovered] = useState(false);
  const [heartPopping, setHeartPopping] = useState(false);
  const { isInWishlist, toggle } = useWishlist();
  const liked = isInWishlist(product.id);

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!liked) {
      setHeartPopping(true);
      setTimeout(() => setHeartPopping(false), 400);
    }
    void toggle(product.id);
  };

  const primary = product.primaryImage;
  const secondary = product.secondaryImage;
  const showSecondary = hovered && !!secondary;
  const shownImage = showSecondary ? secondary! : primary;

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex flex-col overflow-hidden rounded-card bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
    >
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-surface-muted"
      >
        {shownImage ? (
          <Image
            src={shownImage.url}
            alt={shownImage.altText ?? product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1080px) 33vw, 25vw"
            className="object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.04]"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-content-muted">
            no image
          </div>
        )}

        {/* AI-rendered disclosure badge */}
        {shownImage?.isAiGenerated && <AiBadge />}

        {/* Top-left badge stack: Featured (when active) above Discount — max-w-[calc(100%-44px)] prevents collision with wishlist button */}
        {(product.isFeatured || (product.discountPct && product.discountPct > 0)) && (
          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-44px)] flex-col items-start gap-1">
            {product.isFeatured && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950 shadow-sm">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                </svg>
                Featured
              </span>
            )}
            {product.discountPct && product.discountPct > 0 && (
              <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm animate-pop-badge">
                -{Math.round(product.discountPct)}%
              </span>
            )}
          </div>
        )}

        {/* Wishlist heart button in 32px glassmorphic circle */}
        <m.button
          type="button"
          aria-pressed={liked}
          aria-label={liked ? 'Remove from wishlist' : 'Save to wishlist'}
          onClick={handleWishlistClick}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur-sm border border-slate-100 shadow-sm transition-colors hover:bg-white"
        >
          <Icon.Heart
            size={16}
            strokeWidth={1.8}
            aria-hidden
            className={`${liked ? 'text-accent fill-accent' : 'text-slate-500'} ${heartPopping ? 'bv-heart-popping' : ''}`}
            fill={liked ? 'currentColor' : 'none'}
          />
        </m.button>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <Link
          href={`/brands/${product.brand.slug}`}
          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
        >
          {product.brand.name}
        </Link>
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 hover:text-primary transition-colors"
        >
          {product.title}
        </Link>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-heading text-base font-extrabold text-primary">
            ₹{formatINR(product.price)}
          </span>
          {product.mrp && product.mrp > product.price && (
            <>
              <span className="text-xs text-slate-400 line-through">
                ₹{formatINR(product.mrp)}
              </span>
              {product.discountPct && (
                <span className="text-xs font-bold text-emerald-600">
                  {Math.round(product.discountPct)}% off
                </span>
              )}
            </>
          )}
        </div>

        {product.buyNow && (
          <div className="mt-1 translate-y-1.5 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100">
            <BuyNowButton
              href={resolveBuyNowHref(product.buyNow)}
              retailer={product.buyNow.retailer}
              retailerDisplayName={product.buyNow.retailerDisplayName}
              trackingId={product.buyNow.trackingId}
              productTitle={product.title}
            />
          </div>
        )}
      </div>
    </article>
  );
}

export function BuyNowButton({
  href,
  retailer,
  retailerDisplayName,
  size = 'sm',
  trackingId,
  productTitle,
}: {
  href: string;
  retailer: string;
  retailerDisplayName?: string | null;
  size?: 'sm' | 'lg';
  trackingId?: string | null;
  productTitle?: string;
}) {
  const label = resolveRetailerLabel(retailer, retailerDisplayName);
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
      className={`mt-2 inline-flex items-center justify-center rounded-md bg-primary font-medium text-primary-fg transition hover:bg-primary-hover ${
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
      className="absolute bottom-2 right-2 rounded bg-content/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary-fg backdrop-blur"
    >
      AI-rendered
    </span>
  );
}

