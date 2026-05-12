'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, CurrentUser } from '@/lib/api';

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiFetch<CurrentUser>('/auth/me');
      if (cancelled) return;
      if (!result.ok || !result.data) {
        router.replace('/login');
        return;
      }
      setMe(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }

  if (!me) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="h-2 w-32 animate-pulse rounded bg-neutral-200" />
      </main>
    );
  }

  const displayName =
    [me.profile?.firstName, me.profile?.lastName].filter(Boolean).join(' ') ||
    me.email;

  return (
    <main className="min-h-screen">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            BranV
          </Link>
          <button
            onClick={onLogout}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 text-3xl font-semibold tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="text-neutral-600">{me.email}</p>

        <div className="mt-8 grid gap-4">
          <Row label="Email verified" value={me.emailVerified ? 'Yes' : 'No'} />
          <Row label="Two-factor auth" value={me.totpEnabled ? 'Enabled' : 'Off'} />
          <Row label="Role" value={me.role} />
          <Row
            label="Member since"
            value={new Date(me.createdAt).toLocaleDateString()}
          />
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
          Wardrobe, Wishlist, Reviews and Notifications land in Phase 5 and Phase 8.
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className="text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );
}
