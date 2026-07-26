'use client';

/* LazyMotion provider (THEME_REDESIGN_PLAN §7.4).
   Loads only the `domAnimation` feature bundle (~5–6 KB gzip) so global motion
   overhead stays small. Components use the `m.*` primitives (not `motion.*`).
   Drag/gesture-heavy surfaces that need `domMax` load it locally via their own
   dynamic import, keeping it off routes that don't use drag.

   Inert until `m.*` components exist — mounting it changes nothing visually. */

import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {/* reducedMotion="user" makes every animation respect the OS setting by
          default, satisfying the §8 reduced-motion gate globally. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
