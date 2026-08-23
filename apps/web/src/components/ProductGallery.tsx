'use client';

import Image from 'next/image';
import { useState, useMemo } from 'react';
import { ProductCardData } from '@/lib/storefront-types';

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

export function ProductGallery({ product }: { product: ProductCardData }) {
  const images = useMemo(() => {
    if (product.gallery && product.gallery.length > 0) return product.gallery;
    const list: Array<{ url: string; isAiGenerated?: boolean; altText?: string | null }> = [];
    if (product.primaryImage) list.push(product.primaryImage);
    if (product.secondaryImage) list.push(product.secondaryImage);
    return list;
  }, [product]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const rawHero = images[activeIndex] ?? images[0] ?? product.primaryImage;
  const hero = fallbackUrl
    ? { url: fallbackUrl, altText: product.title, isAiGenerated: false }
    : rawHero;

  const prevSlide = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const nextSlide = () => {
    setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const minSwipeDistance = 40;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }
  };

  const handleImageError = () => {
    if (activeIndex < images.length - 1) {
      setActiveIndex((prev) => prev + 1);
    } else if (!fallbackUrl) {
      const catSlug = product.category?.slug ?? '';
      const catImg = CATEGORY_FALLBACK_MAP[catSlug] ?? DEFAULT_FALLBACK_IMAGE;
      setFallbackUrl(catImg);
    } else {
      setHasError(true);
    }
  };

  return (
    <div className="w-full min-w-0">
      {/* Main Slider Display */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bv-enter-fade relative aspect-[4/5] w-full min-w-0 overflow-hidden rounded-2xl bg-surface-muted group border border-line shadow-sm touch-pan-y select-none"
      >
        {hero && 'url' in hero && !hasError ? (
          <>
            {hero.url.startsWith('blob:') || hero.url.startsWith('data:') ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={hero.url}
                src={hero.url}
                alt={hero.altText ?? product.title}
                className="absolute inset-0 h-full w-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
                onClick={() => setLightboxOpen(true)}
                onError={handleImageError}
              />
            ) : (
              <Image
                key={hero.url}
                src={hero.url}
                alt={hero.altText ?? product.title}
                fill
                sizes="(max-width: 1023px) 100vw, 50vw"
                className="object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
                unoptimized
                priority
                onClick={() => setLightboxOpen(true)}
                onError={handleImageError}
              />
            )}

            {/* Slider Counter Badge */}
            {images.length > 1 && (
              <span className="absolute top-3 left-3 rounded-full bg-slate-950/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md shadow-sm">
                {activeIndex + 1} / {images.length}
              </span>
            )}

            {/* AI-rendered disclosure badge */}
            {hero.isAiGenerated && (
              <span
                title="AI-rendered on avatar model"
                className="absolute bottom-3 right-3 rounded-md bg-purple-900/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur shadow-sm"
              >
                AI-rendered
              </span>
            )}

            {/* Next / Prev Slider Controls */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous product image"
                  onClick={prevSlide}
                  className="absolute left-2.5 sm:left-3 top-1/2 z-10 grid h-9 w-9 sm:h-10 sm:w-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-slate-800 shadow-md backdrop-blur transition-all duration-200 hover:bg-white hover:scale-110 active:scale-95"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next product image"
                  onClick={nextSlide}
                  className="absolute right-2.5 sm:right-3 top-1/2 z-10 grid h-9 w-9 sm:h-10 sm:w-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-slate-800 shadow-md backdrop-blur transition-all duration-200 hover:bg-white hover:scale-110 active:scale-95"
                >
                  ›
                </button>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 p-8 text-center text-slate-400">
            <span className="text-4xl">📸</span>
            <span className="mt-2 text-xs font-semibold text-slate-500">Image Preview</span>
          </div>
        )}
      </div>

      {/* Thumbnail Strip Slider */}
      {images.length > 1 && (
        <ul className="mt-3 sm:mt-4 flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-1 scrollbar-thin min-w-0 w-full">
          {images.map((img, idx) => (
            <li key={img.url + idx} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative h-16 w-14 sm:h-20 sm:w-16 overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                  activeIndex === idx
                    ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-sm'
                    : 'border-transparent opacity-70 hover:opacity-100 hover:border-slate-300'
                }`}
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? `${product.title} thumbnail ${idx + 1}`}
                  fill
                  sizes="64px"
                  unoptimized
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Fullscreen Lightbox Zoom Modal */}
      {lightboxOpen && hero && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md animate-fadeIn">
          <button
            type="button"
            aria-label="Close zoom modal"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-50 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-xl font-bold text-white hover:bg-white/40"
          >
            ✕
          </button>
          <div className="relative aspect-[4/5] max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl">
            <Image
              src={hero.url}
              alt={hero.altText ?? product.title}
              fill
              unoptimized
              className="object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevSlide}
                  className="absolute left-4 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/40"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  className="absolute right-4 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/40"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
