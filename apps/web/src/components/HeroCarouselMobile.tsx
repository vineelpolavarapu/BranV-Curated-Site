'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

// Mobile-only hero carousel. Renders at <768px (parent gates via `md:hidden`).
// All image references point at /mobile-hero/mobile_*.svg — 9:16 portrait art.
// This component has NO knowledge of /hero/ or desktop layout. Changing
// the 768px breakpoint or desktop visuals will not affect this file.

type HeroSlide = {
  key: string;
  imageUrl: string;
  eyebrow?: string;
  headline: string;
  subtext?: string;
  ctaLabel: string;
  ctaHref: string;
};

const SLIDES: HeroSlide[] = [
  {
    key: 'formals',
    imageUrl: '/mobile-hero/mobile_formals.png',
    eyebrow: 'Workwear',
    headline: 'Sharp Formals',
    subtext: 'Tailored shirts and trousers for the office and beyond.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'classic',
    imageUrl: '/mobile-hero/mobile_classic.png',
    eyebrow: 'Timeless',
    headline: 'Classic Essentials',
    subtext: 'The wardrobe staples that never go out of style.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'trendy',
    imageUrl: '/mobile-hero/latest_trends.png',
    eyebrow: 'This Season',
    headline: 'Trendy Wear',
    subtext: 'The pieces everyone is reaching for right now.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'suits',
    imageUrl: '/mobile-hero/mobile_sports.png',
    eyebrow: 'Occasion',
    headline: 'Sports Wear',
    subtext: 'Two-piece, three-piece, and tuxedos for every milestone.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'fashion',
    imageUrl: '/mobile-hero/mobile_fashion.png',
    eyebrow: 'Statement',
    headline: 'Fashion Forward',
    subtext: 'Bold cuts, brave colours, conversation-starting silhouettes.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'casual',
    imageUrl: '/mobile-hero/mobile_casual.png',
    eyebrow: 'Off Duty',
    headline: 'Easy Casuals',
    subtext: 'Weekend-ready tees, joggers, and overshirts.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'footwear',
    imageUrl: '/mobile-hero/mobile_footwear.png',
    eyebrow: 'On Your Feet',
    headline: 'Footwear',
    subtext: 'Sneakers, loafers, boots — the foundation of every outfit.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/category/footwear',
  },
  {
    key: 'watches',
    imageUrl: '/mobile-hero/mobile_watches.png',
    eyebrow: 'Finishing Touch',
    headline: 'Watches',
    subtext: 'Watches, belts, bags — the details that complete a look.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
];

const ROTATE_MS = 3000;
const TRANSITION_MS = 700;

export function HeroCarouselMobile() {
  const total = SLIDES.length;
  const trackSlides = [SLIDES[total - 1], ...SLIDES, SLIDES[0]];

  const [trackIndex, setTrackIndex] = useState(1);
  const [withTransition, setWithTransition] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const pointerStartX = useRef<number | null>(null);
  const pointerMoved = useRef(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const DRAG_THRESHOLD = 5;

  const realIndex = ((trackIndex - 1) % total + total) % total;

  const next = useCallback(() => {
    setWithTransition(true);
    setTrackIndex((i) => i + 1);
  }, []);

  const prev = useCallback(() => {
    setWithTransition(true);
    setTrackIndex((i) => i - 1);
  }, []);

  const goTo = useCallback((i: number) => {
    setWithTransition(true);
    setTrackIndex(i + 1);
  }, []);

  useEffect(() => {
    if (isDragging) return;
    const id = window.setInterval(() => next(), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [next, isDragging]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current) return;
    if (e.propertyName !== 'transform') return;
    if (trackIndex === total + 1) {
      setWithTransition(false);
      setTrackIndex(1);
    } else if (trackIndex === 0) {
      setWithTransition(false);
      setTrackIndex(total);
    }
  };

  useEffect(() => {
    if (withTransition) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setWithTransition(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [withTransition]);

  const finishDrag = (dx: number) => {
    setWithTransition(true);
    if (dx < 0) next();
    else if (dx > 0) prev();
    setDragOffsetX(0);
    setIsDragging(false);
  };

  // Unified pointer handlers — fire for touch, mouse, AND pen, so swipe works
  // on real phones and in Chrome DevTools device emulation (which sends mouse
  // events, not touch). No pointerType filter: we accept whatever the user has.
  const onPointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
    pointerMoved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerStartX.current == null) return;
    const dx = e.clientX - pointerStartX.current;
    if (Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!pointerMoved.current) {
      pointerMoved.current = true;
      setIsDragging(true);
      setWithTransition(false);
      // Capture so we keep getting move/up events even if the finger slides
      // off the section bounds mid-swipe.
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    setDragOffsetX(dx);
  };
  const endPointerDrag = (e: React.PointerEvent) => {
    if (pointerStartX.current == null) return;
    const dx = e.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (pointerMoved.current) {
      // Swallow the synthetic click so a swipe doesn't accidentally trigger
      // the CTA link underneath the finger.
      e.preventDefault();
      finishDrag(dx);
    } else {
      setIsDragging(false);
    }
    pointerMoved.current = false;
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      // 9:16 aspect locks the section to the portrait art so object-cover
      // (below) cannot crop. max-h-screen prevents overflow on landscape
      // phones where 100vw × 16/9 would exceed the viewport.
      // touch-pan-y tells the browser: vertical scroll is yours, horizontal
      // drag is mine. Without it, the browser may swallow horizontal pointer
      // moves to interpret as a page scroll, and onPointerMove never fires.
      className="relative aspect-[9/16] max-h-[80vh] w-full touch-pan-y select-none overflow-hidden bg-neutral-900"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
    >
      <div
        ref={trackRef}
        className="flex h-full w-full"
        style={{
          transform: `translate3d(calc(${-trackIndex * 100}% + ${dragOffsetX}px), 0, 0)`,
          transition: withTransition
            ? `transform ${TRANSITION_MS}ms ease-out`
            : 'none',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {trackSlides.map((slide, i) => {
          const isClone = i === 0 || i === trackSlides.length - 1;
          return (
            <div
              key={`${slide.key}-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i} of ${total}: ${slide.headline}`}
              aria-hidden={isClone || i - 1 !== realIndex}
              className="relative h-full w-full shrink-0 overflow-hidden"
            >
              {/* Direct <img> — no <picture> swap. The portrait SVG matches
                  the 9:16 section exactly so object-cover is safe (no crop).
                  Switch to object-contain if you ever ship art that isn't
                  exactly 9:16. */}
              <img
                src={slide.imageUrl}
                alt={slide.headline}
                draggable={false}
                loading="eager"
                fetchPriority={i === 1 ? 'high' : 'auto'}
                className={`absolute inset-0 h-full w-full select-none object-cover${slide.key === 'fashion' ? ' scale-[1.15] object-[center_110%]' : ''}${slide.key === 'classic' ? ' scale-[1.25] object-[center_115%]' : ''}`}
              />
              <div className="absolute inset-x-0 bottom-0 px-5 pb-16">
                <div className="text-white">
                  {slide.eyebrow && (
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] opacity-90">
                      {slide.eyebrow}
                    </p>
                  )}
                  <h2 className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
                    {slide.headline}
                  </h2>
                  {slide.subtext && (
                    <p className="mt-3 text-sm leading-relaxed opacity-90 md:text-base md:max-w-lg">
                      {slide.subtext}
                    </p>
                  )}
                  <Link
                    href={slide.ctaHref}
                    tabIndex={isClone ? -1 : 0}
                    className="mt-6 inline-flex items-center justify-center rounded-full border border-white px-6 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-neutral-900"
                  >
                    {slide.ctaLabel}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        role="tablist"
        aria-label="Select slide"
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2"
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={i === realIndex}
            aria-label={`Show slide ${i + 1}: ${s.headline}`}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === realIndex ? 'w-8 bg-white' : 'w-4 bg-white/40'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
