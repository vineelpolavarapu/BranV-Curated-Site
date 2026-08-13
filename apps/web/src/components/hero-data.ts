// Single source of truth for hero carousel slides.
//
// The mobile and desktop carousels each render a different image set (portrait
// 9:16 art under /mobile-hero/, landscape art under /hero/) but share the same
// ordering, copy, and CTA targets. Centralising the data here lets the
// server-rendered initial hero (HeroInitial) paint the exact same first slide
// the interactive carousel will hydrate onto — so there is no flash between the
// SSR banner and the client carousel.

export type HeroSlide = {
  key: string;
  /** Portrait 9:16 art for <1080px viewports. */
  mobileImage: string;
  /** Landscape art for >=1080px viewports. */
  desktopImage: string;
  headline: string;
  subtext?: string;
  ctaLabel: string;
  ctaHref: string;
};

export const HERO_SLIDES: HeroSlide[] = [
  {
    key: 'formals',
    mobileImage: '/mobile-hero/mobile_formals.webp',
    desktopImage: '/hero/formals1.webp',
    headline: 'Sharp Formals',
    subtext: 'Tailored shirts and trousers for the office and beyond.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/sharp-formals',
  },
  {
    key: 'classic',
    mobileImage: '/mobile-hero/mobile_classic.webp',
    desktopImage: '/hero/easy_causal.webp',
    headline: 'Classic Essentials',
    subtext: 'The wardrobe staples that never go out of style.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/classic-essentials',
  },
  {
    key: 'trendy',
    mobileImage: '/mobile-hero/latest_trends.webp',
    desktopImage: '/hero/latest_web.webp',
    headline: 'Trendy Wear',
    subtext: 'The pieces everyone is reaching for right now.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/trendy-wear',
  },
  {
    key: 'sportswear',
    mobileImage: '/mobile-hero/mobile_sports.webp',
    desktopImage: '/hero/sports.webp',
    headline: 'Sports Wear',
    subtext: 'Performance fits built for the gym, the run, and everything after.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/sports-wear',
  },
  {
    key: 'fashion',
    mobileImage: '/mobile-hero/mobile_fashion.webp',
    desktopImage: '/hero/fashoin.webp',
    headline: 'Fashion Forward',
    subtext: 'Bold cuts, brave colours, conversation-starting silhouettes.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/fashion-forward',
  },
  {
    key: 'casual',
    mobileImage: '/mobile-hero/mobile_casual.webp',
    desktopImage: '/hero/casual2.webp',
    headline: 'Easy Casuals',
    subtext: 'Weekend-ready tees, joggers, and overshirts.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/easy-casuals',
  },
  {
    key: 'footwear',
    mobileImage: '/mobile-hero/mobile_footwear.webp',
    desktopImage: '/hero/footwear.webp',
    headline: 'Footwear',
    subtext: 'Sneakers, loafers, boots, the foundation of every outfit.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/category/footwear',
  },
  {
    key: 'watches',
    mobileImage: '/mobile-hero/mobile_watches.webp',
    desktopImage: '/hero/watches.webp',
    headline: 'Watches',
    subtext: 'Watches, belts, bags, the details that complete a look.',
    ctaLabel: 'Explore Collection',
    ctaHref: '/category/watches',
  },
];

export const HERO_DESKTOP_BREAKPOINT = 1080;