'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Brand, CategoryNode, Page, ProductStatus } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);

  const [title, setTitle] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProductStatus>('DRAFT');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [b, c] = await Promise.all([
        apiFetch<Page<Brand>>('/admin/brands?pageSize=200'),
        apiFetch<CategoryNode[]>('/admin/categories'),
      ]);
      if (b.ok && b.data) setBrands(b.data.data);
      if (c.ok && c.data) setCategories(c.data);
    })();
  }, []);

  const l1 = categories.filter((c) => !c.parentId);
  const l2 = categories.filter((c) => c.parentId === categoryId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = {
      title,
      brandId,
      categoryId,
      subcategoryId: subcategoryId || undefined,
      price: Number(price),
      mrp: mrp ? Number(mrp) : undefined,
      description: description || undefined,
      tags: tags
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined,
      status,
    };
    const result = await apiFetch<{ id: string }>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Create failed');
      return;
    }
    router.replace(`/admin/products/${result.data.id}`);
  }

  return (
    <AdminShell title="New product">
      <form onSubmit={onSubmit} className={`${adminCard} space-y-4`}>
        <div>
          <label className={adminLabel}>Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={adminInput}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={adminLabel}>Brand</label>
            <select
              required
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className={adminInput}
            >
              <option value="">— select —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={adminLabel}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
              className={adminInput}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active (publish now)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={adminLabel}>Category</label>
            <select
              required
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId('');
              }}
              className={adminInput}
            >
              <option value="">— select —</option>
              {l1.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={adminLabel}>Subcategory</label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              disabled={!categoryId}
              className={adminInput}
            >
              <option value="">— none —</option>
              {l2.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={adminLabel}>Price (₹)</label>
            <input
              required
              type="number"
              min={0}
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
              min={0}
              step="0.01"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              className={adminInput}
            />
          </div>
        </div>
        <div>
          <label className={adminLabel}>Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="casual, summer, linen"
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className={adminButtonSecondary}
          >
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={adminButtonPrimary}>
            {submitting ? 'Creating…' : 'Create product'}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Next: add variants, images and retailer listings on the edit page.
        </p>
      </form>
    </AdminShell>
  );
}
