import Link from 'next/link';
import { HeroSlide, HERO_DESKTOP_BREAKPOINT } from './hero-data';

/**
 * Server-rendered first hero slide.
 *
 * This is the critical fix for the home-page load glitch: the interactive
 * carousel is a client component whose children are `dynamic(..., { ssr:false })`,
 * so its banner image is NOT in the server HTML — only a blank gradient that
 * pops in once JS hydrates. Meanwhile the catalog sections ARE server-rendered,
 * so on refresh the catalogs painted before the hero banner.
 *
 * `HeroInitial` is a plain server component rendered inside the carousel's
 * pre-hydration branch, so the first banner image ships in the initial HTML
 * via a <picture> that picks the correct (mobile/desktop) WebP through a media
 * query and is loaded with `fetchPriority="high"`. The browser's preload
 * scanner fetches it immediately — the hero is the first thing visible, the
 * interactive carousel then crossfades in on top.
 */
export function HeroInitial({ slide }: { slide: HeroSlide }) {
  const desktopMQ = `(min-width: ${HERO_DESKTOP_BREAKPOINT}px)`;
  return (
    <section
      aria-label={slide.headline}
      className="relative h-full w-full overflow-hidden bg-slate-950"
    >
      <picture>
        <source
          media={desktopMQ}
          srcSet={slide.desktopImage}
          type="image/webp"
        />
        <source
          media={`(max-width: ${HERO_DESKTOP_BREAKPOINT - 1}px)`}
          srcSet={slide.mobileImage}
          type="image/webp"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.mobileImage}
          alt={slide.headline}
          draggable={false}
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      </picture>

      {/* Match the carousel's text block so the SSR frame and the hydrated
          carousel line up pixel-for-pixel (no shift on handoff). */}
      <div className="absolute inset-x-0 bottom-0 px-6 pb-20 md:px-12 md:pb-24 lg:px-20 lg:pb-28">
        <div className="max-w-3xl text-white drop-shadow-md">
          <h2 className="font-heading text-4xl font-extrabold tracking-tight leading-tight md:text-5xl lg:text-7xl lg:leading-[1.08]">
            {slide.headline}
          </h2>
          {slide.subtext && (
            <p className="mt-3 max-w-xl text-sm font-normal leading-relaxed text-slate-200 md:mt-4 md:text-lg lg:text-xl">
              {slide.subtext}
            </p>
          )}
          <div className="mt-6 md:mt-8">
            <Link
              href={slide.ctaHref}
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary shadow-lg transition-all duration-300 hover:bg-primary hover:text-white md:px-8 md:py-3.5 md:text-sm"
            >
              {slide.ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}