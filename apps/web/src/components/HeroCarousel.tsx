'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { EditSummary } from '@/lib/phase7-types';

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

export function HeroCarousel({ edits = [] }: { edits?: EditSummary[] }) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1080px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Skeleton matches each carousel's aspect ratio to prevent CLS while
  // JS hydrates and the dynamic import resolves.
  if (isDesktop === null) {
    return (
      <div className="h-[100svh] w-full bg-neutral-900" />
    );
  }

  return isDesktop ? (
    <HeroCarouselDesktop edits={edits} />
  ) : (
    <HeroCarouselMobile edits={edits} />
  );
}
