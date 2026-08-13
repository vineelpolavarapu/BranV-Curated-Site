'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { HeroInitial } from './HeroInitial';
import { HERO_SLIDES, HERO_DESKTOP_BREAKPOINT } from './hero-data';

// Load only the carousel variant that matches the current viewport.
// Previously both carousels rendered simultaneously (one CSS-hidden) causing
// all 16 hero images to download on every device. Dynamic imports ensure
// only the active variant's 8 images load.
const HeroCarouselMobile = dynamic(
  () => import('./HeroCarouselMobile').then((m) => ({ default: m.HeroCarouselMobile })),
  { ssr: false },
);
const HeroCarouselDesktop = dynamic(
  () => import('./HeroCarouselDesktop').then((m) => ({ default: m.HeroCarouselDesktop })),
  { ssr: false },
);

// Crossfade duration between the SSR hero and the hydrated carousel.
const HANDOFF_MS = 500;
// Small grace period after the carousel mounts so its first image begins
// painting before we start fading the SSR hero out.
const CAROUSEL_SETTLE_MS = 80;

export function HeroCarousel() {
  // null while the viewport hasn't been measured (SSR + first paint). While
  // null we show HeroInitial — the server-rendered first banner — so a real
  // image is visible instantly instead of a blank gradient.
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  // Flips on once the interactive carousel has mounted + had a moment to paint
  // its first image. Triggers the crossfade (carousel in, SSR hero out).
  const [carouselReady, setCarouselReady] = useState(false);
  // Flips on after the crossfade completes so the SSR hero unmounts and only
  // one full-screen image stack remains in the DOM.
  const [handoffDone, setHandoffDone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${HERO_DESKTOP_BREAKPOINT}px)`);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Once the viewport is known, mount the carousel and (after a brief settle)
  // begin the crossfade.
  useEffect(() => {
    if (isDesktop === null) return;
    const t = setTimeout(() => setCarouselReady(true), CAROUSEL_SETTLE_MS);
    return () => clearTimeout(t);
  }, [isDesktop]);

  // After the crossfade finishes, drop the SSR hero.
  useEffect(() => {
    if (!carouselReady || handoffDone) return;
    const t = setTimeout(() => setHandoffDone(true), HANDOFF_MS);
    return () => clearTimeout(t);
  }, [carouselReady, handoffDone]);

  const showInitial = isDesktop === null || !handoffDone;

  return (
    <div className="relative h-[100svh] min-h-[480px] w-full overflow-hidden bg-slate-950">
      {/* SSR hero — the instant first banner. Stays as the base layer while the
          interactive carousel fades in on top, then unmounts. */}
      {showInitial && (
        <div
          aria-hidden={isDesktop !== null}
          className={`absolute inset-0 transition-opacity duration-500 ease-out ${
            carouselReady ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <HeroInitial slide={HERO_SLIDES[0]} />
        </div>
      )}

      {/* Interactive carousel — hydrated client-side, faded in over the SSR
          hero for a seamless handoff. */}
      {isDesktop !== null && (
        <div
          className={`absolute inset-0 transition-opacity duration-500 ease-out ${
            carouselReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {isDesktop ? <HeroCarouselDesktop /> : <HeroCarouselMobile />}
        </div>
      )}
    </div>
  );
}