'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  AuthShell,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '@/components/AuthShell';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await apiFetch<{ status: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      }),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Registration failed');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="We sent a verification link to your inbox. Click it to activate your account."
        footer={
          <Link href="/login" className="font-medium text-content underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-content-soft">
          In development with mock email, the link is logged to the API stdout -
          check the <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">pnpm dev</code> console.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to join. No spam, just curated drops."
      footer={
        <span className="text-content-soft">
          Already a member?{' '}
          <Link href="/login" className="font-medium text-content underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="firstName">First name</label>
            <input
              id="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="lastName">Last name</label>
            <input
              id="lastName"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-content-soft">
            At least 8 characters.
          </p>
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={primaryButtonClass}
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
