'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { pickHeadline } from '@/lib/nicePickPhrases';

const AUTO_DISMISS_MS = 4000;

interface Props {
  open: boolean;
  onClose: () => void;
  onViewWardrobe?: () => void;
}

/**
 * Celebration modal shown after a member confirms "Yes, I bought it".
 * BUILD_GUIDE §5.2.5: random headline, confetti, animated check,
 * 4s auto-dismiss, honors prefers-reduced-motion.
 */
export function NicePickModal({ open, onClose, onViewWardrobe }: Props) {
  const headlineRef = useRef<string>('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fresh headline each time the modal opens.
  if (open && !headlineRef.current) {
    headlineRef.current = pickHeadline();
  }
  if (!open && headlineRef.current) {
    headlineRef.current = '';
  }

  useEffect(() => {
    if (!open) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduced) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      const t = setTimeout(
        () => confetti({ particleCount: 50, spread: 100, origin: { y: 0.6 } }),
        300,
      );
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(onClose, AUTO_DISMISS_MS);
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-content/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nicepick-headline"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-surface p-8 text-center shadow-2xl outline-none"
      >
        <AnimatedCheck />
        <h2
          id="nicepick-headline"
          className="mt-6 text-2xl font-semibold tracking-tight text-content"
        >
          {headlineRef.current}
        </h2>
        <p className="mt-2 text-sm text-content-soft">
          We&apos;ve saved this to My Wardrobe.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {onViewWardrobe && (
            <button
              type="button"
              onClick={() => {
                onViewWardrobe();
                onClose();
              }}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover"
            >
              View My Wardrobe
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-content-soft hover:bg-surface-muted"
          >
            Keep browsing
          </button>
        </div>
      </div>
    </div>
  );
}

function AnimatedCheck() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      aria-hidden
      className="mx-auto"
    >
      <circle
        cx="40"
        cy="40"
        r="36"
        fill="none"
        stroke="#10b981"
        strokeWidth="4"
      />
      <path
        d="M25 42 L36 53 L56 30"
        fill="none"
        stroke="#10b981"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 60,
          strokeDashoffset: 60,
          animation: 'nicepick-check 600ms ease-out forwards',
        }}
      />
      <style>{`
        @keyframes nicepick-check {
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nicepick] path {
            stroke-dashoffset: 0 !important;
            animation: none !important;
          }
        }
      `}</style>
    </svg>
  );
}
