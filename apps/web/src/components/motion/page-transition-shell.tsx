'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';

interface PageTransitionShellProps {
  children: ReactNode;
}

export function PageTransitionShell({ children }: PageTransitionShellProps) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'idle' | 'animating'>('idle');

  useEffect(() => {
    // When children (page route) change, trigger a quick transition
    setTransitionStage('animating');
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionStage('idle');
      // Scroll to top smoothly when page changes
      window.scrollTo({ top: 0 });
    }, 200); // Quick fade duration to avoid delay
    return () => clearTimeout(timer);
  }, [pathname, children]);

  return (
    <div
      className={`transition-opacity duration-200 ease-in-out ${
        transitionStage === 'idle' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {displayChildren}
    </div>
  );
}
