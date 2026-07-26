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
        className={`${
          variant === 'page'
            ? 'rounded-md bg-emerald-50 px-4 py-3 text-sm text-success'
            : 'text-xs text-success'
        } animate-success-pop`}
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
            ? 'text-xs font-medium uppercase tracking-wider text-content-soft'
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
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-[16px] text-content outline-none placeholder:text-content-muted focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={submitting}
          className="group rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition-all duration-180 hover:bg-primary-hover hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {submitting ? '…' : <>Subscribe <span className="transition-transform duration-180 group-hover:translate-x-0.5">→</span></>}
        </button>
      </div>
      {error && <p className="text-xs text-danger animate-error-fade">{error}</p>}
      <p className="text-[10px] text-content-soft">
        Weekly. Unsubscribe in one click.
      </p>
    </form>
  );
}
