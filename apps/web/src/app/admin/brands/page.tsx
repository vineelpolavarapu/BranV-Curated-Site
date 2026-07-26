'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { Brand, Page } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
} from '@/components/AdminShell';
import { BrandFormModal } from '@/components/BrandFormModal';

export default function BrandsAdminPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('pageSize', '50');
    const result = await apiFetch<Page<Brand>>(`/admin/brands?${params}`);
    if (result.ok && result.data) {
      setBrands(result.data.data);
      setTotal(result.data.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(id: string) {
    if (!confirm('Archive this brand? It will be hidden but click history preserved.')) return;
    const result = await apiFetch(`/admin/brands/${id}`, { method: 'DELETE' });
    if (result.ok) await refresh();
    else alert(result.error ?? 'Failed to archive');
  }

  return (
    <AdminShell
      title="Brands"
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className={adminButtonPrimary}
        >
          + New brand
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <input
          type="search"
          placeholder="Search brands…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void refresh();
          }}
          className={`${adminInput} max-w-sm`}
        />
        <button onClick={refresh} className={adminButtonSecondary}>
          Search
        </button>
        <span className="ml-auto text-sm text-content-soft">{total} total</span>
      </div>

      <div className={adminCard}>
        {loading ? (
          <p className="text-sm text-content-soft">Loading…</p>
        ) : brands.length === 0 ? (
          <p className="text-sm text-content-soft">
            No brands yet. Click <strong>+ New brand</strong> to add one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-content-soft">
                  <th className="px-2 pb-3 font-medium">Brand</th>
                  <th className="px-2 pb-3 font-medium">Products</th>
                  <th className="px-2 pb-3 font-medium">Status</th>
                  <th className="px-2 pb-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-b border-neutral-100">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        {b.logoUrl ? (
                          <Image
                            src={b.logoUrl}
                            alt=""
                            width={32}
                            height={32}
                            unoptimized
                            className="h-8 w-8 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 shrink-0 rounded bg-line" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{b.name}</p>
                          <p className="truncate text-xs text-content-soft">{b.slug}</p>
                        </div>
                        {b.isFeatured && (
                          <span className="ml-1 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                            Featured
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-content-soft">
                      {b._count?.products ?? 0}
                    </td>
                    <td className="px-2 py-3">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/admin/brands/${b.id}/story`}
                          aria-label="Brand story"
                          title="Story"
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-content-soft hover:bg-surface-muted hover:text-primary"
                        >
                          <svg width="14" height="14" viewBox="0 0 4 16" fill="currentColor" aria-hidden>
                            <circle cx="2" cy="2" r="1.5" />
                            <circle cx="2" cy="8" r="1.5" />
                            <circle cx="2" cy="14" r="1.5" />
                          </svg>
                        </a>
                        {/* <button
                          onClick={() => {
                            setEditing(b);
                            setShowForm(true);
                          }}
                          className="text-sm font-medium text-content-soft hover:text-primary"
                        >
                          Edit
                        </button> */}
                        <button
                          onClick={() => onDelete(b.id)}
                          className={adminButtonDanger}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <BrandFormModal
          brand={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </AdminShell>
  );
}

function StatusPill({ status }: { status: Brand['status'] }) {
  const tone =
    status === 'ACTIVE'
      ? 'bg-green-100 text-green-800'
      : status === 'HIDDEN'
        ? 'bg-line text-content-soft'
        : 'bg-red-100 text-red-700';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}

