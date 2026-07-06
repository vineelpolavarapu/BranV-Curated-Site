'use client';

import { useInViewOnce } from '@/hooks/use-in-view-once';
import { ReactNode } from 'react';

interface FadeSlideInProps {
  children: ReactNode;
  delay?: number; // in milliseconds
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number; // in milliseconds
  className?: string;
  threshold?: number;
}

export function FadeSlideIn({
  children,
  delay = 0,
  direction = 'up',
  duration = 450,
  className = '',
  threshold = 0.1,
}: FadeSlideInProps) {
  const [ref, inView] = useInViewOnce<HTMLDivElement>(threshold);

  const getTranslateClass = () => {
    if (inView) return 'opacity-100 translate-x-0 translate-y-0';
    
    switch (direction) {
      case 'up':
        return 'opacity-0 translate-y-4';
      case 'down':
        return 'opacity-0 -translate-y-4';
      case 'left':
        return 'opacity-0 translate-x-4';
      case 'right':
        return 'opacity-0 -translate-x-4';
      case 'none':
      default:
        return 'opacity-0';
    }
  };

  return (
    <div
      ref={ref}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)', // ease-out-quart style
      }}
      className={`transition-all will-change-transform-opacity ${getTranslateClass()} ${className}`}
    >
      {children}
    </div>
  );
}
