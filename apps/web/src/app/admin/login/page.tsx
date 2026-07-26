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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await apiFetch<AuthSummary>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Login failed');
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  return (
    <AuthShell
      title="Admin sign in"
      subtitle="Restricted area."
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
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
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
