'use client';

import { HeroCarouselDesktop } from './HeroCarouselDesktop';
import { HeroCarouselMobile } from './HeroCarouselMobile';

// Responsive switcher. Renders the mobile carousel below the md breakpoint
// and the desktop carousel at or above it. Each child owns its own slides,
// image set, and layout — this file deliberately holds no carousel logic.
export function HeroCarousel() {
  return (
    <>
      <div className="md:hidden">
        <HeroCarouselMobile />
      </div>
      <div className="hidden md:block">
        <HeroCarouselDesktop />
      </div>
    </>
  );
}
