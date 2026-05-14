'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { DropAdmin, DropStatus } from '@/lib/phase7-types';
import { Page } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
} from '@/components/AdminShell';

const STATUSES: Array<DropStatus | ''> = ['', 'SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED'];

export default function DropsAdminPage() {
  const [drops, setDrops] = useState<DropAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DropStatus | ''>('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('pageSize', '40');
    const res = await apiFetch<Page<DropAdmin>>(`/admin/drops?${params}`);
    if (res.ok && res.data) {
      setDrops(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onArchive(id: string) {
    if (!confirm('Archive this drop?')) return;
    const res = await apiFetch(`/admin/drops/${id}`, { method: 'DELETE' });
    if (res.ok) await refresh();
    else alert(res.error ?? 'Failed to archive');
  }

  return (
    <AdminShell
      title="Drops"
      actions={
        <Link href="/admin/drops/new" className={adminButtonPrimary}>
          + New drop
        </Link>
      }
    >
      <div className={`${adminCard} mb-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / slug…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void refresh();
            }}
            className={`${adminInput} max-w-xs`}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DropStatus | '')}
            className={`${adminInput} max-w-[160px]`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === '' ? 'All statuses' : s}</option>
            ))}
          </select>
          <button onClick={refresh} className={adminButtonSecondary}>Apply</button>
          <span className="ml-auto text-sm text-neutral-500">{total} total</span>
        </div>
      </div>

      <div className={adminCard}>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : drops.length === 0 ? (
          <p className="text-sm text-neutral-500">No drops yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-2 pb-3 font-medium">Drop</th>
                <th className="px-2 pb-3 font-medium">Status</th>
                <th className="px-2 pb-3 font-medium">Launch</th>
                <th className="px-2 pb-3 font-medium">Ends</th>
                <th className="px-2 pb-3 font-medium">Products</th>
                <th className="px-2 pb-3 font-medium">Signups</th>
                <th className="px-2 pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {drops.map((d) => (
                <tr key={d.id} className="border-b border-neutral-100">
                  <td className="px-2 py-3">
                    <Link href={`/admin/drops/${d.id}`} className="font-medium hover:underline">
                      {d.name}
                    </Link>
                    <p className="text-xs text-neutral-500">/{d.slug}</p>
                  </td>
                  <td className="px-2 py-3"><StatusPill status={d.status} /></td>
                  <td className="px-2 py-3 text-xs text-neutral-600">
                    {new Date(d.launchAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-3 text-xs text-neutral-600">
                    {d.endsAt ? new Date(d.endsAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-2 py-3 text-neutral-600">{d._count?.dropProducts ?? 0}</td>
                  <td className="px-2 py-3 text-neutral-600">{d._count?.notifySignups ?? 0}</td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/drops/${d.id}`}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                      >
                        Edit
                      </Link>
                      {d.status === 'LIVE' && (
                        <a
                          href={`/drops/${d.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                        >
                          View ↗
                        </a>
                      )}
                      {d.status !== 'ARCHIVED' && (
                        <button onClick={() => onArchive(d.id)} className={adminButtonDanger}>
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function StatusPill({ status }: { status: DropStatus }) {
  const tone =
    status === 'LIVE'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'SCHEDULED'
        ? 'bg-blue-100 text-blue-800'
        : status === 'ENDED'
          ? 'bg-neutral-200 text-neutral-700'
          : 'bg-red-100 text-red-700';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}
