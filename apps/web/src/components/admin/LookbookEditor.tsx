'use client';

import Image from 'next/image';
import { FormEvent, MouseEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { LookbookAdmin, LookbookStatus } from '@/lib/phase7-types';
import { Page, ProductRow } from '@/lib/admin-types';
import {
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

interface Props {
  lookbook?: LookbookAdmin;
}

interface DraftTag {
  productId: string;
  productTitle: string;
  productSlug: string;
  xPercent: number;
  yPercent: number;
}

interface DraftImage {
  imageUrl: string;
  position: number;
  tags: DraftTag[];
}

export function LookbookEditor({ lookbook }: Props) {
  const router = useRouter();
  const editing = !!lookbook;

  const [title, setTitle] = useState(lookbook?.title ?? '');
  const [slug, setSlug] = useState(lookbook?.slug ?? '');
  const [heroUrl, setHeroUrl] = useState(lookbook?.heroUrl ?? '');
  const [description, setDescription] = useState(lookbook?.description ?? '');
  const [status, setStatus] = useState<LookbookStatus>(
    lookbook?.status ?? 'DRAFT',
  );
  const [images, setImages] = useState<DraftImage[]>(
    (lookbook?.images ?? []).map((img) => ({
      imageUrl: img.imageUrl,
      position: img.position,
      tags: img.tags.map((t) => ({
        productId: t.productId,
        productTitle: t.product.title,
        productSlug: t.product.slug,
        xPercent: Number(t.xPercent),
        yPercent: Number(t.yPercent),
      })),
    })),
  );

  const [newImageUrl, setNewImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function addImage() {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [
      ...prev,
      { imageUrl: newImageUrl.trim(), position: prev.length, tags: [] },
    ]);
    setNewImageUrl('');
  }
  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }
  function addTag(imgIdx: number, tag: DraftTag) {
    setImages((prev) =>
      prev.map((img, i) =>
        i === imgIdx ? { ...img, tags: [...img.tags, tag] } : img,
      ),
    );
  }
  function removeTag(imgIdx: number, tagIdx: number) {
    setImages((prev) =>
      prev.map((img, i) =>
        i === imgIdx
          ? { ...img, tags: img.tags.filter((_, k) => k !== tagIdx) }
          : img,
      ),
    );
  }

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
      images: images.map((img, idx) => ({
        imageUrl: img.imageUrl,
        position: idx,
        tags: img.tags.map((t) => ({
          productId: t.productId,
          xPercent: t.xPercent,
          yPercent: t.yPercent,
        })),
      })),
    };
    const res = editing
      ? await apiFetch<LookbookAdmin>(`/admin/lookbooks/${lookbook!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch<LookbookAdmin>('/admin/lookbooks', {
          method: 'POST',
          body: JSON.stringify(body),
        });
    setSubmitting(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Save failed');
      return;
    }
    if (!editing) {
      router.replace(`/admin/lookbooks/${res.data.id}`);
      router.refresh();
    } else {
      setFlash('✓ Saved');
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
              placeholder="auto-generated"
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LookbookStatus)}
              className={adminInput}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={adminLabel}>Hero URL</label>
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
        </div>
      </div>

      <div className={adminCard}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-soft">
          Images & shoppable hotspots
        </h2>
        <p className="mb-3 text-xs text-content-soft">
          Click on an image to place a hotspot. The product picker opens; the
          tag lands at the click location as a percentage of width/height.
        </p>

        <div className="mb-4 flex items-center gap-2">
          <input
            type="url"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            placeholder="Lookbook image URL"
            className={adminInput}
          />
          <button type="button" onClick={addImage} className={adminButtonSecondary}>
            + Add image
          </button>
        </div>

        {images.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-surface-muted px-3 py-4 text-center text-xs text-content-soft">
            No images yet. Paste a URL above and click <strong>+ Add image</strong>.
          </p>
        ) : (
          <ul className="space-y-6">
            {images.map((img, idx) => (
              <li key={idx}>
                <LookbookImageEditor
                  image={img}
                  onAddTag={(t) => addTag(idx, t)}
                  onRemoveTag={(tagIdx) => removeTag(idx, tagIdx)}
                  onRemove={() => removeImage(idx)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {flash && <p className="text-sm text-success">{flash}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className={adminButtonPrimary}>
          {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create lookbook'}
        </button>
      </div>
    </form>
  );
}

function LookbookImageEditor({
  image,
  onAddTag,
  onRemoveTag,
  onRemove,
}: {
  image: DraftImage;
  onAddTag: (tag: DraftTag) => void;
  onRemoveTag: (tagIdx: number) => void;
  onRemove: () => void;
}) {
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);

  function onImageClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingClick({
      x: Math.max(0, Math.min(100, xPercent)),
      y: Math.max(0, Math.min(100, yPercent)),
    });
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-content-soft">
          {image.tags.length} hotspot{image.tags.length === 1 ? '' : 's'}
        </span>
        <button type="button" onClick={onRemove} className={adminButtonDanger}>
          Remove image
        </button>
      </div>
      <div
        onClick={onImageClick}
        className="relative aspect-[4/5] w-full max-w-md cursor-crosshair overflow-hidden rounded-lg bg-surface-muted"
        style={{ position: 'relative' }}
      >
        {image.imageUrl ? (
          <Image
            src={image.imageUrl}
            alt=""
            fill
            unoptimized
            sizes="500px"
            className="object-cover"
          />
        ) : null}
        {image.tags.map((t, idx) => (
          <button
            type="button"
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Remove hotspot for "${t.productTitle}"?`)) onRemoveTag(idx);
            }}
            title={t.productTitle}
            className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-primary text-xs font-semibold text-primary-fg shadow"
            style={{ left: `${t.xPercent}%`, top: `${t.yPercent}%` }}
          >
            {idx + 1}
          </button>
        ))}
        {pendingClick && (
          <span
            aria-hidden
            className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-emerald-500 bg-emerald-500/30"
            style={{ left: `${pendingClick.x}%`, top: `${pendingClick.y}%` }}
          />
        )}
      </div>
      {image.tags.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-content-soft">
          {image.tags.map((t, idx) => (
            <li key={idx}>
              <strong>{idx + 1}.</strong> {t.productTitle}{' '}
              <span className="text-content-muted">
                @ {t.xPercent.toFixed(1)}%, {t.yPercent.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {pendingClick && (
        <HotspotProductPicker
          onPick={(product) => {
            onAddTag({
              productId: product.id,
              productTitle: product.title,
              productSlug: product.slug,
              xPercent: pendingClick.x,
              yPercent: pendingClick.y,
            });
            setPendingClick(null);
          }}
          onCancel={() => setPendingClick(null)}
        />
      )}
    </div>
  );
}

function HotspotProductPicker({
  onPick,
  onCancel,
}: {
  onPick: (product: { id: string; slug: string; title: string }) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductRow[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ pageSize: '12' });
      if (search.trim()) params.set('search', search.trim());
      const res = await apiFetch<Page<ProductRow>>(`/admin/products?${params}`);
      if (res.ok && res.data) setResults(res.data.data);
    }, 150);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-content/40 p-4 pt-24">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="text-sm font-semibold">Tag a product at this point</h2>
          <button type="button" onClick={onCancel} className="text-content-muted">✕</button>
        </header>
        <div className="p-4">
          <input
            autoFocus
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className={adminInput}
          />
          <ul className="mt-3 max-h-72 overflow-auto">
            {results.map((p) => {
              const img = p.images?.[0];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick({ id: p.id, slug: p.slug, title: p.title })}
                    className="flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left hover:border-primary/40 hover:bg-surface-muted"
                  >
                    {img ? (
                      <Image
                        src={img.url}
                        alt=""
                        width={36}
                        height={45}
                        unoptimized
                        className="h-12 w-9 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-9 rounded bg-line" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-content-soft">{p.brand.name}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
