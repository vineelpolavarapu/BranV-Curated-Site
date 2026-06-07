import { HeroCarouselDesktop } from './HeroCarouselDesktop';
import { HeroCarouselMobile } from './HeroCarouselMobile';

// Breakpoint wrapper. <768px renders the mobile carousel (portrait art under
// /mobile-hero/); >=768px renders the desktop carousel (landscape art under
// /hero/). The two components are completely independent — they share no
// state, no DOM, no image set. Changing the 768px breakpoint only requires
// editing the two wrapper class names here.
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
