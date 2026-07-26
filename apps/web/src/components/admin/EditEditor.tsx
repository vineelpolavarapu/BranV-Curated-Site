'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { EditAdmin, EditStatus, ProductLite } from '@/lib/phase7-types';
import { MultiProductPicker } from './MultiProductPicker';
import {
  adminButtonPrimary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

interface Props {
  edit?: EditAdmin;
}

export function EditEditor({ edit }: Props) {
  const router = useRouter();
  const editing = !!edit;

  const [title, setTitle] = useState(edit?.title ?? '');
  const [slug, setSlug] = useState(edit?.slug ?? '');
  const [heroUrl, setHeroUrl] = useState(edit?.heroUrl ?? '');
  const [description, setDescription] = useState(edit?.description ?? '');
  const [status, setStatus] = useState<EditStatus>(edit?.status ?? 'DRAFT');
  const [isFeaturedOnHome, setIsFeaturedOnHome] = useState(
    edit?.isFeaturedOnHome ?? false,
  );
  const [products, setProducts] = useState<ProductLite[]>(
    (edit?.editProducts ?? []).map((ep) => ep.product),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFlash(null);

    const body = {
      title,
      slug: slug || undefined,
      heroUrl: heroUrl || undefined,
      description: description || undefined,
      status,
      isFeaturedOnHome,
      productIds: products.map((p) => p.id),
    };

    const result = editing
      ? await apiFetch<EditAdmin>(`/admin/edits/${edit!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch<EditAdmin>('/admin/edits', {
          method: 'POST',
          body: JSON.stringify(body),
        });

    setSubmitting(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Save failed');
      return;
    }
    if (!editing) {
      router.replace(`/admin/edits/${result.data.id}`);
      router.refresh();
    } else {
      setFlash(`✓ Saved · ${result.data.status}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className={adminCard}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={adminLabel}>Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated from title"
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EditStatus)}
              className={adminInput}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={adminLabel}>Hero image URL</label>
            <input
              type="url"
              value={heroUrl}
              onChange={(e) => setHeroUrl(e.target.value)}
              className={adminInput}
            />
          </div>
          <div className="md:col-span-2">
            <label className={adminLabel}>Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={adminInput}
            />
          </div>
          <label className="md:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isFeaturedOnHome}
              onChange={(e) => setIsFeaturedOnHome(e.target.checked)}
            />
            Featured on home page (replaces any other featured edit)
          </label>
        </div>
      </div>

      <div className={adminCard}>
        <MultiProductPicker
          value={products}
          onChange={setProducts}
          label="Edit products"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {flash && <p className="text-sm text-success">{flash}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className={adminButtonPrimary}>
          {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create edit'}
        </button>
      </div>
    </form>
  );
}
