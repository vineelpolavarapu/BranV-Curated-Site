'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

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

export function HeroCarousel() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Skeleton matches each carousel's aspect ratio to prevent CLS while
  // JS hydrates and the dynamic import resolves.
  if (isDesktop === null) {
    return (
      <div className="aspect-[9/16] max-h-[80vh] w-full bg-neutral-900 lg:aspect-video lg:max-h-screen" />
    );
  }

  return isDesktop ? <HeroCarouselDesktop /> : <HeroCarouselMobile />;
}
