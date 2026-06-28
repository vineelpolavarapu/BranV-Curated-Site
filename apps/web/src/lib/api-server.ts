/**
 * Server-side fetcher for storefront pages. Returns parsed JSON or null on
 * error — pages handle the null case (404 / empty state). No cookies, no auth.
 */
const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

export async function apiServer<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      // Storefront pages are dynamic in dev; ISR added in Phase 11.
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function buildQuery(
  params: Record<string, string | number | boolean | string[] | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      for (const item of v) usp.append(k, String(item));
    } else {
      usp.set(k, String(v));
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}
