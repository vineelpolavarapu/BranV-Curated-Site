'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StorefrontShell } from '@/components/StorefrontShell';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

type State = 'pending' | 'ok' | 'error';

export default function NewsletterUnsubscribePage() {
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
        const res = await fetch(`${API_BASE}/newsletter/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        setState(res.ok ? 'ok' : 'error');
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
          <p className="text-sm text-neutral-500">Unsubscribing…</p>
        )}
        {state === 'ok' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              You&apos;re unsubscribed
            </h1>
            <p className="mt-3 text-neutral-600">
              Sorry to see you go. You can resubscribe anytime.
            </p>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              Link invalid
            </h1>
            <p className="mt-3 text-neutral-600">
              The unsubscribe link couldn&apos;t be processed.
            </p>
          </>
        )}
        <div className="mt-8">
          <Link
            href="/"
            className="rounded-md border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Back to BranV
          </Link>
        </div>
      </section>
    </StorefrontShell>
  );
}
