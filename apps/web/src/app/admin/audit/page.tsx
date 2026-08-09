'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AuditListResponse } from '@/lib/phase10-types';
import {
  AdminShell,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

export default function AuditAdminPage() {
  const [data, setData] = useState<AuditListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(to).toISOString());
    params.set('page', String(page));
    params.set('pageSize', '50');
    const res = await apiFetch<AuditListResponse>(`/admin/audit?${params}`);
    if (res.ok && res.data) setData(res.data);
    setLoading(false);
  }, [action, from, to, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminShell title="Audit log">
      <p className="mb-4 text-sm text-content-soft">
        Every admin action, every member auth event, every system flip
        (drop launches, article scheduler, settings updates) lands here.
      </p>

      <div className={`${adminCard} mb-4`}>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className={adminLabel}>Action</label>
            <input
              list="actions-datalist"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. brand.update"
              className={adminInput}
            />
            <datalist id="actions-datalist">
              {data?.actions.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={adminLabel}>Actor email (info only)</label>
            <input
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              placeholder="-"
              className={adminInput}
              disabled
            />
          </div>
          <div>
            <label className={adminLabel}>From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className={adminInput}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-content-soft">
            {data?.total ?? 0} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAction('');
                setFrom('');
                setTo('');
                setActorEmail('');
                setPage(1);
              }}
              className={adminButtonSecondary}
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div className={adminCard}>
        {loading ? (
          <p className="text-sm text-content-soft">Loading…</p>
        ) : !data || data.data.length === 0 ? (
          <p className="text-sm text-content-soft">No matching entries.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-content-soft">
                <th className="px-2 pb-3 font-medium">Time</th>
                <th className="px-2 pb-3 font-medium">Actor</th>
                <th className="px-2 pb-3 font-medium">Action</th>
                <th className="px-2 pb-3 font-medium">Target</th>
                <th className="px-2 pb-3 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 align-top">
                  <td className="px-2 py-2 text-xs text-content-soft">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {row.actor
                      ? `${row.actor.email}`
                      : row.actorId
                        ? '(deleted)'
                        : '-'}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{row.action}</td>
                  <td className="px-2 py-2 text-xs text-content-soft">
                    {row.targetType ? (
                      <>
                        {row.targetType}
                        {row.targetId && (
                          <span className="ml-1 font-mono text-content-muted">
                            /{row.targetId.slice(0, 12)}…
                          </span>
                        )}
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="max-w-[480px] px-2 py-2 text-xs text-content-soft">
                    {row.metadata ? (
                      <code className="block truncate font-mono">
                        {JSON.stringify(row.metadata)}
                      </code>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={adminButtonSecondary}
            >
              ← Previous
            </button>
            <span className="text-content-soft">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className={adminButtonSecondary}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
