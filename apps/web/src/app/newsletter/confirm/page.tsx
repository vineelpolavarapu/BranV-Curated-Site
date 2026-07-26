'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { StorefrontShell } from '@/components/StorefrontShell';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

type State = 'pending' | 'ok' | 'already' | 'error';

export default function NewsletterConfirmPage() {
  return (
    <Suspense fallback={null}>
      <NewsletterConfirmPageInner />
    </Suspense>
  );
}

function NewsletterConfirmPageInner() {
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
          <p className="text-sm text-content-soft">Confirming…</p>
        )}
        {state === 'ok' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              You&apos;re in.
            </h1>
            <p className="mt-3 text-content-soft">
              Look out for the BranV weekly in your inbox.
            </p>
          </>
        )}
        {state === 'already' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              Already subscribed
            </h1>
            <p className="mt-3 text-content-soft">No action needed.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              Link invalid or expired
            </h1>
            <p className="mt-3 text-content-soft">
              The confirmation link may have already been used.
            </p>
          </>
        )}
        <div className="mt-8">
          <Link
            href="/"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover"
          >
            Continue to BranV →
          </Link>
        </div>
      </section>
    </StorefrontShell>
  );
}
