'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { ProductCardData } from '@/lib/storefront-types';
import { resolveBuyNowHref, resolveRetailerLabel } from '@/lib/click-tracking';
import { formatINR } from '@/lib/format';
import { m } from 'motion/react';
import { useClickReturn } from './click-return/ClickReturnProvider';
import { useWishlist } from './wishlist/WishlistProvider';
import { Icon } from './icons';

const CATEGORY_FALLBACK_MAP: Record<string, string> = {
  jeans: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80',
  shirts: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1000&q=80',
  't-shirts': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80',
  tracks: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=1000&q=80',
  footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80',
  watches: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
  trousers: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1000&q=80',
  shorts: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1000&q=80',
  jackets: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80',
  hoodies: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=80',
};
const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80';

export function ProductCard({ product }: { product: ProductCardData }) {
  const [hovered, setHovered] = useState(false);
  const [heartPopping, setHeartPopping] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
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

  // Compile full image list from gallery or primary/secondary fallbacks
  const images = useMemo(() => {
    if (product.gallery && product.gallery.length > 0) {
      return product.gallery;
    }
    const list: Array<{ url: string; isAiGenerated?: boolean; altText?: string | null }> = [];
    if (product.primaryImage) list.push(product.primaryImage);
    if (product.secondaryImage) list.push(product.secondaryImage);
    return list;
  }, [product]);

  const rawShown = images[activeImageIndex] ?? images[0] ?? product.primaryImage;
  const shownImage = fallbackUrl
    ? { url: fallbackUrl, altText: product.title, isAiGenerated: false }
    : rawShown;

  const prevSlide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const nextSlide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const selectSlide = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveImageIndex(idx);
  };

  const handleImageError = () => {
    if (activeImageIndex < images.length - 1) {
      setActiveImageIndex((prev) => prev + 1);
    } else if (!fallbackUrl) {
      const catSlug = product.category?.slug ?? '';
      const catImg = CATEGORY_FALLBACK_MAP[catSlug] ?? DEFAULT_FALLBACK_IMAGE;
      setFallbackUrl(catImg);
    } else {
      setImgError(true);
    }
  };

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
        {shownImage && !imgError ? (
          shownImage.url.startsWith('blob:') || shownImage.url.startsWith('data:') ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={shownImage.url}
              src={shownImage.url}
              alt={shownImage.altText ?? product.title}
              className="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.04]"
              onError={handleImageError}
            />
          ) : (
            <Image
              key={shownImage.url}
              src={shownImage.url}
              alt={shownImage.altText ?? product.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1080px) 33vw, 25vw"
              className="object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.04]"
              unoptimized
              onError={handleImageError}
            />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 p-4 text-center text-slate-400">
            <span className="text-3xl">🛍️</span>
            <span className="mt-1 text-[11px] font-medium text-slate-500">Image Preview</span>
          </div>
        )}

        {/* Prev/Next Slider Chevrons */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={prevSlide}
              className="absolute left-1.5 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-slate-950/40 text-white backdrop-blur-sm opacity-0 transition-opacity duration-200 hover:bg-slate-950/70 group-hover:opacity-100"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={nextSlide}
              className="absolute right-1.5 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-slate-950/40 text-white backdrop-blur-sm opacity-0 transition-opacity duration-200 hover:bg-slate-950/70 group-hover:opacity-100"
            >
              ›
            </button>

            {/* Slide dot indicators */}
            <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to slide ${idx + 1}`}
                  onClick={(e) => selectSlide(e, idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeImageIndex === idx
                      ? 'w-4 bg-white shadow-sm'
                      : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* AI-rendered disclosure badge */}
        {shownImage?.isAiGenerated && <AiBadge />}

        {/* Top-left badge stack: Featured (when active) */}
        {product.isFeatured && (
          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-44px)] flex-col items-start gap-1">
            <span className="inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950 shadow-sm">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
              </svg>
              Featured
            </span>
          </div>
        )}

        {/* Wishlist heart button */}
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
        {/* Amount visibility removed per Task 4 */}

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
  fullWidthOnMobile = false,
}: {
  href: string;
  retailer: string;
  retailerDisplayName?: string | null;
  size?: 'sm' | 'lg';
  trackingId?: string | null;
  productTitle?: string;
  fullWidthOnMobile?: boolean;
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
      className={`inline-flex items-center justify-center rounded-md bg-primary font-medium text-primary-fg transition hover:bg-primary-hover active:scale-[0.98] ${
        fullWidthOnMobile ? 'w-full sm:w-auto' : ''
      } ${
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

