'use client';

import Image from 'next/image';
import {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiFetch } from '@/lib/api';
import { AffiliatePartner, Brand, CategoryNode, Page, ProductStatus } from '@/lib/admin-types';
import { SHOP_CATEGORIES } from '@/lib/shop-categories';
import {
  adminButtonPrimary,
  adminButtonSecondary,
  adminInput,
  adminLabel,
} from './AdminShell';
import { BrandFormModal } from './BrandFormModal';

interface ScrapeResult {
  retailer: string;
  rawUrl: string;
  canonicalUrl: string;
  title: string | null;
  brandHint: string | null;
  price: number | null;
  mrp: number | null;
  primaryImageUrl: string | null;
  images?: string[] | null;
  source: string;
}

interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

interface FormState {
  rawUrl: string;
  retailer: string;
  retailerDisplayName: string;
  title: string;
  brandId: string;
  categoryId: string;
  subcategoryId: string;
  price: string;
  mrp: string;
  color: string;
  sizesCsv: string;
  material: string;
  tagsCsv: string;
  avatarImageUrl: string;
  retailerImageUrl: string;
  imageUrls: string[];
  status: ProductStatus;
  affiliatePartner: AffiliatePartner;
}

const EMPTY: FormState = {
  rawUrl: '',
  retailer: 'flipkart',
  retailerDisplayName: '',
  title: '',
  brandId: '',
  categoryId: '',
  subcategoryId: '',
  price: '',
  mrp: '',
  color: '',
  sizesCsv: '',
  material: '',
  tagsCsv: '',
  avatarImageUrl: '',
  retailerImageUrl: '',
  imageUrls: [],
  status: 'ACTIVE',
  affiliatePartner: 'EARNKARO',
};

const DRAFT_KEY = 'branv:quickadd:draft';

const KNOWN_RETAILERS = [
  'flipkart', 'amazon', 'myntra', 'ajio', 'meesho', 'nykaa',
  'snitch', 'bewakoof', 'thesouledstore', 'other',
];

const AFFILIATE_PARTNER_OPTIONS: Array<{ value: AffiliatePartner; label: string }> = [
  { value: 'EARNKARO', label: 'EarnKaro' },
  { value: 'MEESHO', label: 'Meesho affiliate program' },
  { value: 'DIRECT', label: 'Other / direct link' },
];

export function QuickAddModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (productId: string) => void;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [bulkMode, setBulkMode] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autofillSource, setAutofillSource] = useState<string | null>(null);
  const [pendingAffiliate, setPendingAffiliate] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);

  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

const DEFAULT_BRANDS = [
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

  // ── Bootstrap brands + categories on open ──
  useEffect(() => {
    if (!open) return;
    void (async () => {
      let brandList: Brand[] = [];
      const [bAdmin, c] = await Promise.all([
        apiFetch<any>('/admin/brands?pageSize=200'),
        apiFetch<CategoryNode[]>('/admin/categories'),
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
        brandList = DEFAULT_BRANDS;
      }
      setBrands(brandList);
      if (c.ok && c.data) setCategories(c.data);
    })();
  }, [open]);

  // ── Restore draft + focus URL on open ──
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as FormState;
        setForm(draft);
      }
    } catch {
      /* ignore */
    }
    setTimeout(() => urlInputRef.current?.focus(), 50);
  }, [open]);

  // ── Persist draft to localStorage on change ──
  useEffect(() => {
    if (!open) return;
    try {
      // Don't persist if form is essentially empty.
      const hasContent =
        form.rawUrl || form.title || form.avatarImageUrl;
      if (hasContent) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      }
    } catch {
      /* ignore */
    }
  }, [form, open]);

  // ── Esc to close, Cmd/Ctrl+Enter to submit ──
  useEffect(() => {
    if (!open) return;
    function handler(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.key === 'Enter' &&
        formRef.current
      ) {
        e.preventDefault();
        formRef.current.requestSubmit();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ── Derived: subcategory options for selected category ──
  const l1 = useMemo(() => {
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
  }, [categories]);

  const l2 = useMemo(() => {
    const fromApi = categories.filter((c) => c.parentId === form.categoryId);
    if (fromApi.length > 0) return fromApi;

    const selectedCat = l1.find((c) => c.id === form.categoryId || c.slug === form.categoryId);
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
  }, [categories, form.categoryId, l1]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  // ── Autofill from URL ──
  async function onAutofill() {
    if (!form.rawUrl) return;
    setScraping(true);
    setError(null);
    const result = await apiFetch<ScrapeResult>('/admin/products/scrape-url', {
      method: 'POST',
      body: JSON.stringify({ url: form.rawUrl }),
    });
    setScraping(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Autofill failed');
      return;
    }
    const s = result.data;
    // Keep the admin's current pick when the scraper couldn't tell (returns
    // 'other'). But a value like 'unknown' isn't a dropdown option either -
    // route it to 'other' so the manual name input appears, instead of
    // silently carrying an unmapped retailer key through to "Buy on unknown".
    let scrapedRetailer = form.retailer;
    if (s.retailer && s.retailer !== 'other') {
      scrapedRetailer = KNOWN_RETAILERS.includes(s.retailer) ? s.retailer : 'other';
    }
    setForm((prev) => ({
      ...prev,
      retailer: scrapedRetailer,
      title: prev.title || s.title || '',
      mrp: prev.mrp || (s.mrp ? String(s.mrp) : ''),
      retailerImageUrl: prev.retailerImageUrl || s.primaryImageUrl || '',
      imageUrls: Array.from(new Set([...(prev.imageUrls || []), ...(s.images || [])])),
    }));
    // If brand hint matches an existing brand, pre-select it.
    if (s.brandHint && !form.brandId) {
      const match = brands.find(
        (b) => b.name.toLowerCase() === s.brandHint!.toLowerCase(),
      );
      if (match) set('brandId', match.id);
    }
    setAutofillSource(s.source);
  }

  // ── Image upload (presign → PUT to S3) ──
  async function uploadImages(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      await Promise.all(
        files.map(async (file) => {
          const presign = await apiFetch<PresignResult>('/uploads/presign', {
            method: 'POST',
            body: JSON.stringify({
              contentType: file.type || 'image/png',
              filename: file.name,
              kind: 'product-avatar',
            }),
          });
          if (!presign.ok || !presign.data) return;
          const put = await fetch(presign.data.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type || 'image/png' },
          });
          if (put.ok) {
            uploaded.push(presign.data.publicUrl);
          }
        }),
      );
      if (uploaded.length > 0) {
        setForm((prev) => ({
          ...prev,
          imageUrls: [...prev.imageUrls, ...uploaded],
          avatarImageUrl: prev.avatarImageUrl || uploaded[0],
        }));
      }
    } finally {
      setUploading(false);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) files.push(blob);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void uploadImages(files);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (files.length > 0) {
      void uploadImages(files);
    }
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) void uploadImages(files);
  }

  // ── Submit ──
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setPendingAffiliate(false);

    if (!form.brandId) {
      setSubmitting(false);
      setError('Pick a brand');
      return;
    }
    if (!form.categoryId) {
      setSubmitting(false);
      setError('Pick a category');
      return;
    }
    if (!form.title || !form.rawUrl) {
      setSubmitting(false);
      setError('Title and URL are required');
      return;
    }

    const payload = {
      title: form.title,
      rawUrl: form.rawUrl,
      retailer: form.retailer,
      retailerDisplayName:
        form.retailer === 'other' ? form.retailerDisplayName || undefined : undefined,
      brandId: form.brandId,
      categoryId: form.categoryId,
      subcategoryId: form.subcategoryId || undefined,
      price: form.price ? Number(form.price) : 0,
      mrp: form.mrp ? Number(form.mrp) : undefined,
      color: form.color || undefined,
      sizes: form.sizesCsv
        ? form.sizesCsv.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      material: form.material || undefined,
      tags: form.tagsCsv
        ? form.tagsCsv.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined,
      avatarImageUrl: form.avatarImageUrl || undefined,
      retailerImageUrl: form.retailerImageUrl || undefined,
      imageUrls: form.imageUrls.length > 0 ? form.imageUrls : undefined,
      status: form.status,
      affiliatePartner: form.affiliatePartner,
    };

    const result = await apiFetch<{
      product: { id: string; slug: string; title: string };
      affiliate: { pendingConversion: boolean; partner: string };
    }>('/admin/products/quick-add', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (!result.ok || !result.data) {
      setError(result.error ?? 'Quick Add failed');
      return;
    }

    const { product, affiliate } = result.data;
    setPendingAffiliate(affiliate.pendingConversion);
    setFlash(`✓ Created “${product.title}”`);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    onCreated?.(product.id);

    if (bulkMode) {
      // Clear and refocus URL for the next product.
      setForm({ ...EMPTY, status: form.status });
      setAutofillSource(null);
      setTimeout(() => {
        urlInputRef.current?.focus();
        setFlash(null);
      }, 1500);
    } else {
      setTimeout(() => {
        setFlash(null);
        onClose();
      }, 800);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setForm(EMPTY);
    setAutofillSource(null);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-content/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-8 w-full max-w-2xl rounded-2xl bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Quick Add Product</h2>
           
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-content-muted hover:text-primary"
          >
            ✕
          </button>
        </header>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="space-y-5 px-6 py-5"
        >
          {/* URL paste + Autofill */}
          <section>
            <label className={adminLabel}>📋 Paste retailer URL</label>
            <div className="flex gap-2">
              <input
                ref={urlInputRef}
                type="url"
                value={form.rawUrl}
                onChange={(e) => set('rawUrl', e.target.value)}
                placeholder="https://www.flipkart.com/…"
                className={adminInput}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void onAutofill();
                  }
                }}
              />
              <button
                type="button"
                onClick={onAutofill}
                disabled={scraping || !form.rawUrl}
                className={adminButtonSecondary}
              >
                {scraping ? 'Scraping…' : '🪄 Autofill'}
              </button>
            </div>
            {autofillSource && (
              <p className="mt-1 text-xs text-success">
                ✓ Autofilled from {autofillSource}
              </p>
            )}
          </section>

          <hr className="border-neutral-100" />

          {/* Basics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={adminLabel}>Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>Brand</label>
              <select
                required
                value={form.brandId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__new__') {
                    setShowNewBrand(true);
                    return;
                  }
                  set('brandId', v);
                }}
                className={adminInput}
              >
                <option value="__new__">+ New brand</option>
                <option value="">- select -</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={adminLabel}>Retailer</label>
              <select
                value={form.retailer}
                onChange={(e) => set('retailer', e.target.value)}
                className={adminInput}
              >
                {KNOWN_RETAILERS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {form.retailer === 'other' && (
                <input
                  required
                  value={form.retailerDisplayName}
                  onChange={(e) => set('retailerDisplayName', e.target.value)}
                  placeholder="Provider name, e.g. Purple Store"
                  className={`${adminInput} mt-2`}
                />
              )}
            </div>
            <div>
              <label className={adminLabel}>Category</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => {
                  set('categoryId', e.target.value);
                  set('subcategoryId', '');
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
                value={form.subcategoryId}
                onChange={(e) => set('subcategoryId', e.target.value)}
                disabled={!form.categoryId}
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
            <div>
              <label className={adminLabel}>Color</label>
              <input
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                placeholder="Navy"
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>Sizes</label>
              <input
                value={form.sizesCsv}
                onChange={(e) => set('sizesCsv', e.target.value)}
                placeholder="M, L, XL"
                className={adminInput}
              />
              
            </div>
            <div>
              <label className={adminLabel}>Material</label>
              <input
                value={form.material}
                onChange={(e) => set('material', e.target.value)}
                placeholder="Cotton"
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>Tags</label>
              <input
                value={form.tagsCsv}
                onChange={(e) => set('tagsCsv', e.target.value)}
                placeholder="casual, summer, linen"
                className={adminInput}
              />
            </div>
          </div>

          {/* Task 3: Collapsible Product Visibility Section (Unchecked by default) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <button
              type="button"
              onClick={() => setShowVisibility((prev) => !prev)}
              className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-800 hover:text-primary transition"
            >
              <span>👁️ Product Visibility</span>
              <span className="ml-2 text-slate-400 text-sm font-normal">
                {showVisibility ? '▲' : '▼'}
              </span>
            </button>
            {showVisibility && (
              <div className="mt-3 border-t border-slate-200/60 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  'Trendy Wear', 'Sports Wear', 'Classic Essentials', 'Easy Casuals',
                  'Fashion Forward', 'Sharp Formals', 'Shirts', 'T-Shirts', 'Jeans',
                  'Tracks', 'Footwear', 'Watches', 'Trousers', 'Shorts', 'Jackets',
                  'Inners', 'Sweatshirts', 'Hoodies'
                ].map((cat) => (
                  <label key={cat} className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 select-none cursor-pointer hover:text-primary">
                    <input
                      type="checkbox"
                      defaultChecked={false}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span>{cat}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <hr className="border-neutral-100" />

          {/* Product images: drag + paste + pick + gallery grid */}
          <section>
            <label className={adminLabel}>
              📸 Product Images ({form.imageUrls.length})
            </label>
            <ImageDropPaste
              imageUrls={form.imageUrls}
              currentUrl={form.avatarImageUrl}
              uploading={uploading}
              onDrop={onDrop}
              onPaste={onPaste}
              onFilePick={onFilePick}
              onRemoveImage={(url) =>
                setForm((prev) => ({
                  ...prev,
                  imageUrls: prev.imageUrls.filter((u) => u !== url),
                  avatarImageUrl: prev.avatarImageUrl === url ? (prev.imageUrls.find((u) => u !== url) || '') : prev.avatarImageUrl,
                }))
              }
              onSetPrimary={(url) => set('avatarImageUrl', url)}
            />
          </section>

          {/* Retailer image preview */}
          {form.retailerImageUrl && (
            <section>
              <label className={adminLabel}>
                📸 Product Image (from {form.retailer})
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-muted p-3">
                <Image
                  src={form.retailerImageUrl}
                  alt=""
                  width={64}
                  height={80}
                  unoptimized
                  className="rounded object-cover"
                />
                <span className="text-xs text-success">
                  ✓ Extracted from {form.retailer}
                </span>
                <button
                  type="button"
                  onClick={() => set('retailerImageUrl', '')}
                  className="ml-auto text-xs text-content-soft underline"
                >
                  Remove
                </button>
              </div>
            </section>
          )}

          {/* Affiliate */}
          <section>
            <label className={adminLabel}>🔗 Affiliate Link</label>
            {form.retailer === 'amazon' ? (
              <div className="rounded-lg border border-line bg-surface-muted p-3 text-sm text-content-soft">
                Will route through <strong>Amazon Associates direct</strong> 
                your affiliate tag is appended automatically on submit.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-content-soft">
                  Paste the ready-to-use affiliate link above in{' '}
                  <strong>Paste retailer URL</strong>  it's stored and used
                  for redirects exactly as pasted, no conversion.
                </p>
                <select
                  value={form.affiliatePartner}
                  onChange={(e) => set('affiliatePartner', e.target.value as AffiliatePartner)}
                  className={adminInput}
                >
                  {AFFILIATE_PARTNER_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          <hr className="border-neutral-100" />

          {/* Status + bulk mode */}
          <section className="flex flex-wrap items-center gap-6">
            <fieldset className="flex items-center gap-4">
              <legend className="sr-only">Status</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="status"
                  checked={form.status === 'DRAFT'}
                  onChange={() => set('status', 'DRAFT')}
                />
                Draft
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="status"
                  checked={form.status === 'ACTIVE'}
                  onChange={() => set('status', 'ACTIVE')}
                />
                Publish now
              </label>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bulkMode}
                onChange={(e) => setBulkMode(e.target.checked)}
              />
              Keep modal open after submit (bulk mode)
            </label>
          </section>

          {/* Feedback */}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {flash && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-success">
              {flash}
              {pendingAffiliate && (
                <span className="ml-2 text-xs">
                  (affiliate link pending - worker will retry within 10 min)
                </span>
              )}
            </p>
          )}

          {/* Actions */}
          <footer className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs text-content-soft underline"
            >
              Clear draft
            </button>
            <div className="flex gap-2">
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
                {submitting ? 'Adding…' : '✓ Add Product'}
              </button>
            </div>
          </footer>
        </form>
      </div>

      {showNewBrand && (
        <BrandFormModal
          brand={null}
          zIndexClassName="z-[60]"
          onClose={() => setShowNewBrand(false)}
          onSaved={(brand) => {
            setBrands((prev) => [brand, ...prev]);
            set('brandId', brand.id);
            setShowNewBrand(false);
          }}
        />
      )}
    </div>
  );
}

// ─────────────── Drop / paste / pick image zone ───────────────

function ImageDropPaste({
  imageUrls,
  currentUrl,
  uploading,
  onDrop,
  onPaste,
  onFilePick,
  onRemoveImage,
  onSetPrimary,
}: {
  imageUrls: string[];
  currentUrl: string;
  uploading: boolean;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLDivElement>) => void;
  onFilePick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (url: string) => void;
  onSetPrimary: (url: string) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="space-y-3">
      <div
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          setHover(false);
          onDrop(e);
        }}
        tabIndex={0}
        className={`flex items-center gap-4 rounded-lg border-2 border-dashed p-4 transition ${
          hover ? 'border-neutral-900 bg-surface-muted' : 'border-line'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded bg-surface-muted text-xl">
          📸
        </div>
        <div className="flex-1 text-sm">
          <p className="font-medium text-content">
            {uploading ? 'Uploading images…' : 'Drag & drop multiple image files, or Ctrl+V paste'}
          </p>
          <p className="text-xs text-content-soft">
            Or{' '}
            <label className="cursor-pointer text-primary font-medium underline">
              choose image files
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onFilePick}
              />
            </label>
          </p>
        </div>
      </div>

      {imageUrls.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {imageUrls.map((url, idx) => (
            <div
              key={url + idx}
              className={`relative aspect-[4/5] rounded border overflow-hidden bg-surface ${
                currentUrl === url ? 'border-2 border-primary shadow-sm' : 'border-line'
              }`}
            >
              <Image
                src={url}
                alt={`Product image ${idx + 1}`}
                fill
                unoptimized
                className="object-cover"
              />
              <div className="absolute left-1 top-1 flex flex-col gap-1">
                {currentUrl === url ? (
                  <span className="rounded bg-primary px-1 py-0.5 text-[8px] font-bold uppercase text-primary-fg">
                    Primary
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetPrimary(url)}
                    className="rounded bg-surface/90 px-1 py-0.5 text-[8px] font-medium text-content hover:bg-surface"
                  >
                    Set Primary
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemoveImage(url)}
                className="absolute right-1 top-1 rounded bg-surface/90 px-1.5 py-0.5 text-[10px] font-bold text-red-600 hover:bg-surface"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
