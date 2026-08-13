'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, CurrentUser } from '@/lib/api';
import { useCurrentUser, useLogout } from '@/hooks/use-auth';
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
                ? 'bg-primary text-primary-fg'
                : 'text-content-soft hover:bg-surface-muted'
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
        className="absolute inset-0 bg-content/40"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-content-soft">
              BranV Admin
            </p>
            <Link
              href="/admin"
              onClick={onClose}
              className="text-base font-semibold tracking-tight text-content"
            >
              Console
            </Link>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-content-soft hover:bg-surface-muted"
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
          
          <NavLinks pathname={pathname} onNavigate={onClose} />
        </div>

        {/* Account section at bottom */}
        <div className="border-t border-line px-4 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-content-soft">
            Account
          </p>
          <p className="mb-3 truncate text-sm text-content-soft">{email}</p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full rounded-md border border-line px-3 py-2 text-sm font-medium text-content hover:bg-surface-muted"
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
  const [error, setError] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: me, isLoading } = useCurrentUser();
  const logoutMutation = useLogout();

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
    if (isLoading) return;
    if (!me) {
      router.replace('/admin/login');
      return;
    }
    if (me.role !== 'ADMIN') {
      setError('You do not have admin access.');
      setTimeout(() => router.replace('/account'), 1500);
    }
  }, [me, isLoading, router]);

  async function onLogout() {
    await logoutMutation.mutateAsync().catch(() => {});
    router.replace('/admin/login');
    router.refresh();
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-2xl font-semibold text-content">403 - Forbidden</h1>
        <p className="text-content-soft">{error}</p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="h-2 w-32 animate-pulse rounded bg-line" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* ── Top header ─────────────────────────────────────────────────── */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          {/* Left: title */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-content-soft">
              BranV Admin
            </p>
            <Link href="/admin" className="text-lg font-semibold tracking-tight text-content">
              Console
            </Link>
          </div>

          {/* Right: hamburger on mobile, nothing on desktop (sign-out is in sidebar) */}
          <button
            type="button"
            aria-label="Open admin menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-content-soft hover:bg-surface-muted md:hidden"
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
      <div className="mx-auto grid grid-cols-1 md:grid-cols-[224px_1fr] max-w-7xl gap-6 px-4 py-8 md:px-6">
        {/* Desktop sidebar - hidden on mobile */}
        <aside className="hidden w-56 shrink-0 md:flex md:flex-col md:gap-4">
          <NavLinks pathname={pathname} />
          {/* Account section at bottom of desktop sidebar */}
          <div className="mt-auto border-t border-line pt-4">
            <p className="mb-2 truncate text-xs text-content-soft">{me.email}</p>
            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Page content */}
        <main className="min-w-0">
          <div className="mb-6 flex items-end justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-content">{title}</h1>
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
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-light text-primary-fg shadow-lg transition hover:scale-105 hover:bg-primary-hover"
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
  'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50';
export const adminButtonSecondary =
  'rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-content hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50';
export const adminButtonDanger =
  'rounded-md border border-red-300 bg-surface px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50';
export const adminInput =
  'w-full rounded-md border border-line px-3 py-2 text-sm outline-none placeholder:text-content-muted focus:border-primary focus:ring-1 focus:ring-primary';
export const adminLabel =
  'mb-1.5 block text-xs font-medium uppercase tracking-wider text-content-soft';
export const adminCard =
  'rounded-2xl border border-line bg-surface p-6 shadow-sm';
