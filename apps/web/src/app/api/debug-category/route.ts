// Temporary diagnostic endpoint — remove after confirming the category fetch.
import { apiServer } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';
  const url = `${base}/categories/shirts`;

  let raw: Record<string, unknown>;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const text = await res.text();
    raw = {
      url,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      bodyPreview: text.slice(0, 1000),
    };
  } catch (err) {
    raw = {
      url,
      threw: true,
      errorName: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorCause: err instanceof Error ? String(err.cause ?? '') : '',
    };
  }

  const viaHelper = await apiServer('/categories/shirts');

  return Response.json({ raw, viaHelperIsNull: viaHelper === null });
}
