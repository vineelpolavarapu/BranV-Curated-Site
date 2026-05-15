'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StorefrontShell } from '@/components/StorefrontShell';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

type State = 'pending' | 'ok' | 'already' | 'error';

export default function NewsletterConfirmPage() {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [state, setState] = useState<State>('pending');

  useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/newsletter/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setState('error');
          return;
        }
        const body = (await res.json().catch(() => null)) as
          | { alreadyConfirmed?: boolean }
          | null;
        setState(body?.alreadyConfirmed ? 'already' : 'ok');
      } catch {
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        {state === 'pending' && (
          <p className="text-sm text-neutral-500">Confirming…</p>
        )}
        {state === 'ok' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              You&apos;re in.
            </h1>
            <p className="mt-3 text-neutral-600">
              Look out for the BranV weekly in your inbox.
            </p>
          </>
        )}
        {state === 'already' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              Already subscribed
            </h1>
            <p className="mt-3 text-neutral-600">No action needed.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              Link invalid or expired
            </h1>
            <p className="mt-3 text-neutral-600">
              The confirmation link may have already been used.
            </p>
          </>
        )}
        <div className="mt-8">
          <Link
            href="/"
            className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Continue to BranV →
          </Link>
        </div>
      </section>
    </StorefrontShell>
  );
}
