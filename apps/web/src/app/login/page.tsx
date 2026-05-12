'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiFetch, AuthSummary } from '@/lib/api';
import {
  AuthShell,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '@/components/AuthShell';

export default function MemberLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await apiFetch<AuthSummary>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        totpCode: totpCode || undefined,
      }),
    });
    setSubmitting(false);

    if (!result.ok) {
      if (result.details?.requires2fa) {
        setNeeds2fa(true);
        setError('Enter the 6-digit code from your authenticator app.');
        return;
      }
      setError(result.error ?? 'Login failed');
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to your BranV account."
      footer={
        <span className="text-neutral-600">
          New to BranV?{' '}
          <Link href="/register" className="font-medium text-neutral-900 underline">
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <Link
            href="/forgot-password"
            className="mt-2 inline-block text-xs text-neutral-600 hover:text-neutral-900"
          >
            Forgot password?
          </Link>
        </div>
        {needs2fa && (
          <div>
            <label className={labelClass} htmlFor="totp">2FA code</label>
            <input
              id="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className={inputClass}
              placeholder="000000"
            />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={primaryButtonClass}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
