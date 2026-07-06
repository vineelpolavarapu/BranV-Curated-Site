'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook to detect when an element enters the viewport, firing exactly once.
 */
export function useInViewOnce<T extends HTMLElement>(threshold = 0.1) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return [ref, inView] as const;
}
