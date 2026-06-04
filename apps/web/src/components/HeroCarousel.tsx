'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type HeroSlide = {
  key: string;
  imageUrl: string;
  /** Optional portrait-orientation variant for < md viewports.
   *  Falls back to imageUrl when absent. Drop files next to their desktop
   *  siblings in /hero, e.g. footwear.png → footwear-mobile.png. */
  mobileImageUrl?: string;
  eyebrow?: string;
  headline: string;
  subtext?: string;
  ctaLabel: string;
  ctaHref: string;
};

// Placeholder slides — swap imageUrl / ctaHref later as real category
// collections come online. Unsplash photo IDs are stable.
const SLIDES: HeroSlide[] = [
  {
    key: 'formals',
    imageUrl:
      '/hero/formals.svg',
    eyebrow: 'Workwear',
    headline: 'Sharp Formals',
    subtext: 'Tailored shirts and trousers for the office and beyond.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'footwear',
    imageUrl:
      '/hero/footwear.png',
    eyebrow: 'Step Out',
    headline: 'Footwear',
    subtext: 'Sneakers, loafers, boots, and formal shoes for every occasion.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/category/footwear',
  },
  {
    key: 'trendy',
    imageUrl:
      '/hero/trendy.svg',
    eyebrow: 'This Season',
    headline: 'Trendy Wear',
    subtext: 'The pieces everyone is reaching for right now.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'fashion',
    imageUrl:
      '/hero/fashion.svg',
    eyebrow: 'Statement',
    headline: 'Fashion Forward',
    subtext: 'Bold cuts, brave colours, conversation-starting silhouettes.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'classic',
    imageUrl:
      '/hero/classic.svg',
    eyebrow: 'Timeless',
    headline: 'Classic Essentials',
    subtext: 'The wardrobe staples that never go out of style.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'casual',
    imageUrl:
      '/hero/casual.svg',
    eyebrow: 'Off Duty',
    headline: 'Easy Casuals',
    subtext: 'Weekend-ready tees, joggers, and overshirts.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
  {
    key: 'accessories',
    imageUrl:
      '/hero/accessories.svg',
    eyebrow: 'Finishing Touch',
    headline: 'Accessories',
    subtext: 'Watches, belts, bags — the details that complete a look.',
    ctaLabel: 'Explore Collection',
    ctaHref: '#',
  },
];

const ROTATE_MS = 3000;
const TRANSITION_MS = 700;

// Track layout: [clone-of-last, ...SLIDES, clone-of-first]. trackIndex moves
// 1..total over real slides; landing on 0 or total+1 (a clone) triggers an
// instant, transition-less snap to the equivalent real slide, producing a
// seamless infinite loop in both directions.
export function HeroCarousel() {
  const total = SLIDES.length;
  const trackSlides = [SLIDES[total - 1], ...SLIDES, SLIDES[0]];

  const [trackIndex, setTrackIndex] = useState(1);
  const [withTransition, setWithTransition] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  // Pixels of horizontal drag in progress. Added to the translate3d so the
  // track visually follows the cursor / finger in real time. Reset to 0 on
  // release once the new trackIndex has been committed (or the snap-back
  // animation has been kicked off).
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchMoved = useRef(false);
  const pointerStartX = useRef<number | null>(null);
  const pointerMoved = useRef(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // 5px movement before we consider it a drag — keeps the CTA "Explore Collection"
  // button reliably clickable (taps with <5px drift still register as clicks).
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
    // Pause auto-rotate while the user is actively dragging; resume on release.
    if (isDragging) return;
    // Guard against tab-switch catchup: browsers throttle setInterval in background
    // tabs, then fire all queued ticks at once when the tab regains focus. Skipping
    // advances while the document is hidden prevents the carousel from jumping
    // multiple slides at once on return.
    const id = window.setInterval(() => {
      if (!document.hidden) next();
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [next, isDragging]);

  // When the tab becomes visible again, bump imgKey to force React to remount the
  // active slide's <Image> element. This rebuilds the GPU compositor layer that
  // the browser discards for background tabs, preventing the blank-image bug.
  const [imgKey, setImgKey] = useState(0);
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) setImgKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // After landing on a clone, snap back to the matching real slide without animation.
  // Filter to the track's own transform transition so bubbling child transitions
  // (e.g. CTA hover) don't trigger a spurious snap.
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

  // Re-enable transitions on the next frame after a snap so subsequent moves animate.
  useEffect(() => {
    if (withTransition) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setWithTransition(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [withTransition]);


  // On release: commit to the adjacent slide in the drag direction and
  // animate from the current dragged position to the target slide.
  const finishDrag = (dx: number) => {
    setWithTransition(true);
    if (dx < 0) next();
    else if (dx > 0) prev();
    setDragOffsetX(0);
    setIsDragging(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchMoved.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!touchMoved.current) {
      touchMoved.current = true;
      setIsDragging(true);
      setWithTransition(false);
    }
    setDragOffsetX(dx);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      finishDrag(dx);
    } else {
      setIsDragging(false);
    }
    touchMoved.current = false;
  };

  // Mouse drag for desktop — pointer events so we still get release notifications
  // even if the cursor leaves the carousel mid-drag.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return; // touch is handled by onTouch* above
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
      // Capture so we keep getting move/up events even if the cursor leaves.
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
      // Swallow the click that would otherwise fire on whatever element we
      // released over (so a drag doesn't accidentally navigate via the CTA).
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
      // `hero-grab` (defined in globals.css) swaps the cursor via the CSS
      // :active pseudo-class — open hand on hover, closed fist on mouse-down.
      className="hero-grab relative h-svh min-h-[560px] w-full select-none overflow-hidden bg-neutral-900 md:h-screen"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
    >
      <div
        ref={trackRef}
        className="flex h-full w-full"
        style={{
          // calc() combines the index-driven percentage offset with the
          // pixel-based drag offset so the track follows the cursor in real
          // time during a drag and lands precisely on a slide otherwise.
          transform: `translate3d(calc(${-trackIndex * 100}% + ${dragOffsetX}px), 0, 0)`,
          transition: withTransition
            ? `transform ${TRANSITION_MS}ms ease-out`
            : 'none',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {trackSlides.map((slide, i) => {
          const isClone = i === 0 || i === trackSlides.length - 1;
          const isActive = !isClone && i - 1 === realIndex;
          return (
            <div
              key={`${slide.key}-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i} of ${total}: ${slide.headline}`}
              aria-hidden={isClone || i - 1 !== realIndex}
              className="relative h-full w-full shrink-0 overflow-hidden"
            >
              {/* Ken Burns — slow infinite scale on the background image.
                  key includes imgKey so the active slide's Image remounts when
                  the tab regains focus, rebuilding any evicted GPU layer.

                  Art direction via two <Image>s — Next/Image doesn't support
                  <picture> natively. Mobile variant is shown < md, desktop
                  variant from md+. Mobile falls back to desktop URL when no
                  portrait asset exists for the slide. */}
              <Image
                src={slide.imageUrl}
                alt={slide.headline}
                fill
                key={isActive ? `${slide.key}-active-${imgKey}-d` : `${slide.key}-d`}
                {...(i === 1
                  ? { priority: true }
                  : { loading: 'eager' as const })}
                unoptimized
                draggable={false}
                sizes="100vw"
                className={`hidden select-none object-cover md:block ${isActive ? 'bv-kenburns-img' : ''}`}
              />
              <Image
                src={slide.mobileImageUrl ?? slide.imageUrl}
                alt={slide.headline}
                fill
                key={isActive ? `${slide.key}-active-${imgKey}-m` : `${slide.key}-m`}
                {...(i === 1
                  ? { priority: true }
                  : { loading: 'eager' as const })}
                unoptimized
                draggable={false}
                sizes="100vw"
                className={`select-none object-cover md:hidden ${isActive ? 'bv-kenburns-img' : ''}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 px-6 pb-24 md:px-16 md:pb-28">
                <div className="max-w-2xl text-white">
                  <div className={`hero-slide-text ${isActive ? 'hero-slide-active' : ''}`}>
                    {slide.eyebrow && (
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] opacity-90">
                        {slide.eyebrow}
                      </p>
                    )}
                    <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-6xl">
                      {slide.headline}
                    </h2>
                    {slide.subtext && (
                      <p className="mt-4 max-w-lg text-base leading-relaxed opacity-90 md:text-lg">
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
            </div>
          );
        })}
      </div>

<div
        role="tablist"
        aria-label="Select slide"
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 md:left-auto md:right-12 md:translate-x-0"
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
