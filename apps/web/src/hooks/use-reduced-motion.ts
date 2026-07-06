'use client';

import { useEffect, useState } from 'react';

/**
 * Custom hook to detect if the user has requested reduced motion at the OS or browser level.
 */
export function useReducedMotion() {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReduced(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setIsReduced(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  return isReduced;
}
