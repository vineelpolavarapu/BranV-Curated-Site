'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, ReactNode } from 'react';

interface PageTransitionShellProps {
  children: ReactNode;
}

export function PageTransitionShell({ children }: PageTransitionShellProps) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'idle' | 'animating'>('idle');

  // Always keep a ref to the latest children so the timeout callback
  // can read them without being listed as an effect dependency.
  // Listing `children` in the deps causes a new React object reference
  // on every render (React 19 concurrent mode), which resets the timer
  // before it ever completes and leaves displayChildren stuck on the
  // initial page — breaking browser back-button navigation.
  const latestChildren = useRef(children);
  latestChildren.current = children;

  useEffect(() => {
    setTransitionStage('animating');
    const timer = setTimeout(() => {
      setDisplayChildren(latestChildren.current);
      setTransitionStage('idle');
    }, 150);
    return () => clearTimeout(timer);
  }, [pathname]); // pathname only — intentionally excludes children

  return (
    <div
      className={`transition-opacity duration-150 ease-in-out ${
        transitionStage === 'idle' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {displayChildren}
    </div>
  );
}
