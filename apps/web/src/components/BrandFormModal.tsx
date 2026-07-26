'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { Brand } from '@/lib/admin-types';
import { adminButtonPrimary, adminButtonSecondary, adminInput, adminLabel } from './AdminShell';

export function BrandFormModal({
  brand,
  onClose,
  onSaved,
  zIndexClassName = 'z-40',
}: {
  brand: Brand | null;
  onClose: () => void;
  onSaved: (brand: Brand) => void;
  /** Bump above the caller's own overlay when nesting inside another modal. */
  zIndexClassName?: string;
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
      ? await apiFetch<Brand>(`/admin/brands/${brand.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch<Brand>('/admin/brands', {
          method: 'POST',
          body: JSON.stringify(body),
        });
    setSubmitting(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Save failed');
      return;
    }
    onSaved(result.data);
  }

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-content/40 p-4`}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            {brand ? 'Edit brand' : 'New brand'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-content-muted hover:text-primary"
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
          {error && <p className="text-sm text-danger">{error}</p>}
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
            <label className="cursor-pointer text-sm font-medium text-content-soft hover:text-primary">
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
            <span className="text-xs text-content-soft">Uploading…</span>
          )}
        </div>
      ) : (
        <label
          className={`flex cursor-pointer items-center justify-center rounded-md border border-dashed border-line px-3 py-4 text-sm text-content-soft hover:border-neutral-500 hover:text-primary ${
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
