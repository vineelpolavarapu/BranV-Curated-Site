'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export const WISHLIST_IDS_QUERY_KEY = ['wishlist', 'ids'];

export function WishlistProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: WISHLIST_IDS_QUERY_KEY,
    queryFn: async () => {
      const res = await apiFetch<string[]>('/me/wishlist/ids');
      if (res.status === 401 || res.status === 403) {
        return null;
      }
      if (!res.ok || !res.data) {
        return null;
      }
      return res.data;
    },
    staleTime: Infinity, // 0ms latency for repetitive wishlist queries
  });

  const signedIn = isLoading ? null : Array.isArray(data);
  const productIds = useMemo(() => new Set(data ?? []), [data]);

  const toggleMutation = useMutation({
    mutationFn: async ({
      productId,
      currentlyIn,
    }: {
      productId: string;
      currentlyIn: boolean;
    }) => {
      const path = currentlyIn
        ? `/wishlist/items/${productId}`
        : '/wishlist/items';
      const res = await apiFetch(path, {
        method: currentlyIn ? 'DELETE' : 'POST',
        body: currentlyIn ? undefined : JSON.stringify({ productId }),
      });
      if (!res.ok) {
        throw res;
      }
      return { productId, currentlyIn };
    },
    onMutate: async ({ productId, currentlyIn }) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_IDS_QUERY_KEY });
      const previousIds =
        queryClient.getQueryData<string[] | null>(WISHLIST_IDS_QUERY_KEY) ??
        null;

      queryClient.setQueryData<string[] | null>(
        WISHLIST_IDS_QUERY_KEY,
        (old) => {
          if (!old) return currentlyIn ? [] : [productId];
          if (currentlyIn) return old.filter((id) => id !== productId);
          return [...old, productId];
        },
      );

      return { previousIds };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousIds !== undefined) {
        queryClient.setQueryData(
          WISHLIST_IDS_QUERY_KEY,
          context.previousIds,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_IDS_QUERY_KEY });
    },
  });

  const toggle = useCallback(
    async (productId: string): Promise<boolean> => {
      if (signedIn === false) {
        router.push('/login?next=/');
        return false;
      }
      const currentlyIn = productIds.has(productId);
      try {
        await toggleMutation.mutateAsync({ productId, currentlyIn });
        return !currentlyIn;
      } catch (err: unknown) {
        const errorRes = err as { status?: number };
        if (errorRes?.status === 401 || errorRes?.status === 403) {
          router.push('/login?next=/');
        }
        return currentlyIn;
      }
    },
    [signedIn, productIds, router, toggleMutation],
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
    return {
      signedIn: false,
      productIds: new Set(),
      toggle: async () => false,
      isInWishlist: () => false,
    };
  }
  return ctx;
}
