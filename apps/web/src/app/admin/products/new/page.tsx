'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Brand, CategoryNode, Page, ProductStatus } from '@/lib/admin-types';
import { SHOP_CATEGORIES } from '@/lib/shop-categories';
import { EditAdmin } from '@/lib/phase7-types';
import {
  AdminShell,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

const FALLBACK_BRAND_SLUG = 'unbranded';

// Extra category / collection landing pages a product can be surfaced on via
// the "Product Visibility" checkboxes. Slugs must match the category rows so
// the backend can resolve them (see product_category_links).
const VISIBILITY_CATEGORIES: { name: string; slug: string }[] = [
  { name: 'Trendy Wear', slug: 'trendy-wear' },
  { name: 'Sports Wear', slug: 'sports-wear' },
  { name: 'Classic Essentials', slug: 'classic-essentials' },
  { name: 'Easy Casuals', slug: 'easy-casuals' },
  { name: 'Fashion Forward', slug: 'fashion-forward' },
  { name: 'Sharp Formals', slug: 'sharp-formals' },
  { name: 'Shirts', slug: 'shirts' },
  { name: 'T-Shirts', slug: 't-shirts' },
  { name: 'Jeans', slug: 'jeans' },
  { name: 'Tracks', slug: 'tracks' },
  { name: 'Footwear', slug: 'footwear' },
  { name: 'Watches', slug: 'watches' },
  { name: 'Trousers', slug: 'trousers' },
  { name: 'Shorts', slug: 'shorts' },
  { name: 'Jackets', slug: 'jackets' },
  { name: 'Inners', slug: 'inners' },
  { name: 'Sweatshirts', slug: 'sweatshirts' },
  { name: 'Hoodies', slug: 'hoodies' },
];

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [edits, setEdits] = useState<EditAdmin[]>([]);

  const [title, setTitle] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [color, setColor] = useState('');
  const [sizesCsv, setSizesCsv] = useState('');
  const [material, setMaterial] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProductStatus>('DRAFT');
  const [feature, setFeature] = useState(false);
  const [featureDays, setFeatureDays] = useState<number>(7);
  const [editIds, setEditIds] = useState<string[]>([]);
  const [showVisibility, setShowVisibility] = useState(false);
  const [visibilitySlugs, setVisibilitySlugs] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      let brandList: Brand[] = [];
      const [bAdmin, c, e] = await Promise.all([
        apiFetch<any>('/admin/brands?pageSize=200'),
        apiFetch<CategoryNode[]>('/admin/categories'),
        apiFetch<Page<EditAdmin>>('/admin/edits?pageSize=100'),
      ]);
      if (bAdmin.ok && bAdmin.data) {
        const list = Array.isArray(bAdmin.data) ? bAdmin.data : bAdmin.data.data;
        if (Array.isArray(list) && list.length > 0) brandList = list;
      }
      if (brandList.length === 0) {
        const bPublic = await apiFetch<any>('/brands');
        if (bPublic.ok && bPublic.data) {
          const list = Array.isArray(bPublic.data) ? bPublic.data : bPublic.data.data;
          if (Array.isArray(list) && list.length > 0) brandList = list;
        }
      }
      if (brandList.length === 0) {
        brandList = [
          { id: 'brand_nike', name: 'Nike', slug: 'nike' },
          { id: 'brand_adidas', name: 'Adidas', slug: 'adidas' },
          { id: 'brand_puma', name: 'Puma', slug: 'puma' },
          { id: 'brand_levi', name: "Levi's", slug: 'levis' },
          { id: 'brand_zara', name: 'Zara', slug: 'zara' },
          { id: 'brand_hm', name: 'H&M', slug: 'hm' },
          { id: 'brand_tommy', name: 'Tommy Hilfiger', slug: 'tommy-hilfiger' },
          { id: 'brand_calvin', name: 'Calvin Klein', slug: 'calvin-klein' },
          { id: 'brand_ralph', name: 'Ralph Lauren', slug: 'ralph-lauren' },
          { id: 'brand_underarmour', name: 'Under Armour', slug: 'under-armour' },
        ] as unknown as Brand[];
      }
      setBrands(brandList);
      if (c.ok && c.data) setCategories(c.data);
      if (e.ok && e.data) setEdits(e.data.data.filter((edit) => edit.status !== 'ARCHIVED'));
    })();
  }, []);

  function toggleEditId(id: string) {
    setEditIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleVisibility(slug: string) {
    setVisibilitySlugs((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug],
    );
  }

  const l1 = (() => {
    const apiL1 = categories.filter((c) => !c.parentId);
    const existingSlugs = new Set(apiL1.map((c) => c.slug));
    const merged = [...apiL1];

    for (const sc of SHOP_CATEGORIES) {
      if (!existingSlugs.has(sc.slug)) {
        merged.push({
          id: sc.slug,
          parentId: null,
          slug: sc.slug,
          name: sc.name,
          path: sc.slug,
          displayOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as CategoryNode);
      }
    }
    return merged;
  })();

  const l2 = (() => {
    const fromApi = categories.filter((c) => c.parentId === categoryId);
    if (fromApi.length > 0) return fromApi;

    const selectedCat = l1.find((c) => c.id === categoryId || c.slug === categoryId);
    if (!selectedCat) return [];

    const shopCat = SHOP_CATEGORIES.find(
      (sc) => sc.slug === selectedCat.slug || sc.name.toLowerCase() === selectedCat.name.toLowerCase()
    );
    if (!shopCat || !shopCat.subcategories) return [];

    return shopCat.subcategories.map((sub) => ({
      id: sub.slug,
      parentId: selectedCat.id,
      slug: sub.slug,
      name: sub.name,
      path: `${selectedCat.slug}/${sub.slug}`,
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })) as CategoryNode[];
  })();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const resolvedBrandId =
      brandId || brands.find((b) => b.slug === FALLBACK_BRAND_SLUG)?.id;
    if (!resolvedBrandId) {
      setSubmitting(false);
      setError('Pick a brand - fallback "Unbranded" brand not found');
      return;
    }
    const body = {
      title,
      brandId: resolvedBrandId,
      categoryId,
      subcategoryId: subcategoryId || undefined,
      description: description || undefined,
      tags: tags
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined,
      status,
      featureDays: feature ? Math.max(1, Math.min(365, featureDays)) : 0,
      editIds: editIds.length ? editIds : undefined,
      visibilityCategorySlugs: visibilitySlugs.length ? visibilitySlugs : undefined,
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={adminLabel}>Brand (optional - defaults to Unbranded)</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className={adminInput}
            >
              <option value="">- Unbranded -</option>
              {brands
                .filter((b) => b.slug !== FALLBACK_BRAND_SLUG)
                .map((b) => (
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <option value="">- select -</option>
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
              <option value="">- none -</option>
              {l2.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={adminLabel}>Also show in these collections</label>
          {edits.length === 0 ? (
            <p className="text-xs text-content-soft">
              No collections yet - create one under{' '}
              <a href="/admin/edits/new" className="underline">
                The Edit
              </a>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-3 rounded-md border border-line bg-surface-muted p-3">
              {edits.map((edit) => (
                <label key={edit.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editIds.includes(edit.id)}
                    onChange={() => toggleEditId(edit.id)}
                  />
                  {edit.title}
                </label>
              ))}
            </div>
          )}
        </div>
        {/* Task 3: Collapsible Product Visibility Section (Unchecked by default) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <button
            type="button"
            onClick={() => setShowVisibility((prev) => !prev)}
            className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-800 hover:text-primary transition"
          >
            <span>👁️ Product Visibility (Select categories this product appears in)</span>
            <span className="ml-2 text-slate-400 text-sm font-normal">
              {showVisibility ? '▲ Hide' : '▼ Expand'}
            </span>
          </button>
          {showVisibility && (
            <div className="mt-3 border-t border-slate-200/60 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {VISIBILITY_CATEGORIES.map((cat) => (
                <label key={cat.slug} className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 select-none cursor-pointer hover:text-primary">
                  <input
                    type="checkbox"
                    checked={visibilitySlugs.includes(cat.slug)}
                    onChange={() => toggleVisibility(cat.slug)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>{cat.name}</span>
                </label>
              ))}
            </div>
          )}
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
        <div className="rounded-md border border-line bg-surface-muted p-3">
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
              <span className="text-content-soft">days from now</span>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
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
        <p className="text-xs text-content-soft">
          Next: add variants, images and retailer listings on the edit page.
        </p>
      </form>
    </AdminShell>
  );
}
