'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Banner, HomeBannerStatus } from '@/lib/phase7-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BannersAdminPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setLoading(true);
    const res = await apiFetch<Banner[]>('/admin/banners');
    if (res.ok && res.data) setBanners(res.data);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onDelete(id: string) {
    if (!confirm('Delete this banner?')) return;
    const res = await apiFetch(`/admin/banners/${id}`, { method: 'DELETE' });
    if (res.ok) await refresh();
  }

  const now = new Date();

  return (
    <AdminShell
      title="Home banners"
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className={adminButtonPrimary}
        >
          + New banner
        </button>
      }
    >
      <p className="mb-4 text-sm text-neutral-600">
        Banners with a schedule window appear on the home page only during
        their window. Active + no schedule = always shown.
      </p>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : banners.length === 0 ? (
        <div className={adminCard}>
          <p className="text-sm text-neutral-500">
            No banners. Click <strong>+ New banner</strong> to add one.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {banners.map((b) => {
            const active = isActiveNow(b, now);
            return (
              <li key={b.id} className={adminCard}>
                <div className="flex gap-4">
                  <div className="relative h-24 w-40 flex-none overflow-hidden rounded bg-neutral-100">
                    {b.imageUrl ? (
                      <Image
                        src={b.imageUrl}
                        alt={b.headline ?? ''}
                        fill
                        unoptimized
                        sizes="160px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{b.headline ?? '(no headline)'}</p>
                    {b.ctaLabel && (
                      <p className="text-xs text-neutral-500">
                        CTA: <strong>{b.ctaLabel}</strong> → {b.ctaLink}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">
                      Order: {b.displayOrder} · Status: {b.status}{' '}
                      {active ? (
                        <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-800">
                          showing now
                        </span>
                      ) : (
                        <span className="ml-1 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[9px] font-medium uppercase text-neutral-700">
                          not visible
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {b.startsAt
                        ? `From ${new Date(b.startsAt).toLocaleString()}`
                        : 'No start'}
                      {' · '}
                      {b.endsAt
                        ? `to ${new Date(b.endsAt).toLocaleString()}`
                        : 'no end'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  {/* <button
                    onClick={() => {
                      setEditing(b);
                      setShowForm(true);
                    }}
                    className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                  >
                    Edit
                  </button> */}
                  <button onClick={() => onDelete(b.id)} className={adminButtonDanger}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <BannerForm
          banner={editing}
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

function isActiveNow(b: Banner, now: Date): boolean {
  if (b.status !== 'ACTIVE') return false;
  if (b.startsAt && new Date(b.startsAt) > now) return false;
  if (b.endsAt && new Date(b.endsAt) < now) return false;
  return true;
}

function BannerForm({
  banner,
  onClose,
  onSaved,
}: {
  banner: Banner | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl ?? '');
  const [headline, setHeadline] = useState(banner?.headline ?? '');
  const [ctaLabel, setCtaLabel] = useState(banner?.ctaLabel ?? '');
  const [ctaLink, setCtaLink] = useState(banner?.ctaLink ?? '');
  const [displayOrder, setDisplayOrder] = useState(
    String(banner?.displayOrder ?? 0),
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.endsAt));
  const [status, setStatus] = useState<HomeBannerStatus>(
    banner?.status ?? 'ACTIVE',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = {
      imageUrl,
      headline: headline || undefined,
      ctaLabel: ctaLabel || undefined,
      ctaLink: ctaLink || undefined,
      displayOrder: Number(displayOrder) || 0,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      status,
    };
    const res = banner
      ? await apiFetch(`/admin/banners/${banner.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch('/admin/banners', {
          method: 'POST',
          body: JSON.stringify(body),
        });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Save failed');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            {banner ? 'Edit banner' : 'New banner'}
          </h2>
          <button onClick={onClose} className="text-neutral-400">✕</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={adminLabel}>Image URL</label>
            <input
              required
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={adminInput}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={adminLabel}>Headline</label>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>Display order</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>CTA label</label>
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                className={adminInput}
                placeholder="Shop now"
              />
            </div>
            <div>
              <label className={adminLabel}>CTA link</label>
              <input
                value={ctaLink}
                onChange={(e) => setCtaLink(e.target.value)}
                className={adminInput}
                placeholder="/drops/monsoon-capsule"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={adminLabel}>Starts at</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>Ends at</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={adminInput}
              />
            </div>
          </div>
          <div>
            <label className={adminLabel}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as HomeBannerStatus)}
              className={adminInput}
            >
              <option value="ACTIVE">Active</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </div>
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
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
