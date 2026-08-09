'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { reportClickOutcome } from '@/lib/click-tracking';
import { DidYouBuyBottomSheet } from './DidYouBuyBottomSheet';
import { NicePickModal } from './NicePickModal';

type Outcome = 'PURCHASED' | 'BROWSING' | 'NEEDS_HELP';

interface PendingClick {
  trackingId: string;
  productTitle: string;
}

interface ClickReturnContextValue {
  /** Call from Buy Now buttons to arm the return-prompt for a specific click. */
  startTracking: (click: PendingClick) => void;
}

const ClickReturnContext = createContext<ClickReturnContextValue | null>(null);

const PROMPT_DELAY_MS = 8000;

export function ClickReturnProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  // State held in refs so visibilitychange handlers always see the latest
  // value without re-binding listeners on every render.
  const pendingRef = useRef<PendingClick | null>(null);
  const wentHiddenRef = useRef(false);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prompting, setPrompting] = useState<PendingClick | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const clearAll = useCallback(() => {
    pendingRef.current = null;
    wentHiddenRef.current = false;
    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
  }, []);

  const startTracking = useCallback((click: PendingClick) => {
    // Replace any previous pending click - only the most recent Buy Now matters.
    clearAll();
    pendingRef.current = click;
  }, [clearAll]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (pendingRef.current) wentHiddenRef.current = true;
        return;
      }
      // visible
      const pending = pendingRef.current;
      if (!pending || !wentHiddenRef.current) return;
      if (promptTimerRef.current) return;
      promptTimerRef.current = setTimeout(() => {
        promptTimerRef.current = null;
        // Re-check: the click could have been cleared while waiting.
        if (pendingRef.current?.trackingId === pending.trackingId) {
          setPrompting(pending);
        }
      }, PROMPT_DELAY_MS);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    };
  }, []);

  const handleAnswer = useCallback(
    (outcome: Outcome) => {
      const current = prompting;
      setPrompting(null);
      if (current) {
        void reportClickOutcome(current.trackingId, outcome);
        if (outcome === 'PURCHASED') setCelebrating(true);
      }
      clearAll();
    },
    [prompting, clearAll],
  );

  const handleDismiss = useCallback(() => {
    setPrompting(null);
    clearAll();
  }, [clearAll]);

  return (
    <ClickReturnContext.Provider value={{ startTracking }}>
      {children}
      <DidYouBuyBottomSheet
        open={prompting !== null}
        productTitle={prompting?.productTitle ?? ''}
        onAnswer={handleAnswer}
        onDismiss={handleDismiss}
      />
      <NicePickModal
        open={celebrating}
        onClose={() => setCelebrating(false)}
        onViewWardrobe={() => router.push('/wardrobe')}
      />
    </ClickReturnContext.Provider>
  );
}

export function useClickReturn(): ClickReturnContextValue {
  const ctx = useContext(ClickReturnContext);
  if (!ctx) {
    // Outside the provider tree - return a no-op so a stray BuyNowButton
    // doesn't crash (e.g. on the admin shell which doesn't mount this).
    return { startTracking: () => {} };
  }
  return ctx;
}
