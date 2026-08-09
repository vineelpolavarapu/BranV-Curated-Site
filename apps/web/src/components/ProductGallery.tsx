'use client';

import Image from 'next/image';
import { useState, useMemo } from 'react';
import { ProductCardData } from '@/lib/storefront-types';

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

  const hero = images[activeIndex] ?? images[0] ?? product.primaryImage;

  const prevSlide = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const nextSlide = () => {
    setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div>
      {/* Main Slider Display */}
      <div className="bv-enter-fade relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-surface-muted group border border-line shadow-sm">
        {hero && 'url' in hero ? (
          <>
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
            />

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
                  className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-slate-800 shadow-md backdrop-blur transition-all duration-200 hover:bg-white hover:scale-110 active:scale-95"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next product image"
                  onClick={nextSlide}
                  className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-slate-800 shadow-md backdrop-blur transition-all duration-200 hover:bg-white hover:scale-110 active:scale-95"
                >
                  ›
                </button>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-content-muted">
            no image
          </div>
        )}
      </div>

      {/* Thumbnail Strip Slider */}
      {images.length > 1 && (
        <ul className="mt-4 flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {images.map((img, idx) => (
            <li key={img.url + idx} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative h-20 w-16 overflow-hidden rounded-xl border-2 transition-all duration-200 ${
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
