/**
 * Server-side fetcher for storefront pages. Returns parsed JSON or null on
 * error - pages handle the null case (404 / empty state). No cookies, no auth.
 */
import { cache } from 'react';

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

async function _apiServer<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`[apiServer] ${url} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[apiServer] ${url} -> fetch failed:`, err);
    return null;
  }
}

export const apiServer = cache(_apiServer) as typeof _apiServer;

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
