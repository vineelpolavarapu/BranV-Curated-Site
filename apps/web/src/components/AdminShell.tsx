'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { apiFetch, CurrentUser } from '@/lib/api';
import { QuickAddModal } from './QuickAddModal';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/brands', label: 'Brands' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/articles', label: 'Articles' },
  { href: '/admin/drops', label: 'Drops' },
  { href: '/admin/lookbooks', label: 'Lookbooks' },
  { href: '/admin/edits', label: 'The Edit' },
  { href: '/admin/banners', label: 'Banners' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/avatars', label: 'Avatars' },
];

export function AdminShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // ── Keyboard shortcut: `N` opens Quick Add (when not typing in a field) ──
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (t.isContentEditable) return;
      if (quickAddOpen) return;
      e.preventDefault();
      setQuickAddOpen(true);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [quickAddOpen]);

  // ── Page-level buttons can dispatch `branv:quickadd:open` to open the modal ──
  useEffect(() => {
    function onOpen() {
      setQuickAddOpen(true);
    }
    window.addEventListener('branv:quickadd:open', onOpen);
    return () => window.removeEventListener('branv:quickadd:open', onOpen);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiFetch<CurrentUser>('/auth/me');
      if (cancelled) return;
      if (!result.ok || !result.data) {
        router.replace('/admin/login');
        return;
      }
      if (result.data.role !== 'ADMIN') {
        setError('You do not have admin access.');
        setTimeout(() => router.replace('/account'), 1500);
        return;
      }
      if (!result.data.totpEnabled) {
        router.replace('/admin/setup-2fa');
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
    router.replace('/admin/login');
    router.refresh();
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-2xl font-semibold">403 — Forbidden</h1>
        <p className="text-neutral-600">{error}</p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="h-2 w-32 animate-pulse rounded bg-neutral-200" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              BranV Admin
            </p>
            <Link href="/admin" className="text-lg font-semibold tracking-tight">
              Console
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-600">{me.email}</span>
            <button
              onClick={onLogout}
              className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="space-y-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">
          <div className="mb-6 flex items-end justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <div className="flex gap-2">{actions}</div>
          </div>
          {children}
        </main>
      </div>

      {/* Floating "+" button — Quick Add (or press N) */}
      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Quick Add product (N)"
        title="Quick Add (N)"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl font-light text-white shadow-lg transition hover:scale-105 hover:bg-neutral-800"
      >
        +
      </button>

      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={() => {
          router.refresh();
        }}
      />
    </div>
  );
}

export const adminButtonPrimary =
  'rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50';
export const adminButtonSecondary =
  'rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50';
export const adminButtonDanger =
  'rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50';
export const adminInput =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900';
export const adminLabel =
  'mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-700';
export const adminCard =
  'rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm';
