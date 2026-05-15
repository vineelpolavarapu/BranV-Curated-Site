'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { NotificationsPage } from '@/lib/phase8-types';

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
        className="relative grid h-9 w-9 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 17h14l-1.6-2.4A6 6 0 0 1 17 11V9a5 5 0 0 0-10 0v2a6 6 0 0 1-.4 3.6L5 17z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M10 20a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-xs">
            <span className="font-medium uppercase tracking-wider text-neutral-500">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="font-medium text-neutral-700 hover:text-neutral-950"
              >
                Mark all read
              </button>
            )}
          </header>
          {!recent ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              Loading…
            </div>
          ) : recent.data.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-neutral-100 overflow-auto text-sm">
              {recent.data.map((n) => (
                <li
                  key={n.id}
                  className={n.readAt ? 'bg-white' : 'bg-blue-50/40'}
                >
                  <NotificationRow notification={n} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-right">
            <Link
              href="/account/notifications"
              className="text-xs font-medium text-neutral-700 hover:text-neutral-950"
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
      <p className="font-medium text-neutral-900">{title}</p>
      {body && (
        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{body}</p>
      )}
      <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-400">
        {new Date(notification.createdAt).toLocaleString()}
      </p>
    </div>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}
