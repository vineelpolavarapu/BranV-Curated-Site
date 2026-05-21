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
                      {/* <button
                        onClick={() => {
                          setEditing(b);
                          setShowForm(true);
                        }}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
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
  const [description, setDescription] = useState(brand?.description ?? '');
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? '');
  const [heroUrl, setHeroUrl] = useState(brand?.heroUrl ?? '');
  const [logoUploading, setLogoUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [isFeatured, setIsFeatured] = useState(brand?.isFeatured ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(
    file: File,
    kind: 'brand-logo' | 'brand-hero',
  ): Promise<string | null> {
    const presign = await apiFetch<{ uploadUrl: string; publicUrl: string }>(
      '/uploads/presign',
      {
        method: 'POST',
        body: JSON.stringify({
          contentType: file.type,
          filename: file.name,
          kind,
        }),
      },
    );
    if (!presign.ok || !presign.data) {
      setError(presign.error ?? 'Could not get upload URL');
      return null;
    }
    const put = await fetch(presign.data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!put.ok) {
      setError(`Upload failed (${put.status})`);
      return null;
    }
    return presign.data.publicUrl;
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so picking the same file again still fires onChange
    if (!file) return;
    setError(null);
    setLogoUploading(true);
    try {
      const url = await uploadImage(file, 'brand-logo');
      if (url) setLogoUrl(url);
    } finally {
      setLogoUploading(false);
    }
  }

  async function onPickHero(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setHeroUploading(true);
    try {
      const url = await uploadImage(file, 'brand-hero');
      if (url) setHeroUrl(url);
    } finally {
      setHeroUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = {
      name,
      slug: slug || undefined,
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
          <div>
            <label className={adminLabel}>Slug (optional)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated from name"
              className={adminInput}
            />
          </div>
          <ImagePicker
            label="Logo"
            url={logoUrl}
            uploading={logoUploading}
            onPick={onPickLogo}
            onClear={() => setLogoUrl('')}
            previewClass="h-16 w-16 rounded object-cover"
          />
          <ImagePicker
            label="Hero image"
            url={heroUrl}
            uploading={heroUploading}
            onPick={onPickHero}
            onClear={() => setHeroUrl('')}
            previewClass="h-24 w-full rounded object-cover"
          />
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

function ImagePicker({
  label,
  url,
  uploading,
  onPick,
  onClear,
  previewClass,
}: {
  label: string;
  url: string;
  uploading: boolean;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  previewClass: string;
}) {
  return (
    <div>
      <label className={adminLabel}>{label}</label>
      {url ? (
        <div className="flex items-center gap-3">
          <Image
            src={url}
            alt={label}
            width={400}
            height={400}
            unoptimized
            className={previewClass}
          />
          <div className="flex flex-col gap-1">
            <label className="cursor-pointer text-sm font-medium text-neutral-700 hover:text-neutral-950">
              Replace
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                onChange={onPick}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={onClear}
              className="text-left text-sm text-red-700 hover:text-red-900"
            >
              Remove
            </button>
          </div>
          {uploading && (
            <span className="text-xs text-neutral-500">Uploading…</span>
          )}
        </div>
      ) : (
        <label
          className={`flex cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-600 hover:border-neutral-500 hover:text-neutral-900 ${
            uploading ? 'opacity-60' : ''
          }`}
        >
          {uploading ? 'Uploading…' : `Choose ${label.toLowerCase()} image`}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            onChange={onPick}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
