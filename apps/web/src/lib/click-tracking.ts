/**
 * Resolves the "Buy Now" href for a product. Prefers the Phase 5 short tracking
 * link (`{API_HOST}/go/{trackingId}`) so click-out events are logged; falls
 * back to the raw affiliate URL if the API didn't mint one.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

// Strip the trailing /api so we can serve /go/:trackingId at the root.
const GO_BASE = API_BASE.replace(/\/api\/?$/, '');

export function resolveBuyNowHref(buyNow: {
  url: string;
  trackingId: string | null;
}): string {
  if (buyNow.trackingId) {
    return `${GO_BASE}/go/${buyNow.trackingId}`;
  }
  return buyNow.url;
}

/**
 * Records the user's "Did you buy this?" answer. Fire-and-forget — analytics
 * shouldn't block the celebration flow if the network blips.
 */
export async function reportClickOutcome(
  trackingId: string,
  outcome: 'PURCHASED' | 'BROWSING' | 'NEEDS_HELP',
): Promise<void> {
  try {
    await fetch(`${API_BASE}/clicks/${trackingId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send the access cookie so the API can attribute the report to the user
      // (and auto-insert the wardrobe item on PURCHASED).
      credentials: 'include',
      body: JSON.stringify({ outcome }),
      keepalive: true,
    });
  } catch {
    // swallow — non-essential
  }
}
