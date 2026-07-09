'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, CurrentUser } from '@/lib/api';
import { QuickAddModal } from './QuickAddModal';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/brands', label: 'Brands' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/articles', label: 'Articles' },
  { href: '/admin/lookbooks', label: 'Lookbooks' },
  // { href: '/admin/edits', label: 'The Edit' },
  { href: '/admin/banners', label: 'Banners' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/avatars', label: 'Avatars' },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/admin' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
  );
}

function MobileDrawer({
  open,
  onClose,
  pathname,
  email,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  email: string;
  onLogout: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              BranV Admin
            </p>
            <Link
              href="/admin"
              onClick={onClose}
              className="text-base font-semibold tracking-tight text-neutral-900"
            >
              Console
            </Link>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none">
              <path
                d="M3 3l12 12M15 3L3 15"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Navigation
          </p>
          <NavLinks pathname={pathname} onNavigate={onClose} />
        </div>

        {/* Account section at bottom */}
        <div className="border-t border-neutral-200 px-4 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Account
          </p>
          <p className="mb-3 truncate text-sm text-neutral-700">{email}</p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
          >
            Sign out
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Keyboard shortcut: N opens Quick Add
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

  // Page-level buttons can dispatch `branv:quickadd:open`
  useEffect(() => {
    function onOpen() { setQuickAddOpen(true); }
    window.addEventListener('branv:quickadd:open', onOpen);
    return () => window.removeEventListener('branv:quickadd:open', onOpen);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

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
    return () => { cancelled = true; };
  }, [router]);

  async function onLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-2xl font-semibold text-neutral-900">403 — Forbidden</h1>
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
      {/* ── Top header ─────────────────────────────────────────────────── */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          {/* Left: title */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              BranV Admin
            </p>
            <Link href="/admin" className="text-lg font-semibold tracking-tight text-neutral-900">
              Console
            </Link>
          </div>

          {/* Right: hamburger on mobile, nothing on desktop (sign-out is in sidebar) */}
          <button
            type="button"
            aria-label="Open admin menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path
                d="M3 6h16M3 11h16M3 16h16"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Body: sidebar + content ─────────────────────────────────────── */}
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 md:px-6">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden w-56 shrink-0 md:flex md:flex-col md:gap-4">
          <NavLinks pathname={pathname} />
          {/* Account section at bottom of desktop sidebar */}
          <div className="mt-auto border-t border-neutral-200 pt-4">
            <p className="mb-2 truncate text-xs text-neutral-500">{me.email}</p>
            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Page content */}
        <main className="min-w-0 flex-1">
          <div className="mb-6 flex items-end justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            <div className="flex gap-2">{actions}</div>
          </div>
          {children}
        </main>
      </div>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pathname={pathname}
        email={me.email}
        onLogout={onLogout}
      />

      {/* ── Floating Quick Add button ───────────────────────────────────── */}
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
        onCreated={() => { router.refresh(); }}
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
