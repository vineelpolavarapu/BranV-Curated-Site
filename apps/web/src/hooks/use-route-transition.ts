'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Custom hook to track route change transitions.
 */
export function useRouteTransition() {
  const pathname = usePathname();
  const [isPending, setIsPending] = useState(false);
  const [displayPath, setDisplayPath] = useState(pathname);

  useEffect(() => {
    if (pathname !== displayPath) {
      setIsPending(true);
      const timer = setTimeout(() => {
        setDisplayPath(pathname);
        setIsPending(false);
      }, 350); // Matches the page transition animation duration
      return () => clearTimeout(timer);
    }
  }, [pathname, displayPath]);

  return { isPending, displayPath, actualPath: pathname };
}
