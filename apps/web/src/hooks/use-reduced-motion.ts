'use client';

/* Stable import path for the reduced-motion preference (THEME_REDESIGN_PLAN §8).
   Wraps Framer Motion's hook so every interactive component can gate its
   animation from one place. Returns `true` when the user prefers reduced motion. */

import { useReducedMotion as useFramerReducedMotion } from 'motion/react';

export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}
