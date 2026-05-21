'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { EditAdmin, EditStatus } from '@/lib/phase7-types';
import { Page } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
} from '@/components/AdminShell';

const STATUSES: Array<EditStatus | ''> = ['', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];

export default function EditsAdminPage() {
  const [edits, setEdits] = useState<EditAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EditStatus | ''>('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('pageSize', '40');
    const res = await apiFetch<Page<EditAdmin>>(`/admin/edits?${params}`);
    if (res.ok && res.data) {
      setEdits(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onArchive(id: string) {
    if (!confirm('Archive this edit?')) return;
    const res = await apiFetch(`/admin/edits/${id}`, { method: 'DELETE' });
    if (res.ok) await refresh();
    else alert(res.error ?? 'Failed to archive');
  }

  return (
    <AdminShell
      title="The Edit"
      actions={
        <Link href="/admin/edits/new" className={adminButtonPrimary}>
          + New edit
        </Link>
      }
    >
      <p className="mb-4 text-sm text-neutral-600">
        Curated themed collections. Toggle <strong>Featured on home</strong> to surface one in the home page slot (at most one at a time).
      </p>

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
            onChange={(e) => setStatus(e.target.value as EditStatus | '')}
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
        ) : edits.length === 0 ? (
          <p className="text-sm text-neutral-500">No edits yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-2 pb-3 font-medium">Edit</th>
                <th className="px-2 pb-3 font-medium">Status</th>
                <th className="px-2 pb-3 font-medium">Products</th>
                <th className="px-2 pb-3 font-medium">Featured</th>
                <th className="px-2 pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {edits.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100">
                  <td className="px-2 py-3">
                    <Link href={`/admin/edits/${e.id}`} className="font-medium hover:underline">
                      {e.title}
                    </Link>
                    <p className="text-xs text-neutral-500">/{e.slug}</p>
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        e.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-800'
                          : e.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-200 text-neutral-700'
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-neutral-600">{e._count?.editProducts ?? 0}</td>
                  <td className="px-2 py-3 text-neutral-600">
                    {e.isFeaturedOnHome ? '★' : '—'}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {/* <Link
                        href={`/admin/edits/${e.id}`}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                      >
                        Edit
                      </Link> */}
                      {e.status === 'PUBLISHED' && (
                        <a
                          href={`/edits/${e.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                        >
                          View ↗
                        </a>
                      )}
                      {e.status !== 'ARCHIVED' && (
                        <button onClick={() => onArchive(e.id)} className={adminButtonDanger}>
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
