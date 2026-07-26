'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { NotificationsPage } from '@/lib/phase8-types';
import { Icon } from '../icons';

const POLL_MS = 60_000;

export function NotificationsBell() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<NotificationsPage | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    async function tick() {
      const res = await apiFetch<{ count: number }>(
        '/notifications/unread-count',
      );
      if (!active) return;
      if (res.status === 401 || res.status === 403) {
        setSignedIn(false);
        return;
      }
      if (res.ok && res.data) {
        setSignedIn(true);
        setUnread(res.data.count);
      }
    }
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !recent) {
      const res = await apiFetch<NotificationsPage>(
        '/notifications?pageSize=8',
      );
      if (res.ok && res.data) setRecent(res.data);
    }
  }

  async function onMarkAllRead() {
    await apiFetch('/notifications/read-all', { method: 'POST' });
    setUnread(0);
    const res = await apiFetch<NotificationsPage>('/notifications?pageSize=8');
    if (res.ok && res.data) setRecent(res.data);
  }

  if (!signedIn) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unread > 0
            ? `Notifications (${unread} unread)`
            : 'Notifications'
        }
        className="relative grid h-9 w-9 place-items-center rounded-full text-content-soft hover:bg-surface-muted"
      >
        <Icon.Notifications size={20} strokeWidth={1.5} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-fg">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
          <header className="flex items-center justify-between border-b border-line px-4 py-2 text-xs">
            <span className="font-medium uppercase tracking-wider text-content-soft">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="font-medium text-content-soft hover:text-primary"
              >
                Mark all read
              </button>
            )}
          </header>
          {!recent ? (
            <div className="px-4 py-8 text-center text-sm text-content-soft">
              Loading…
            </div>
          ) : recent.data.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-content-soft">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-auto text-sm">
              {recent.data.map((n) => (
                <li
                  key={n.id}
                  className={n.readAt ? 'bg-surface' : 'bg-primary/5'}
                >
                  <NotificationRow notification={n} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line bg-surface-muted px-3 py-2 text-right">
            <Link
              href="/account/notifications"
              className="text-xs font-medium text-content-soft hover:text-primary"
              onClick={() => setOpen(false)}
            >
              See all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
}: {
  notification: NotificationsPage['data'][number];
}) {
  const title = (notification.payload?.title as string) ?? 'Notification';
  const body = (notification.payload?.body as string) ?? '';
  const link = (notification.payload?.link as string) ?? null;
  const inner = (
    <div className="px-4 py-3">
      <p className="font-medium text-content">{title}</p>
      {body && (
        <p className="mt-0.5 line-clamp-2 text-xs text-content-soft">{body}</p>
      )}
      <p className="mt-1 text-[10px] uppercase tracking-wider text-content-muted">
        {new Date(notification.createdAt).toLocaleString()}
      </p>
    </div>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}
