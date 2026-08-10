/**
 * Tiny fetch wrapper. Always sends cookies + Authorization header if available.
 * Never throws - returns the parsed body and a typed error string when non-2xx.
 */
const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('branv_access_token');
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('branv_refresh_token');
}

export function setStoredTokens(
  accessToken: string | null,
  refreshToken: string | null = null,
) {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    localStorage.setItem('branv_access_token', accessToken);
  } else {
    localStorage.removeItem('branv_access_token');
  }

  if (refreshToken) {
    localStorage.setItem('branv_refresh_token', refreshToken);
  } else if (accessToken === null) {
    localStorage.removeItem('branv_refresh_token');
  }
}

export function setStoredToken(token: string | null) {
  setStoredTokens(token, null);
}

export function clearStoredTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('branv_access_token');
  localStorage.removeItem('branv_refresh_token');
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  /** Server-supplied payload alongside the error (e.g. `requires2fa: true`). */
  details: Record<string, unknown> | null;
}

let refreshPromise: Promise<boolean> | null = null;

async function performTokenRefresh(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearStoredTokens();
    return false;
  }

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': refreshToken,
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearStoredTokens();
      return false;
    }

    const body = await res.json().catch(() => null);
    const newAccess = body?.accessToken || body?.data?.accessToken;
    const newRefresh =
      body?.refreshToken || body?.data?.refreshToken || refreshToken;

    if (newAccess) {
      setStoredTokens(newAccess, newRefresh);
      return true;
    }

    clearStoredTokens();
    return false;
  } catch {
    clearStoredTokens();
    return false;
  }
}

function isAuthBypassPath(path: string): boolean {
  const p = path.toLowerCase();
  return (
    p.includes('/auth/login') ||
    p.includes('/auth/admin/login') ||
    p.includes('/auth/refresh') ||
    p.includes('/auth/logout') ||
    p.includes('/auth/register') ||
    p.includes('/auth/forgot-password') ||
    p.includes('/auth/reset-password')
  );
}

export function isTokenExpiredOrNearExpiry(
  token: string | null,
  bufferSeconds = 60,
): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload.exp !== 'number') return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec + bufferSeconds;
  } catch {
    return false;
  }
}

export async function ensureValidToken(): Promise<string | null> {
  let token = getStoredToken();
  if (token && isTokenExpiredOrNearExpiry(token)) {
    if (!refreshPromise) {
      refreshPromise = performTokenRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) {
      token = getStoredToken();
    }
  }
  return token;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  isRetry = false,
): Promise<ApiResult<T>> {
  if (!isRetry && !isAuthBypassPath(path)) {
    await ensureValidToken();
  }

  let res: Response;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: (err as Error).message || 'Network error',
      details: null,
    };
  }

  if (res.status === 401 && !isRetry && !isAuthBypassPath(path)) {
    if (!refreshPromise) {
      refreshPromise = performTokenRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      return apiFetch<T>(path, init, true);
    }
  }

  const contentType = res.headers.get('content-type') ?? '';
  const body =
    contentType.includes('application/json') && res.status !== 204
      ? await res.json().catch(() => null)
      : null;

  if (!res.ok) {
    const error =
      (body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : null) ?? `HTTP ${res.status}`;
    return {
      ok: false,
      status: res.status,
      data: null,
      error,
      details: (body as Record<string, unknown>) ?? null,
    };
  }

  return {
    ok: true,
    status: res.status,
    data: body as T,
    error: null,
    details: null,
  };
}

export type Role = 'MEMBER' | 'ADMIN';

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  emailVerified: boolean;
  totpEnabled: boolean;
  profile: {
    firstName: string | null;
    lastName: string | null;
  } | null;
  createdAt: string;
}

export interface AuthSummary {
  id: string;
  email: string;
  role: Role;
  totpEnabled: boolean;
  emailVerified: boolean;
  accessToken?: string;
  refreshToken?: string;
}
