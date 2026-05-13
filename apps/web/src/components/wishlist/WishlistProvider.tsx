'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface WishlistContextValue {
  /** null = still loading, true/false = known auth state */
  signedIn: boolean | null;
  /** Set of productIds currently in the user's wishlist (empty when not signed in). */
  productIds: ReadonlySet<string>;
  /** Toggle a product. Unauthed users are redirected to /login. Returns the new state. */
  toggle: (productId: string) => Promise<boolean>;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [productIds, setProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch<string[]>('/me/wishlist/ids');
      if (cancelled) return;
      if (res.status === 401 || res.status === 403) {
        setSignedIn(false);
        setProductIds(new Set());
        return;
      }
      if (res.ok && res.data) {
        setSignedIn(true);
        setProductIds(new Set(res.data));
      } else {
        // Network blip or other — assume unsigned so the UI doesn't lie.
        setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (productId: string): Promise<boolean> => {
      if (signedIn === false) {
        router.push('/login?next=/');
        return false;
      }
      const currentlyIn = productIds.has(productId);
      // Optimistic update.
      setProductIds((prev) => {
        const next = new Set(prev);
        if (currentlyIn) next.delete(productId);
        else next.add(productId);
        return next;
      });
      const path = currentlyIn
        ? `/wishlist/items/${productId}`
        : '/wishlist/items';
      const res = await apiFetch(path, {
        method: currentlyIn ? 'DELETE' : 'POST',
        body: currentlyIn ? undefined : JSON.stringify({ productId }),
      });
      if (!res.ok) {
        // Roll back optimistic update on failure.
        setProductIds((prev) => {
          const next = new Set(prev);
          if (currentlyIn) next.add(productId);
          else next.delete(productId);
          return next;
        });
        if (res.status === 401 || res.status === 403) {
          router.push('/login?next=/');
        }
        return currentlyIn;
      }
      return !currentlyIn;
    },
    [signedIn, productIds, router],
  );

  const isInWishlist = useCallback(
    (productId: string) => productIds.has(productId),
    [productIds],
  );

  return (
    <WishlistContext.Provider
      value={{ signedIn, productIds, toggle, isInWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    // No provider in tree — return a no-op so admin routes (which don't mount
    // the storefront shell) don't crash.
    return {
      signedIn: false,
      productIds: new Set(),
      toggle: async () => false,
      isInWishlist: () => false,
    };
  }
  return ctx;
}
