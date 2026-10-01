'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { apiImageProxyUrl } from '@/lib/api';

export interface AdminImageLightboxModalProps {
  open: boolean;
  initialIndex: number;
  images: string[];
  blobPreviews?: Record<string, string>;
  isPrimary?: (url: string) => boolean;
  onSetPrimary?: (url: string) => void;
  onClose: () => void;
}

export function AdminImageLightboxModal({
  open,
  initialIndex,
  images,
  blobPreviews,
  isPrimary,
  onSetPrimary,
  onClose,
}: AdminImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
    }
  }, [open, initialIndex, images.length]);

  const prev = useCallback(() => {
    setCurrentIndex((idx) => (idx > 0 ? idx - 1 : images.length - 1));
  }, [images.length]);

  const next = useCallback(() => {
    setCurrentIndex((idx) => (idx < images.length - 1 ? idx + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        prev();
      } else if (e.key === 'ArrowRight') {
        next();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, prev, next]);

  if (!open || images.length === 0) return null;

  const currentRawUrl = images[currentIndex] || '';
  const currentBlobUrl = blobPreviews?.[currentRawUrl];
  const displayUrl = currentBlobUrl || currentRawUrl;
  const isBlob = displayUrl.startsWith('blob:');
  const isRemote = /^https?:\/\//i.test(displayUrl);
  const isOurs = displayUrl.includes('.r2.dev') || displayUrl.includes('r2.cloudflarestorage');
  const renderSrc = isRemote && !isOurs && !isBlob ? apiImageProxyUrl(displayUrl) : displayUrl;
  const currentIsPrimary = isPrimary ? isPrimary(currentRawUrl) : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview Modal"
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-black/92 backdrop-blur-md p-4 sm:p-6 text-white select-none animate-fadeIn"
      onClick={onClose}
    >
      {/* Top Controls Header */}
      <div
        className="flex items-center justify-between w-full max-w-6xl mx-auto z-10 shrink-0 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {/* Index Pill */}
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md text-white shadow-sm border border-white/10">
            Image {currentIndex + 1} of {images.length}
          </span>

          {/* Primary Badge or Action Button */}
          {isPrimary && (
            currentIsPrimary ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-md">
                ★ PRIMARY IMAGE
              </span>
            ) : onSetPrimary ? (
              <button
                type="button"
                onClick={() => onSetPrimary(currentRawUrl)}
                className="inline-flex items-center gap-1 rounded-full bg-white/20 hover:bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition shadow-sm border border-white/15"
              >
                ⭐ Set as Primary
              </button>
            ) : null
          )}
        </div>

        {/* Close Button Pill */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image popup"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white font-bold transition shadow-md"
        >
          ✕
        </button>
      </div>

      {/* Main Full Image Viewport */}
      <div
        className="relative flex-1 flex items-center justify-center w-full max-w-5xl mx-auto overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Previous image"
            className="absolute left-2 sm:left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-white text-white hover:text-black transition shadow-xl border border-white/20 text-2xl font-bold"
          >
            ‹
          </button>
        )}

        {/* Uncropped Complete Image */}
        <div className="relative max-h-[70vh] max-w-full flex items-center justify-center">
          {isBlob ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={renderSrc}
              alt={`Product preview ${currentIndex + 1}`}
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
            />
          ) : (
            <div className="relative h-[70vh] w-[80vw] max-w-4xl">
              <Image
                src={renderSrc}
                alt={`Product preview ${currentIndex + 1}`}
                fill
                unoptimized
                className="object-contain rounded-xl shadow-2xl"
              />
            </div>
          )}
        </div>

        {/* Next Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Next image"
            className="absolute right-2 sm:right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-white text-white hover:text-black transition shadow-xl border border-white/20 text-2xl font-bold"
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip / Piles */}
      {images.length > 1 && (
        <div
          className="flex items-center justify-center gap-2.5 overflow-x-auto py-2 px-4 max-w-4xl mx-auto z-10 shrink-0 scrollbar-thin"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((imgUrl, idx) => {
            const thumbBlob = blobPreviews?.[imgUrl];
            const thumbDisplay = thumbBlob || imgUrl;
            const thumbBlobFlag = thumbDisplay.startsWith('blob:');
            const thumbRemote = /^https?:\/\//i.test(thumbDisplay);
            const thumbOurs = thumbDisplay.includes('.r2.dev') || thumbDisplay.includes('r2.cloudflarestorage');
            const thumbSrc = thumbRemote && !thumbOurs && !thumbBlobFlag ? apiImageProxyUrl(thumbDisplay) : thumbDisplay;
            const isActive = idx === currentIndex;

            return (
              <button
                key={imgUrl + idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`group relative h-16 w-14 sm:h-20 sm:w-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-blue-500 ring-2 ring-blue-400 scale-105 shadow-xl'
                    : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/50'
                }`}
              >
                {thumbBlobFlag ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbSrc}
                    alt={`Thumbnail ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={thumbSrc}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                )}
                {isPrimary && isPrimary(imgUrl) && (
                  <span className="absolute top-1 left-1 rounded bg-blue-600 px-1 text-[8px] font-bold text-white shadow">
                    ★
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
