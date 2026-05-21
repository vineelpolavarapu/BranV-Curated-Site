'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, CurrentUser } from '@/lib/api';

const MENU_ITEMS = [
  {
    label: 'Account Info',
    href: '/account',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c.8-3.5 4-5.5 7.5-5.5s6.7 2 7.5 5.5" />
      </svg>
    ),
  },
  {
    label: 'My Orders',
    href: '/orders',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    label: 'Wishlist',
    href: '/wishlist',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s-7-4.5-9-9.5C1 6 6 3 9 6c1 1 3 2 3 2s2-1 3-2c3-3 8 0 6 5.5C19 16.5 12 21 12 21z" />
      </svg>
    ),
  },
  {
    label: 'Archive',
    href: '/account/archive',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/account/settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function AccountPopup({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    apiFetch<CurrentUser>('/auth/me').then((result) => {
      if (result.ok && result.data) setMe(result.data);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function onSignOut() {
    await apiFetch('/auth/logout', { method: 'POST' });
    setOpen(false);
    router.replace('/');
    router.refresh();
  }

  const initials = me
    ? (
        [me.profile?.firstName?.[0], me.profile?.lastName?.[0]]
          .filter(Boolean)
          .join('')
          .toUpperCase() || me.email[0].toUpperCase()
      )
    : null;

  const displayName = me
    ? [me.profile?.firstName, me.profile?.lastName].filter(Boolean).join(' ') || me.email
    : null;

  const triggerClasses = overlay
    ? 'border-white/50 text-white hover:bg-white/10'
    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100';

  const panelClasses = overlay
    ? 'border border-white/40 bg-transparent'
    : 'border border-neutral-200 bg-white shadow-2xl';

  const nameClasses = overlay ? 'text-white' : 'text-neutral-900';
  const emailClasses = overlay ? 'text-white/60' : 'text-neutral-500';
  const dividerClasses = overlay ? 'border-white/20' : 'border-neutral-100';
  const itemClasses = overlay
    ? 'text-white hover:bg-white/10'
    : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900';
  const iconClasses = overlay ? 'text-white/50' : 'text-neutral-400';
  const skeletonClasses = overlay ? 'bg-white/20' : 'bg-neutral-200';
  const signOutClasses = overlay
    ? 'text-red-300 hover:bg-white/10'
    : 'text-red-600 hover:bg-red-50';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        aria-expanded={open}
        className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${triggerClasses}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4.5 20c.8-3.5 4-5.5 7.5-5.5s6.7 2 7.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className={`absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl ${panelClasses}`}>
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            {initials ? (
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold tracking-wide ${overlay ? 'bg-white/20 text-white' : 'bg-neutral-900 text-white'}`}>
                {initials}
              </div>
            ) : (
              <div className={`h-10 w-10 shrink-0 animate-pulse rounded-full ${skeletonClasses}`} />
            )}
            <div className="min-w-0 flex-1">
              {displayName ? (
                <>
                  <p className={`truncate text-sm font-semibold ${nameClasses}`}>{displayName}</p>
                  <p className={`truncate text-xs ${emailClasses}`}>{me?.email}</p>
                </>
              ) : (
                <>
                  <div className={`h-3.5 w-24 animate-pulse rounded ${skeletonClasses}`} />
                  <div className={`mt-1.5 h-3 w-32 animate-pulse rounded ${skeletonClasses}`} />
                </>
              )}
            </div>
          </div>

          <div className={`border-t ${dividerClasses}`} />

          {/* Menu */}
          <nav className="p-1.5">
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${itemClasses}`}
              >
                <span className={iconClasses}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={`border-t ${dividerClasses} p-1.5`}>
            <button
              onClick={onSignOut}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition ${signOutClasses}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
