'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';

type Status = 'pending' | 'success' | 'error';

export default function VerifyEmailPage() {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing verification token.');
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await apiFetch<{ status: string }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      if (cancelled) return;
      if (result.ok) setStatus('success');
      else {
        setStatus('error');
        setError(result.error ?? 'Verification failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'pending') {
    return (
      <AuthShell title="Verifying…" subtitle="Hang tight for a moment.">
        <div className="h-2 w-full animate-pulse rounded bg-neutral-200" />
      </AuthShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthShell
        title="Email verified"
        subtitle="Your email is now confirmed. You can sign in."
        footer={
          <Link href="/login" className="font-medium text-neutral-900 underline">
            Continue to sign in
          </Link>
        }
      >
        <p className="text-sm text-neutral-600">
          Welcome to BranV. We&apos;ll only email you about things you opt into.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verification failed"
      subtitle="The link may have expired or already been used."
      footer={
        <Link href="/login" className="font-medium text-neutral-900 underline">
          Back to sign in
        </Link>
      }
    >
      <p className="text-sm text-red-600">{error}</p>
    </AuthShell>
  );
}
