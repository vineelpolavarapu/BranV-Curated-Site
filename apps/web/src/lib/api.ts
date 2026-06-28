/**
 * Tiny fetch wrapper. Always sends cookies. Never throws — returns the parsed
 * body and a typed error string when the response is non-2xx.
 */
const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  /** Server-supplied payload alongside the error (e.g. `requires2fa: true`). */
  details: Record<string, unknown> | null;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
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
}
