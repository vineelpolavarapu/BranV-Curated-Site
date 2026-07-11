'use client';

import { ReactLenis } from 'lenis/react';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface LenisProviderProps {
  children: ReactNode;
}

export function LenisProvider({ children }: LenisProviderProps) {
  const pathname = usePathname();

  // Admin is a data-entry console, not a marketing page — smooth-scroll
  // easing there only hurts usability, and Lenis's cached scroll-height can
  // go stale when async-loaded form content (dropdowns, checkbox lists)
  // changes page height after mount, making the page feel "stuck" before
  // reaching the real bottom. Skip Lenis for /admin and use native scroll.
  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      root
      options={{
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo style
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1.0,
      }}
    >
      {children}
    </ReactLenis>
  );
}
