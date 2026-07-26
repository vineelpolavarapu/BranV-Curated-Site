'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { LookbookAdmin, LookbookStatus } from '@/lib/phase7-types';
import { Page } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
} from '@/components/AdminShell';

const STATUSES: Array<LookbookStatus | ''> = ['', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];

export default function LookbooksAdminPage() {
  const [items, setItems] = useState<LookbookAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LookbookStatus | ''>('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('pageSize', '40');
    const res = await apiFetch<Page<LookbookAdmin>>(`/admin/lookbooks?${params}`);
    if (res.ok && res.data) {
      setItems(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onArchive(id: string) {
    if (!confirm('Archive this lookbook?')) return;
    const res = await apiFetch(`/admin/lookbooks/${id}`, { method: 'DELETE' });
    if (res.ok) await refresh();
  }

  return (
    <AdminShell
      title="Lookbooks"
      actions={
        <Link href="/admin/lookbooks/new" className={adminButtonPrimary}>
          + New lookbook
        </Link>
      }
    >
      <div className={`${adminCard} mb-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title / slug…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void refresh();
            }}
            className={`${adminInput} max-w-xs`}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LookbookStatus | '')}
            className={`${adminInput} max-w-[160px]`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === '' ? 'All statuses' : s}</option>
            ))}
          </select>
          <button onClick={refresh} className={adminButtonSecondary}>Apply</button>
          <span className="ml-auto text-sm text-content-soft">{total} total</span>
        </div>
      </div>

      <div className={adminCard}>
        {loading ? (
          <p className="text-sm text-content-soft">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-content-soft">No lookbooks yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-content-soft">
                <th className="px-2 pb-3 font-medium">Lookbook</th>
                <th className="px-2 pb-3 font-medium">Status</th>
                <th className="px-2 pb-3 font-medium">Images</th>
                <th className="px-2 pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-b border-neutral-100">
                  <td className="px-2 py-3">
                    <Link href={`/admin/lookbooks/${l.id}`} className="font-medium hover:underline">
                      {l.title}
                    </Link>
                    <p className="text-xs text-content-soft">/{l.slug}</p>
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        l.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-800'
                          : l.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-line text-content-soft'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-content-soft">{l._count?.images ?? 0}</td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {/* <Link
                        href={`/admin/lookbooks/${l.id}`}
                        className="text-sm font-medium text-content-soft hover:text-primary"
                      >
                        Edit
                      </Link> */}
                      {l.status === 'PUBLISHED' && (
                        <a
                          href={`/lookbooks/${l.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-content-soft hover:text-primary"
                        >
                          View ↗
                        </a>
                      )}
                      {l.status !== 'ARCHIVED' && (
                        <button onClick={() => onArchive(l.id)} className={adminButtonDanger}>
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
