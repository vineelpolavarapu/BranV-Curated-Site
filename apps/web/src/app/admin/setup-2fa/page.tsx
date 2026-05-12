'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, CurrentUser } from '@/lib/api';
import {
  AuthShell,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '@/components/AuthShell';

interface SetupPayload {
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export default function AdminSetupTwoFactorPage() {
  const router = useRouter();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bootstrap: confirm we're logged in as an admin, then start setup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meResult = await apiFetch<CurrentUser>('/auth/me');
      if (cancelled) return;
      if (!meResult.ok || !meResult.data) {
        router.replace('/admin/login');
        return;
      }
      if (meResult.data.role !== 'ADMIN') {
        setError('This page is for admins only.');
        return;
      }
      setMe(meResult.data);
      if (meResult.data.totpEnabled) {
        router.replace('/admin');
        return;
      }
      const setupResult = await apiFetch<SetupPayload>('/auth/2fa/setup', {
        method: 'POST',
      });
      if (cancelled) return;
      if (setupResult.ok && setupResult.data) setSetup(setupResult.data);
      else setError(setupResult.error ?? 'Could not start 2FA setup');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await apiFetch('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Invalid code');
      return;
    }
    // After enabling 2FA, the JWT's `totp` claim is stale until next refresh.
    await apiFetch('/auth/refresh', { method: 'POST' });
    router.replace('/admin');
    router.refresh();
  }

  return (
    <AuthShell
      title="Set up two-factor authentication"
      subtitle={
        me?.email
          ? `Required for admin access (${me.email}).`
          : 'Required for admin access.'
      }
    >
      {!setup && !error && (
        <div className="h-2 w-full animate-pulse rounded bg-neutral-200" />
      )}
      {setup && (
        <div className="space-y-5">
          <ol className="space-y-2 text-sm text-neutral-700">
            <li>1. Open your authenticator app (1Password, Authy, Google Authenticator).</li>
            <li>2. Scan the QR below, or enter the URL manually.</li>
            <li>3. Enter the 6-digit code to confirm.</li>
          </ol>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            {/* QRCode renders as a data: URL, which next/image accepts as `unoptimized`. */}
            <Image
              src={setup.qrCodeDataUrl}
              alt="Two-factor setup QR code"
              width={200}
              height={200}
              unoptimized
              className="mx-auto"
            />
          </div>
          <details className="text-xs text-neutral-600">
            <summary className="cursor-pointer">Can&apos;t scan? Show URL</summary>
            <code className="mt-2 block break-all rounded bg-neutral-100 p-2">
              {setup.otpauthUrl}
            </code>
          </details>
          <form onSubmit={onVerify} className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="code">6-digit code</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={inputClass}
                placeholder="000000"
              />
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className={primaryButtonClass}
            >
              {submitting ? 'Verifying…' : 'Enable 2FA'}
            </button>
          </form>
        </div>
      )}
      {error && !setup && <p className="text-sm text-red-600">{error}</p>}
    </AuthShell>
  );
}
