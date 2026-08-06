'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/lib/admin-types';
import { useAdminBrands, useDeleteAdminBrand } from '@/hooks/use-admin-data';
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
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Brand | null>(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useAdminBrands(search);
  const deleteBrandMutation = useDeleteAdminBrand();

  const brands = data?.data ?? [];
  const total = data?.total ?? 0;

  async function onDelete(id: string) {
    if (!confirm('Archive this brand? It will be hidden but click history preserved.')) return;
    try {
      await deleteBrandMutation.mutateAsync(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to archive';
      alert(message);
    }
  }

  function handleSaveSuccess() {
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] });
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
          + Add brand
        </button>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Search brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${adminInput} max-w-xs`}
          />
          <p className="text-xs text-content-soft">
            Total: <span className="font-semibold text-content">{total}</span>
          </p>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-content-soft">Loading brands…</p>
        ) : brands.length === 0 ? (
          <p className="py-8 text-center text-sm text-content-soft">No brands found.</p>
        ) : (
          <div className={`${adminCard} overflow-hidden`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs font-semibold uppercase tracking-wider text-content-soft">
                <tr>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {brands.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3 font-medium text-content">
                      <div className="flex items-center gap-3">
                        {b.logoUrl ? (
                          <Image
                            src={b.logoUrl}
                            alt={b.name}
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-content-soft">
                            {b.name[0]}
                          </div>
                        )}
                        <span>{b.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-content-soft">{b.slug}</td>
                    <td className="px-4 py-3 text-content-soft">{b.isFeatured ? 'Featured' : 'Standard'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          b.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditing(b);
                            setShowForm(true);
                          }}
                          className={adminButtonSecondary}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(b.id)}
                          disabled={deleteBrandMutation.isPending}
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
          onClose={() => setShowForm(false)}
          onSaved={handleSaveSuccess}
        />
      )}
    </AdminShell>
  );
}
