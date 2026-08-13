'use client';

import { useEffect, useState } from 'react';

/**
 * Persists the hero carousel's active slide across navigations.
 *
 * Without this, every return to the home page remounts the carousel at slide 0
 * (Sharp Formals), so pressing back from any page lands on the first banner
 * instead of the banner the user was actually viewing. Persisting the real
 * index to sessionStorage and restoring it on mount gives the "one step back"
 * reverse-queue behaviour: the hero resumes exactly where it was left.
 *
 * Returns the track index (already offset +1 for the leading clone), whether
 * the first paint should skip the CSS transition (so we jump straight to the
 * restored slide instead of animating from slide 0), and their setters.
 */
const STORAGE_KEY = 'bv-hero-slide';

export function useHeroSlideMemory(total: number) {
  const [trackIndex, setTrackIndex] = useState<number>(() => {
    let startReal = 0;
    try {
      if (typeof window !== 'undefined') {
        const saved = Number(sessionStorage.getItem(STORAGE_KEY));
        if (Number.isFinite(saved) && saved >= 0 && saved < total) {
          startReal = Math.floor(saved);
        }
      }
    } catch {
      /* sessionStorage may be unavailable (private mode) — fall back to slide 0 */
    }
    // trackIndex is offset by +1 because the carousel prepends a clone of the
    // last slide at index 0.
    return startReal + 1;
  });

  // Start without a transition so the restored slide appears instantly rather
  // than sliding in from slide 0. The carousel's own effect re-enables
  // transitions after a couple of animation frames.
  const [withTransition, setWithTransition] = useState<boolean>(false);

  // Persist the real (0-based) index whenever the track moves.
  const realIndex = ((trackIndex - 1) % total + total) % total;
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(realIndex));
    } catch {
      /* ignore — persistence is a progressive enhancement */
    }
  }, [realIndex]);

  return { trackIndex, setTrackIndex, withTransition, setWithTransition };
}