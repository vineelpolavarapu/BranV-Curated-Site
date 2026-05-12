'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiFetch, AuthSummary } from '@/lib/api';
import {
  AuthShell,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '@/components/AuthShell';

export default function AdminLoginPage() {
  const router = useRouter();
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
    const result = await apiFetch<AuthSummary>('/auth/admin/login', {
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
    // If admin doesn't have 2FA enabled yet, route them through setup.
    if (result.data && !result.data.totpEnabled) {
      router.replace('/admin/setup-2fa');
    } else {
      router.replace('/admin');
    }
    router.refresh();
  }

  return (
    <AuthShell
      title="Admin sign in"
      subtitle="Restricted area. Two-factor authentication is required."
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
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
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
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
