'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  adminLabel,
} from '@/components/AdminShell';

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
        <span className="ml-auto text-sm text-neutral-500">{total} total</span>
      </div>

      <div className={adminCard}>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : brands.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No brands yet. Click <strong>+ New brand</strong> to add one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-2 pb-3 font-medium">Brand</th>
                <th className="px-2 pb-3 font-medium">Country</th>
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
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-neutral-200" />
                      )}
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-neutral-500">{b.slug}</p>
                      </div>
                      {b.isFeatured && (
                        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                          Featured
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-neutral-600">{b.country ?? '—'}</td>
                  <td className="px-2 py-3 text-neutral-600">
                    {b._count?.products ?? 0}
                  </td>
                  <td className="px-2 py-3">
                    <StatusPill status={b.status} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`/admin/brands/${b.id}/story`}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                      >
                        Story
                      </a>
                      <button
                        onClick={() => {
                          setEditing(b);
                          setShowForm(true);
                        }}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                      >
                        Edit
                      </button>
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
        )}
      </div>

      {showForm && (
        <BrandForm
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
        ? 'bg-neutral-200 text-neutral-700'
        : 'bg-red-100 text-red-700';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}

function BrandForm({
  brand,
  onClose,
  onSaved,
}: {
  brand: Brand | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(brand?.name ?? '');
  const [slug, setSlug] = useState(brand?.slug ?? '');
  const [country, setCountry] = useState(brand?.country ?? '');
  const [foundedYear, setFoundedYear] = useState(
    brand?.foundedYear ? String(brand.foundedYear) : '',
  );
  const [description, setDescription] = useState(brand?.description ?? '');
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? '');
  const [heroUrl, setHeroUrl] = useState(brand?.heroUrl ?? '');
  const [isFeatured, setIsFeatured] = useState(brand?.isFeatured ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = {
      name,
      slug: slug || undefined,
      country: country || undefined,
      foundedYear: foundedYear ? Number(foundedYear) : undefined,
      description: description || undefined,
      logoUrl: logoUrl || undefined,
      heroUrl: heroUrl || undefined,
      isFeatured,
    };
    const result = brand
      ? await apiFetch(`/admin/brands/${brand.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch('/admin/brands', {
          method: 'POST',
          body: JSON.stringify(body),
        });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Save failed');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            {brand ? 'Edit brand' : 'New brand'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={adminLabel}>Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={adminInput}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={adminLabel}>Slug (optional)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated from name"
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>Country</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={adminInput}
              />
            </div>
          </div>
          <div>
            <label className={adminLabel}>Founded year</label>
            <input
              type="number"
              min={1700}
              max={2100}
              value={foundedYear}
              onChange={(e) => setFoundedYear(e.target.value)}
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              className={adminInput}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Upload via Quick Add modal in Phase 3, or paste a CDN URL here for now.
            </p>
          </div>
          <div>
            <label className={adminLabel}>Hero URL</label>
            <input
              type="url"
              value={heroUrl}
              onChange={(e) => setHeroUrl(e.target.value)}
              placeholder="https://…"
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={adminInput}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            Featured brand (rotates on home page)
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={adminButtonSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={adminButtonPrimary}
            >
              {submitting ? 'Saving…' : brand ? 'Save changes' : 'Create brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
