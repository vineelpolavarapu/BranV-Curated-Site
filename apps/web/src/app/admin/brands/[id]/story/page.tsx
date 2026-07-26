'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Brand } from '@/lib/admin-types';
import { BrandStory, BrandStoryStatus } from '@/lib/phase7-types';
import {
  AdminShell,
  adminButtonPrimary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

export default function BrandStoryAdminPage() {
  const params = useParams<{ id: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [story, setStory] = useState<BrandStory | null>(null);

  const [heroUrl, setHeroUrl] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [status, setStatus] = useState<BrandStoryStatus>('DRAFT');

  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [b, s] = await Promise.all([
        apiFetch<Brand>(`/admin/brands/${params.id}`),
        apiFetch<BrandStory | null>(`/admin/brands/${params.id}/story`),
      ]);
      if (b.ok && b.data) setBrand(b.data);
      if (s.ok && s.data) {
        setStory(s.data);
        setHeroUrl(s.data.heroUrl ?? '');
        setBodyMd(s.data.bodyMd);
        setStatus(s.data.status);
      }
    })();
  }, [params.id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFlash(null);
    const res = await apiFetch<BrandStory>(
      `/admin/brands/${params.id}/story`,
      {
        method: 'PUT',
        body: JSON.stringify({
          heroUrl: heroUrl || null,
          bodyMd,
          status,
        }),
      },
    );
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Save failed');
      return;
    }
    if (res.data) setStory(res.data);
    setFlash('✓ Saved');
  }

  return (
    <AdminShell title={brand ? `${brand.name} — Story` : 'Brand story'}>
      <p className="mb-4 text-sm text-content-soft">
        <Link href="/admin/brands" className="hover:text-primary">
          ← Back to brands
        </Link>
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className={adminCard}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={adminLabel}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BrandStoryStatus)}
                className={adminInput}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
              <p className="mt-1 text-xs text-content-soft">
                Only PUBLISHED stories show on the brand page.
              </p>
            </div>
            <div>
              <label className={adminLabel}>Hero image URL</label>
              <input
                type="url"
                value={heroUrl}
                onChange={(e) => setHeroUrl(e.target.value)}
                className={adminInput}
              />
            </div>
          </div>
        </div>

        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-soft">
            Body (Markdown)
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              rows={18}
              spellCheck
              className={`${adminInput} font-mono text-sm`}
              placeholder="# About the brand&#10;&#10;Founded in…"
            />
            <div className="overflow-auto rounded-md border border-line bg-surface p-4">
              <div className="prose prose-sm prose-neutral max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {bodyMd || '_Preview will appear here._'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-content-soft">
            Raw HTML is stripped on the public page (XSS-safe). Use plain
            Markdown — headings, lists, links, bold, italic, tables.
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {flash && <p className="text-sm text-success">{flash}</p>}

        <div className="flex items-center justify-between">
          {story && brand?.slug && (
            <a
              href={`/brands/${brand.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-content-soft hover:text-primary"
            >
              View public brand page ↗
            </a>
          )}
          <button type="submit" disabled={submitting} className={adminButtonPrimary}>
            {submitting ? 'Saving…' : 'Save story'}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
