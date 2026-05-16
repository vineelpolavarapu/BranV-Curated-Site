'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ProductStatus } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: string;
  mrp: string | null;
  status: ProductStatus;
  tags: string[];
  featuredUntil: string | null;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  subcategory: { id: string; name: string; slug: string } | null;
  variants: Array<{
    id: string;
    sku: string | null;
    color: string | null;
    size: string | null;
    isDefault: boolean;
  }>;
  images: Array<{
    id: string;
    url: string;
    isPrimary: boolean;
    isAiGenerated: boolean;
    position: number;
    altText: string | null;
  }>;
  retailerListings: Array<{
    id: string;
    retailer: string;
    retailerProductUrl: string;
    retailerImageUrl: string | null;
    rawPrice: string | null;
    availabilityStatus: string;
  }>;
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const result = await apiFetch<ProductDetail>(`/admin/products/${params.id}`);
    if (result.ok && result.data) setProduct(result.data);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <AdminShell title="Loading product…">
        <div className="h-2 w-32 animate-pulse rounded bg-neutral-200" />
      </AdminShell>
    );
  }
  if (!product) {
    return (
      <AdminShell title="Product not found">
        <button onClick={() => router.back()} className={adminButtonSecondary}>
          Back
        </button>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={product.title}>
      <p className="mb-6 text-sm text-neutral-500">
        {product.brand.name} · {product.category.name}
        {product.subcategory && ` · ${product.subcategory.name}`} · /{product.slug}
      </p>

      <BasicsForm product={product} onSaved={reload} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ImagesPanel product={product} onChanged={reload} />
        <VariantsPanel product={product} onChanged={reload} />
      </div>

      <div className="mt-8">
        <RetailerListingsPanel product={product} onChanged={reload} />
      </div>
    </AdminShell>
  );
}

function BasicsForm({
  product,
  onSaved,
}: {
  product: ProductDetail;
  onSaved: () => void;
}) {
  const featuredActive =
    !!product.featuredUntil && new Date(product.featuredUntil) > new Date();
  const remainingDays = featuredActive
    ? Math.max(
        1,
        Math.ceil(
          (new Date(product.featuredUntil!).getTime() - Date.now()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : 7;

  const [title, setTitle] = useState(product.title);
  const [price, setPrice] = useState(product.price);
  const [mrp, setMrp] = useState(product.mrp ?? '');
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [description, setDescription] = useState(product.description ?? '');
  const [tags, setTags] = useState(product.tags.join(', '));
  const [feature, setFeature] = useState(featuredActive);
  const [featureDays, setFeatureDays] = useState<number>(remainingDays);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = {
      title,
      price: Number(price),
      mrp: mrp ? Number(mrp) : null,
      status,
      description: description || null,
      tags: tags
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      // 0 clears the feature window; >0 sets featuredUntil = now + N days.
      featureDays: feature ? Math.max(1, Math.min(365, featureDays)) : 0,
    };
    const result = await apiFetch(`/admin/products/${product.id}`, {
      method: 'PATCH',
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
    <form onSubmit={onSubmit} className={`${adminCard} space-y-4`}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-700">
        Basics
      </h2>
      <div>
        <label className={adminLabel}>Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={adminInput}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={adminLabel}>Price (₹)</label>
          <input
            required
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={adminInput}
          />
        </div>
        <div>
          <label className={adminLabel}>MRP (₹)</label>
          <input
            type="number"
            step="0.01"
            value={mrp}
            onChange={(e) => setMrp(e.target.value)}
            className={adminInput}
          />
        </div>
        <div>
          <label className={adminLabel}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
            className={adminInput}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>
      <div>
        <label className={adminLabel}>Tags (comma-separated)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className={adminInput}
        />
      </div>
      <div>
        <label className={adminLabel}>Description</label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={adminInput}
        />
      </div>
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={feature}
            onChange={(e) => setFeature(e.target.checked)}
          />
          Feature this product on the home page
        </label>
        {feature && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <label className={adminLabel}>For</label>
            <input
              type="number"
              min={1}
              max={365}
              value={featureDays}
              onChange={(e) => setFeatureDays(Number(e.target.value))}
              className={`${adminInput} w-20`}
            />
            <span className="text-neutral-600">days from now</span>
            {featuredActive && (
              <span className="ml-auto text-xs text-neutral-500">
                Currently featured until {new Date(product.featuredUntil!).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className={adminButtonPrimary}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function ImagesPanel({
  product,
  onChanged,
}: {
  product: ProductDetail;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [isAi, setIsAi] = useState(false);
  const [isPrimary, setIsPrimary] = useState(product.images.length === 0);
  const [submitting, setSubmitting] = useState(false);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await apiFetch(`/admin/products/${product.id}/images`, {
      method: 'POST',
      body: JSON.stringify({
        url,
        altText: altText || undefined,
        isAiGenerated: isAi,
        isPrimary,
      }),
    });
    setSubmitting(false);
    if (!result.ok) {
      alert(result.error ?? 'Failed to add image');
      return;
    }
    setUrl('');
    setAltText('');
    setIsAi(false);
    setIsPrimary(false);
    onChanged();
  }

  async function onDelete(id: string) {
    if (!confirm('Remove this image?')) return;
    await apiFetch(`/admin/products/${product.id}/images/${id}`, {
      method: 'DELETE',
    });
    onChanged();
  }

  return (
    <div className={adminCard}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
        Images ({product.images.length})
      </h2>
      {product.images.length > 0 && (
        <ul className="mb-4 grid grid-cols-3 gap-2">
          {product.images.map((img) => (
            <li key={img.id} className="relative">
              <Image
                src={img.url}
                alt={img.altText ?? ''}
                width={120}
                height={150}
                unoptimized
                className="aspect-[4/5] w-full rounded object-cover"
              />
              <div className="absolute left-1 top-1 flex flex-col gap-0.5">
                {img.isPrimary && (
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white">
                    Primary
                  </span>
                )}
                {img.isAiGenerated && (
                  <span className="rounded bg-purple-600 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white">
                    AI
                  </span>
                )}
              </div>
              <button
                onClick={() => onDelete(img.id)}
                className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:bg-white"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="space-y-3 border-t border-neutral-200 pt-4">
        <div>
          <label className={adminLabel}>Image URL</label>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className={adminInput}
          />
        </div>
        <div>
          <label className={adminLabel}>Alt text</label>
          <input
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            className={adminInput}
          />
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAi}
              onChange={(e) => setIsAi(e.target.checked)}
            />
            AI-generated
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            Primary
          </label>
        </div>
        <button type="submit" disabled={submitting} className={adminButtonPrimary}>
          {submitting ? 'Adding…' : 'Add image'}
        </button>
      </form>
    </div>
  );
}

function VariantsPanel({
  product,
  onChanged,
}: {
  product: ProductDetail;
  onChanged: () => void;
}) {
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [sku, setSku] = useState('');
  const [isDefault, setIsDefault] = useState(product.variants.length === 0);
  const [submitting, setSubmitting] = useState(false);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await apiFetch(`/admin/products/${product.id}/variants`, {
      method: 'POST',
      body: JSON.stringify({
        color: color || undefined,
        size: size || undefined,
        sku: sku || undefined,
        isDefault,
      }),
    });
    setSubmitting(false);
    if (!result.ok) {
      alert(result.error ?? 'Failed to add variant');
      return;
    }
    setColor('');
    setSize('');
    setSku('');
    setIsDefault(false);
    onChanged();
  }

  async function onDelete(id: string) {
    if (!confirm('Remove this variant?')) return;
    await apiFetch(`/admin/products/${product.id}/variants/${id}`, {
      method: 'DELETE',
    });
    onChanged();
  }

  return (
    <div className={adminCard}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
        Variants ({product.variants.length})
      </h2>
      {product.variants.length > 0 && (
        <ul className="mb-4 space-y-2">
          {product.variants.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2 text-sm"
            >
              <span>
                <strong>{v.color || '—'}</strong>
                {v.size && ` · ${v.size}`}
                {v.sku && (
                  <span className="ml-2 text-xs text-neutral-500">
                    SKU {v.sku}
                  </span>
                )}
                {v.isDefault && (
                  <span className="ml-2 rounded bg-neutral-900 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white">
                    Default
                  </span>
                )}
              </span>
              <button
                onClick={() => onDelete(v.id)}
                className={adminButtonDanger}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="space-y-3 border-t border-neutral-200 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={adminLabel}>Color</label>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Size</label>
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className={adminInput}
            />
          </div>
        </div>
        <div>
          <label className={adminLabel}>SKU (optional)</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className={adminInput}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Default variant
        </label>
        <button type="submit" disabled={submitting} className={adminButtonPrimary}>
          {submitting ? 'Adding…' : 'Add variant'}
        </button>
      </form>
    </div>
  );
}

function RetailerListingsPanel({
  product,
  onChanged,
}: {
  product: ProductDetail;
  onChanged: () => void;
}) {
  const [retailer, setRetailer] = useState('flipkart');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rawPrice, setRawPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await apiFetch(
      `/admin/products/${product.id}/retailer-listings`,
      {
        method: 'POST',
        body: JSON.stringify({
          retailer,
          retailerProductUrl: url,
          retailerImageUrl: imageUrl || undefined,
          rawPrice: rawPrice ? Number(rawPrice) : undefined,
        }),
      },
    );
    setSubmitting(false);
    if (!result.ok) {
      alert(result.error ?? 'Failed to add listing');
      return;
    }
    setRetailer('flipkart');
    setUrl('');
    setImageUrl('');
    setRawPrice('');
    onChanged();
  }

  async function onDelete(id: string) {
    if (!confirm('Remove this retailer listing?')) return;
    await apiFetch(
      `/admin/products/${product.id}/retailer-listings/${id}`,
      { method: 'DELETE' },
    );
    onChanged();
  }

  return (
    <div className={adminCard}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
        Retailer listings ({product.retailerListings.length})
      </h2>
      {product.retailerListings.length > 0 && (
        <ul className="mb-4 space-y-2">
          {product.retailerListings.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2 text-sm"
            >
              <div>
                <strong className="capitalize">{l.retailer}</strong>
                {l.rawPrice && <span className="ml-2">₹{l.rawPrice}</span>}
                <span className="ml-2 text-xs text-neutral-500">
                  {l.availabilityStatus.replaceAll('_', ' ').toLowerCase()}
                </span>
                <a
                  href={l.retailerProductUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-xs text-neutral-500 underline"
                >
                  open
                </a>
              </div>
              <button
                onClick={() => onDelete(l.id)}
                className={adminButtonDanger}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="grid grid-cols-1 gap-3 border-t border-neutral-200 pt-4 md:grid-cols-2">
        <div>
          <label className={adminLabel}>Retailer</label>
          <select
            value={retailer}
            onChange={(e) => setRetailer(e.target.value)}
            className={adminInput}
          >
            <option value="flipkart">Flipkart</option>
            <option value="amazon">Amazon</option>
            <option value="myntra">Myntra</option>
            <option value="ajio">Ajio</option>
            <option value="meesho">Meesho</option>
            <option value="nykaa">Nykaa</option>
            <option value="snitch">Snitch</option>
            <option value="bewakoof">Bewakoof</option>
            <option value="thesouledstore">The Souled Store</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className={adminLabel}>Raw price (₹)</label>
          <input
            type="number"
            step="0.01"
            value={rawPrice}
            onChange={(e) => setRawPrice(e.target.value)}
            className={adminInput}
          />
        </div>
        <div className="md:col-span-2">
          <label className={adminLabel}>Retailer product URL</label>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.flipkart.com/…"
            className={adminInput}
          />
        </div>
        <div className="md:col-span-2">
          <label className={adminLabel}>Retailer image URL (optional)</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className={adminInput}
          />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={submitting} className={adminButtonPrimary}>
            {submitting ? 'Adding…' : 'Add listing'}
          </button>
        </div>
      </form>
    </div>
  );
}
