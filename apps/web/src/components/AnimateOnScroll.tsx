'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Wraps children in a div. Adds the CSS class `in-view` the first time the
 * element scrolls into the viewport (10 % threshold), then disconnects the
 * observer so the entrance animation never re-fires on scroll-back.
 *
 * Children can use the `.bv-enter` / `.bv-enter-fade` / `.bv-delay-{n}`
 * utility classes (defined in globals.css) to opt in to scroll-triggered
 * entrance animations.
 */
export function AnimateOnScroll({
  children,
  className = '',
  threshold = 0.1,
  cacheKey,
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
  cacheKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pathKey = cacheKey || (typeof window !== 'undefined' ? `bv_anim_${window.location.pathname}` : null);
    const alreadyVisited = pathKey ? sessionStorage.getItem(pathKey) === '1' : false;

    if (alreadyVisited) {
      el.classList.add('in-view', 'skip-animation');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in-view');
          if (pathKey) {
            try {
              sessionStorage.setItem(pathKey, '1');
            } catch {
              // Ignore quota/private browsing errors
            }
          }
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, cacheKey]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
