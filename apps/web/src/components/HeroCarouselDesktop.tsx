'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

// Desktop-only hero carousel. Renders at >=768px (parent gates via
// `hidden md:block`). All image references point at /hero/ (landscape art).
// Mobile lives in HeroCarouselMobile.tsx — keep them physically separate so
// neither component has to deal with the other's image set or layout rules.

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
    imageUrl: '/hero/formals1.png',
    eyebrow: 'Workwear',
    headline: 'Sharp Formals',
    subtext: 'Tailored shirts and trousers for the office and beyond.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'classic',
    imageUrl: '/hero/easy_causal.png',
    eyebrow: 'Timeless',
    headline: 'Classic Essentials',
    subtext: 'The wardrobe staples that never go out of style.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'trendy',
    imageUrl: '/hero/latest_web.png',
    eyebrow: 'This Season',
    headline: 'Trendy Wear',
    subtext: 'The pieces everyone is reaching for right now.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'suits',
    imageUrl: '/hero/suits.svg',
    eyebrow: 'Occasion',
    headline: 'Sports Wear',
    subtext: 'Two-piece, three-piece, and tuxedos for every milestone.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'fashion',
    imageUrl: '/hero/fashoin.png',
    eyebrow: 'Statement',
    headline: 'Fashion Forward',
    subtext: 'Bold cuts, brave colours, conversation-starting silhouettes.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'casual',
    imageUrl: '/hero/casual2.png',
    eyebrow: 'Off Duty',
    headline: 'Easy Casuals',
    subtext: 'Weekend-ready tees, joggers, and overshirts.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'footwear',
    imageUrl: '/hero/footwear.png',
    eyebrow: 'On Your Feet',
    headline: 'Footwear',
    subtext: 'Sneakers, loafers, boots — the foundation of every outfit.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/category/footwear',
  },
  {
    key: 'watches',
    imageUrl: '/hero/watches.png',
    eyebrow: 'Finishing Touch',
    headline: 'Watches',
    subtext: 'Watches, belts, bags — the details that complete a look.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/category/watches',
  },
];

const ROTATE_MS = 3000;
const TRANSITION_MS = 700;

export function HeroCarouselDesktop() {
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

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pointerStartX.current = e.clientX;
    pointerMoved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (pointerStartX.current == null) return;
    const dx = e.clientX - pointerStartX.current;
    if (Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!pointerMoved.current) {
      pointerMoved.current = true;
      setIsDragging(true);
      setWithTransition(false);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    setDragOffsetX(dx);
  };
  const endPointerDrag = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (pointerStartX.current == null) return;
    const dx = e.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (pointerMoved.current) {
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
      className="hero-grab relative h-screen min-h-[560px] w-full select-none overflow-hidden bg-neutral-900"
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
              className="relative h-full w-full shrink-0"
            >
              <img
                src={slide.imageUrl}
                alt={slide.headline}
                draggable={false}
                loading="eager"
                fetchPriority={i === 1 ? 'high' : 'auto'}
                className="absolute inset-0 h-full w-full select-none object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 px-16 pb-28">
                <div className="max-w-2xl text-white">
                  {slide.eyebrow && (
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] opacity-90">
                      {slide.eyebrow}
                    </p>
                  )}
                  <h2 className="text-6xl font-semibold tracking-tight">
                    {slide.headline}
                  </h2>
                  {slide.subtext && (
                    <p className="mt-4 max-w-lg text-lg leading-relaxed opacity-90">
                      {slide.subtext}
                    </p>
                  )}
                  <Link
                    href={slide.ctaHref}
                    tabIndex={isClone ? -1 : 0}
                    className="mt-8 inline-flex items-center justify-center rounded-full border border-white px-8 py-3 text-sm font-medium uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-neutral-900"
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
        className="absolute bottom-8 right-12 flex items-center gap-2"
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
              i === realIndex ? 'w-10 bg-white' : 'w-5 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
