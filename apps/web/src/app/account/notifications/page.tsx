'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { NotificationsPage } from '@/lib/phase8-types';
import { StorefrontShell } from '@/components/StorefrontShell';

export default function NotificationsCenterPage() {
  const router = useRouter();
  const [data, setData] = useState<NotificationsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: '50' });
    if (unreadOnly) params.set('unreadOnly', 'true');
    const res = await apiFetch<NotificationsPage>(
      `/notifications?${params}`,
    );
    if (res.status === 401 || res.status === 403) {
      router.replace('/login?next=/account/notifications');
      return;
    }
    if (res.ok) setData(res.data);
    setLoading(false);
  }, [router, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onMarkOneRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
    void load();
  }
  async function onMarkAllRead() {
    await apiFetch('/notifications/read-all', { method: 'POST' });
    void load();
  }

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-3xl px-6 py-10 grid grid-cols-1 gap-y-6">
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-content-soft">
              {data?.unread ?? 0} unread · {data?.total ?? 0} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              Unread only
            </label>
            {(data?.unread ?? 0) > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-sm font-medium text-content-soft hover:text-primary"
              >
                Mark all read
              </button>
            )}
            <Link
              href="/account/preferences"
              className="text-sm font-medium text-content-soft hover:text-primary"
            >
              Preferences →
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="h-2 w-32 animate-pulse rounded bg-line" />
        ) : !data || data.data.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface-muted p-10 text-center text-sm text-content-soft">
            Nothing here yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.data.map((n) => {
              const title = (n.payload?.title as string) ?? 'Notification';
              const body = (n.payload?.body as string) ?? '';
              const link = (n.payload?.link as string) ?? null;
              const isUnread = !n.readAt;
              const content = (
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                      isUnread ? 'bg-blue-500' : 'bg-line'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-content">{title}</p>
                    {body && (
                      <p className="mt-0.5 text-sm text-content-soft">{body}</p>
                    )}
                    <p className="mt-1 text-xs text-content-muted">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onMarkOneRead(n.id);
                      }}
                      className="text-xs text-content-soft underline hover:text-primary"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              );
              return (
                <li
                  key={n.id}
                  className={`rounded-xl border border-line p-4 ${
                    isUnread ? 'bg-blue-50/30' : 'bg-surface'
                  }`}
                >
                  {link ? <Link href={link}>{content}</Link> : content}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </StorefrontShell>
  );
}
