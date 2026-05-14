'use client';

import { FormEvent, useState } from 'react';

interface Props {
  dropSlug: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

export function NotifyMeForm({ dropSlug }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/drops/${dropSlug}/notify-me`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? 'Could not subscribe');
      } else {
        setDone(true);
      }
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        ✓ You&apos;re on the list. We&apos;ll email you the moment it goes live.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md gap-2">
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Notify me'}
      </button>
      {error && (
        <p className="absolute mt-12 text-xs text-red-600">{error}</p>
      )}
    </form>
  );
}
