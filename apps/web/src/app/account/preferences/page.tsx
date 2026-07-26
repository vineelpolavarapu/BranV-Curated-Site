'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  NotificationChannel,
  NotificationPreference,
  NotificationType,
} from '@/lib/phase8-types';
import { StorefrontShell } from '@/components/StorefrontShell';

// Member-facing types only — admin-only types are filtered out.
const TYPES: Array<{ key: NotificationType; label: string }> = [
  { key: 'WELCOME', label: 'Welcome & onboarding' },
  { key: 'WISHLIST_PRICE_DROP', label: 'Price drops on wishlist items' },
  { key: 'NEW_ARTICLE', label: 'New articles' },
  { key: 'REVIEW_HIDDEN', label: 'Review moderation updates' },
  { key: 'GENERIC', label: 'Other notifications' },
];

const CHANNELS: Array<{ key: NotificationChannel; label: string }> = [
  { key: 'IN_APP', label: 'In-app' },
  { key: 'EMAIL', label: 'Email' },
];

export default function PreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<NotificationPreference[]>(
      '/notification-preferences',
    );
    if (res.status === 401 || res.status === 403) {
      router.replace('/login?next=/account/preferences');
      return;
    }
    if (res.ok && res.data) setPrefs(res.data);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const lookup = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const p of prefs) m.set(`${p.type}|${p.channel}`, p.enabled);
    return m;
  }, [prefs]);

  async function onToggle(
    type: NotificationType,
    channel: NotificationChannel,
    nextEnabled: boolean,
  ) {
    // Optimistic.
    setPrefs((prev) => {
      const others = prev.filter(
        (p) => !(p.type === type && p.channel === channel),
      );
      return [
        ...others,
        {
          id: `${type}-${channel}-tmp`,
          type,
          channel,
          enabled: nextEnabled,
        },
      ];
    });
    const res = await apiFetch('/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ type, channel, enabled: nextEnabled }),
    });
    if (!res.ok) await load();
  }

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Notification preferences</h1>
        <p className="mt-1 text-sm text-content-soft">
          Pick which notifications reach you, and how. Defaults are on for
          everything until you turn them off.
        </p>

        {loading ? (
          <div className="mt-8 h-2 w-32 animate-pulse rounded bg-line" />
        ) : (
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-content-soft">
                <th className="pb-3 font-medium">Notification</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} className="pb-3 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TYPES.map((t) => (
                <tr key={t.key} className="border-b border-neutral-100">
                  <td className="py-3">{t.label}</td>
                  {CHANNELS.map((c) => {
                    const key = `${t.key}|${c.key}`;
                    // Default true if no row exists.
                    const enabled = lookup.has(key) ? lookup.get(key)! : true;
                    return (
                      <td key={c.key} className="py-3">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              onToggle(t.key, c.key, e.target.checked)
                            }
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-6 text-xs text-content-soft">
          Email-only notifications still send if you turn off in-app for the
          same type, and vice versa. Channels are independent.
        </p>
      </section>
    </StorefrontShell>
  );
}
