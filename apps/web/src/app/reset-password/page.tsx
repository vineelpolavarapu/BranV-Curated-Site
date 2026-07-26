'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  AuthShell,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '@/components/AuthShell';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await apiFetch<{ status: string; message?: string }>(
      '/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      },
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Reset failed');
      return;
    }
    setDoneMessage(result.data?.message ?? null);
    setDone(true);
  }

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="This reset link is malformed.">
        <p className="text-sm text-danger">Missing reset token.</p>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        title="Password reset"
        subtitle="Your password has been updated."
        footer={
          <Link href="/login" className="font-medium text-content underline">
            Sign in
          </Link>
        }
      >
        <p className="text-sm text-content-soft">
          For your security, all existing sessions have been signed out.
        </p>
        {doneMessage && (
          <p className="mt-2 text-sm text-content-soft">{doneMessage}</p>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you haven't used elsewhere."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="password">New password</label>
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
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className={primaryButtonClass}
        >
          {submitting ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </AuthShell>
  );
}
