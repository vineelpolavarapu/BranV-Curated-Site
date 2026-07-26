'use client';

import { useEffect } from 'react';
import { Icon } from '../icons';

type Outcome = 'PURCHASED' | 'BROWSING' | 'NEEDS_HELP';

interface Props {
  open: boolean;
  productTitle: string;
  onAnswer: (outcome: Outcome) => void;
  onDismiss: () => void;
}

/**
 * Non-intrusive bottom sheet shown after the user returns to the source tab.
 * BUILD_GUIDE §5.2.3: prompts "Did you buy [title]?" with three options.
 */
export function DidYouBuyBottomSheet({
  open,
  productTitle,
  onAnswer,
  onDismiss,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Click-out follow-up"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 pointer-events-none md:bottom-6"
    >
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-line bg-surface p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-content">How did it go?</p>
            <p className="mt-0.5 text-sm text-content-soft">
              Did you buy <span className="font-medium">{productTitle}</span>?
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="grid h-7 w-7 place-items-center rounded-full text-content-muted hover:bg-surface-muted hover:text-content-soft"
          >
            <Icon.Close size={14} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAnswer('PURCHASED')}
            className="flex-1 min-w-[140px] rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover"
          >
            Yes, I bought it
          </button>
          <button
            type="button"
            onClick={() => onAnswer('BROWSING')}
            className="flex-1 min-w-[120px] rounded-full border border-line px-4 py-2 text-sm font-medium text-content-soft hover:bg-surface-muted"
          >
            Just browsing
          </button>
          <button
            type="button"
            onClick={() => onAnswer('NEEDS_HELP')}
            className="flex-1 min-w-[100px] rounded-full border border-line px-4 py-2 text-sm font-medium text-content-soft hover:bg-surface-muted"
          >
            Need help
          </button>
        </div>
      </div>
    </div>
  );
}
