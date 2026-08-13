'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHeroSlideMemory } from './useHeroSlideMemory';

// Desktop-only hero carousel. Renders at >=1080px (parent gates via matchMedia).
// All image references point at /hero/ (landscape art).
// Mobile lives in HeroCarouselMobile.tsx - keep them physically separate so
// neither component has to deal with the other's image set or layout rules.

type HeroSlide = {
  key: string;
  imageUrl: string;
  headline: string;
  subtext?: string;
  ctaLabel: string;
  ctaHref: string;
};

const BASE_SLIDES: HeroSlide[] = [
  {
    key: 'formals',
    imageUrl: '/hero/formals1.webp',

    headline: 'Sharp Formals',
    subtext: 'Tailored shirts and trousers for the office and beyond.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/sharp-formals',
  },
  {
    key: 'classic',
    imageUrl: '/hero/easy_causal.webp',

    headline: 'Classic Essentials',
    subtext: 'The wardrobe staples that never go out of style.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/classic-essentials',
  },
  {
    key: 'trendy',
    imageUrl: '/hero/latest_web.webp',

    headline: 'Trendy Wear',
    subtext: 'The pieces everyone is reaching for right now.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/trendy-wear',
  },
  {
    key: 'sportswear',
    imageUrl: '/hero/sports.webp',

    headline: 'Sports Wear',
    subtext: 'Performance fits built for the gym, the run, and everything after.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/sports-wear',
  },
  {
    key: 'fashion',
    imageUrl: '/hero/fashoin.webp',

    headline: 'Fashion Forward',
    subtext: 'Bold cuts, brave colours, conversation-starting silhouettes.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/fashion-forward',
  },
  {
    key: 'casual',
    imageUrl: '/hero/casual2.webp',
    headline: 'Easy Casuals',
    subtext: 'Weekend-ready tees, joggers, and overshirts.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/easy-casuals',
  },
  {
    key: 'footwear',
    imageUrl: '/hero/footwear.webp',
    headline: 'Footwear',
    subtext: 'Sneakers, loafers, boots, the foundation of every outfit.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/category/footwear',
  },
  {
    key: 'watches',
    imageUrl: '/hero/watches.webp',
    headline: 'Watches',
    subtext: 'Watches, belts, bags, the details that complete a look.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/category/watches',
  },
];

const ROTATE_MS = 3000;
const TRANSITION_MS = 700;

export function HeroCarouselDesktop() {
  const SLIDES = BASE_SLIDES;
  const total = SLIDES.length;
  const trackSlides = [SLIDES[total - 1], ...SLIDES, SLIDES[0]];

  const { trackIndex, setTrackIndex, withTransition, setWithTransition } =
    useHeroSlideMemory(total);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const pointerStartX = useRef<number | null>(null);
  const pointerMoved = useRef(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const DRAG_THRESHOLD = 5;

  const realIndex = ((trackIndex - 1) % total + total) % total;

  const next = useCallback(() => {
    setTrackIndex((i) => {
      if (i > total) return i;
      setWithTransition(true);
      return i + 1;
    });
  }, [total]);

  const prev = useCallback(() => {
    setTrackIndex((i) => {
      if (i < 1) return i;
      setWithTransition(true);
      return i - 1;
    });
  }, []);

  const goTo = useCallback((i: number) => {
    setWithTransition(true);
    setTrackIndex(i + 1);
  }, []);

  useEffect(() => {
    if (isDragging) return;
    
    let intervalId: number | null = null;

    const startInterval = () => {
      if (!intervalId) {
        intervalId = window.setInterval(() => next(), ROTATE_MS);
      }
    };

    const stopInterval = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        setTrackIndex((current) => {
          if (current > total + 1 || current < 0) {
            setWithTransition(false);
            const correctedRealIndex = ((current - 1) % total + total) % total;
            return correctedRealIndex + 1;
          }
          return current;
        });
        startInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    if (!document.hidden) {
      startInterval();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopInterval();
    };
  }, [next, isDragging, total]);

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
      className="hero-grab relative h-[100svh] min-h-[560px] w-full select-none overflow-hidden bg-slate-950"
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
              <div className="absolute inset-x-0 bottom-0 px-12 lg:px-20 pb-24 lg:pb-28">
                <div className={`max-w-3xl text-white hero-slide-text drop-shadow-md ${
                  i - 1 === realIndex ? 'hero-slide-active' : ''
                }`}>
                  <h2 className="font-heading text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]">
                    {slide.headline}
                  </h2>
                  {slide.subtext && (
                    <p className="mt-4 max-w-xl text-lg lg:text-xl font-normal leading-relaxed text-slate-200">
                      {slide.subtext}
                    </p>
                  )}
                  <div className="mt-8">
                    <Link
                      href={slide.ctaHref}
                      tabIndex={isClone ? -1 : 0}
                      className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-extrabold uppercase tracking-[0.18em] text-primary shadow-xl transition-all duration-300 hover:bg-primary hover:text-white hover:scale-105 active:scale-95"
                    >
                      {slide.ctaLabel}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        role="tablist"
        aria-label="Select slide"
        className="absolute bottom-10 right-16 flex items-center gap-2.5 z-20"
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={i === realIndex}
            aria-label={`Show slide ${i + 1}: ${s.headline}`}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === realIndex ? 'w-10 bg-white shadow-sm' : 'w-3 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
