'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminReviewRow, ReviewStatus } from '@/lib/phase8-types';
import { Page } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonSecondary,
  adminCard,
} from '@/components/AdminShell';
import { Stars } from '@/components/reviews/ReviewsSection';

const STATUSES: Array<ReviewStatus | ''> = ['', 'PUBLISHED', 'HIDDEN'];

export default function AdminReviewsPage() {
  const [data, setData] = useState<AdminReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<ReviewStatus | ''>('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('pageSize', '50');
    const res = await apiFetch<Page<AdminReviewRow>>(
      `/admin/reviews?${params}`,
    );
    if (res.ok && res.data) {
      setData(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onHide(id: string) {
    const reason = prompt('Reason for hiding this review (visible in audit log):');
    if (!reason) return;
    const res = await apiFetch(`/admin/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'HIDDEN', reason }),
    });
    if (res.ok) await refresh();
    else alert(res.error ?? 'Failed to hide');
  }

  async function onRestore(id: string) {
    const res = await apiFetch(`/admin/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    if (res.ok) await refresh();
  }

  return (
    <AdminShell title="Reviews">
      <div className={`${adminCard} mb-4`}>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-content-soft">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReviewStatus | '')}
            className="rounded-md border border-line px-2 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All' : s}
              </option>
            ))}
          </select>
          <span className="ml-auto text-sm text-content-soft">{total} total</span>
        </div>
      </div>

      <div className={adminCard}>
        {loading ? (
          <p className="text-sm text-content-soft">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-content-soft">No reviews match.</p>
        ) : (
          <ul className="space-y-3">
            {data.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Stars value={r.rating} />
                      <Link
                        href={`/products/${r.product.slug}`}
                        target="_blank"
                        className="text-sm font-medium hover:underline"
                      >
                        {r.product.title}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          r.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.title && (
                      <p className="mt-1 text-sm font-medium">{r.title}</p>
                    )}
                    {r.body && (
                      <p className="mt-1 text-sm text-content-soft">{r.body}</p>
                    )}
                    <p className="mt-2 text-xs text-content-soft">
                      {r.user.email} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                    {r.status === 'HIDDEN' && r.moderationReason && (
                      <p className="mt-1 text-xs text-danger">
                        Hidden: {r.moderationReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {r.status === 'PUBLISHED' ? (
                      <button
                        onClick={() => onHide(r.id)}
                        className={adminButtonDanger}
                      >
                        Hide
                      </button>
                    ) : (
                      <button
                        onClick={() => onRestore(r.id)}
                        className={adminButtonSecondary}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
