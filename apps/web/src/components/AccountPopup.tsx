'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, CurrentUser } from '@/lib/api';
import { Icon } from './icons';

const MENU_ITEMS = [
  {
    label: 'Account Info',
    href: '/account',
    icon: <Icon.Account size={16} strokeWidth={1.6} aria-hidden />,
  },
  {
    label: 'Wishlist',
    href: '/wishlist',
    icon: <Icon.Wishlist size={16} strokeWidth={1.6} aria-hidden />,
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
    ? 'border-primary-fg/50 text-primary-fg hover:bg-primary-fg/10'
    : 'border-line text-content-soft hover:bg-surface-muted';

  const panelClasses = overlay
    ? 'border border-primary-fg/40 bg-transparent'
    : 'border border-line bg-surface shadow-2xl';

  const nameClasses = overlay ? 'text-primary-fg' : 'text-content';
  const emailClasses = overlay ? 'text-primary-fg/60' : 'text-content-soft';
  const dividerClasses = overlay ? 'border-primary-fg/20' : 'border-line';
  const itemClasses = overlay
    ? 'text-primary-fg hover:bg-primary-fg/10'
    : 'text-content-soft hover:bg-surface-muted hover:text-content';
  const iconClasses = overlay ? 'text-primary-fg/50' : 'text-content-muted';
  const skeletonClasses = overlay ? 'bg-primary-fg/20' : 'bg-line';
  const signOutClasses = overlay
    ? 'text-red-300 hover:bg-primary-fg/10'
    : 'text-danger hover:bg-red-50';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        aria-expanded={open}
        className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${triggerClasses}`}
      >
        <Icon.Account size={20} strokeWidth={1.6} aria-hidden />
      </button>

      {open && (
        <div className={`absolute right-0 top-full z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-xl ${panelClasses}`}>
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tracking-wide ${overlay ? 'bg-white/20 text-white' : 'bg-primary text-white shadow-sm'}`}>
              {initials ? initials : <Icon.Account size={20} strokeWidth={1.8} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-bold ${nameClasses}`}>
                {displayName ? displayName : 'My Account'}
              </p>
              <p className={`truncate text-xs ${emailClasses}`}>
                {me?.email ? me.email : 'Sign in to manage profile'}
              </p>
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
              <Icon.Logout size={16} strokeWidth={1.6} aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
