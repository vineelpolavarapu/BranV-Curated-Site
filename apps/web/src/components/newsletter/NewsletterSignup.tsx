'use client';

import { FormEvent, useState } from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

interface Props {
  source?: string;
  variant?: 'footer' | 'page';
}

export function NewsletterSignup({ source = 'footer', variant = 'footer' }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/newsletter/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
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
      <p
        className={
          variant === 'page'
            ? 'rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
            : 'text-xs text-emerald-700'
        }
      >
        ✓ Check your inbox to confirm.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2">
      <label
        htmlFor={`newsletter-${source}`}
        className={
          variant === 'page'
            ? 'text-xs font-medium uppercase tracking-wider text-neutral-700'
            : 'sr-only'
        }
      >
        Email
      </label>
      <div className="flex gap-2">
        <input
          id={`newsletter-${source}`}
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
          {submitting ? '…' : 'Subscribe'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[10px] text-neutral-500">
        Weekly. Unsubscribe in one click.
      </p>
    </form>
  );
}
