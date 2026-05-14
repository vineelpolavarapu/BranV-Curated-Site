'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { DropAdmin, DropStatus, ProductLite } from '@/lib/phase7-types';
import { MultiProductPicker } from './MultiProductPicker';
import {
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

interface Props {
  drop?: DropAdmin;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DropEditor({ drop }: Props) {
  const router = useRouter();
  const editing = !!drop;

  const [name, setName] = useState(drop?.name ?? '');
  const [slug, setSlug] = useState(drop?.slug ?? '');
  const [heroUrl, setHeroUrl] = useState(drop?.heroUrl ?? '');
  const [description, setDescription] = useState(drop?.description ?? '');
  const [launchAt, setLaunchAt] = useState(toLocalInput(drop?.launchAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(drop?.endsAt));
  const [status, setStatus] = useState<DropStatus>(drop?.status ?? 'SCHEDULED');
  const [products, setProducts] = useState<ProductLite[]>(
    (drop?.dropProducts ?? []).map((dp) => dp.product),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFlash(null);

    if (!launchAt) {
      setSubmitting(false);
      setError('Launch date is required');
      return;
    }

    const body = {
      name,
      slug: slug || undefined,
      heroUrl: heroUrl || undefined,
      description: description || undefined,
      launchAt: new Date(launchAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      status,
      productIds: products.map((p) => p.id),
    };

    const result = editing
      ? await apiFetch<DropAdmin>(`/admin/drops/${drop!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch<DropAdmin>('/admin/drops', {
          method: 'POST',
          body: JSON.stringify(body),
        });

    setSubmitting(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Save failed');
      return;
    }
    if (!editing) {
      router.replace(`/admin/drops/${result.data.id}`);
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
            <label className={adminLabel}>Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={adminInput}
              placeholder="Monsoon Capsule"
            />
          </div>
          <div>
            <label className={adminLabel}>Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated from name"
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DropStatus)}
              className={adminInput}
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="LIVE">Live</option>
              <option value="ENDED">Ended</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Scheduler auto-flips → LIVE at launch_at and → ENDED at ends_at.
            </p>
          </div>
          <div className="md:col-span-2">
            <label className={adminLabel}>Hero image URL</label>
            <input
              type="url"
              value={heroUrl}
              onChange={(e) => setHeroUrl(e.target.value)}
              placeholder="https://…"
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
          <div>
            <label className={adminLabel}>Launch at *</label>
            <input
              required
              type="datetime-local"
              value={launchAt}
              onChange={(e) => setLaunchAt(e.target.value)}
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Ends at (optional)</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={adminInput}
            />
          </div>
        </div>
      </div>

      <div className={adminCard}>
        <MultiProductPicker
          value={products}
          onChange={setProducts}
          label="Drop products"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {flash && <p className="text-sm text-emerald-700">{flash}</p>}

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={submitting} className={adminButtonPrimary}>
          {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create drop'}
        </button>
      </div>
    </form>
  );
}
