'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Brand, Page, ProductRow, ProductStatus } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
} from '@/components/AdminShell';
import { openQuickAdd } from '@/lib/quick-add';

const STATUS_OPTIONS: Array<ProductStatus | ''> = ['', 'DRAFT', 'ACTIVE', 'ARCHIVED'];

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [brandId, setBrandId] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (brandId) params.set('brandId', brandId);
    if (status) params.set('status', status);
    params.set('pageSize', '50');
    const result = await apiFetch<Page<ProductRow>>(`/admin/products?${params}`);
    if (result.ok && result.data) {
      setProducts(result.data.data);
      setTotal(result.data.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      const b = await apiFetch<Page<Brand>>('/admin/brands?pageSize=100');
      if (b.ok && b.data) setBrands(b.data.data);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onArchive(id: string) {
    if (!confirm('Archive this product? Click history is preserved.')) return;
    const result = await apiFetch(`/admin/products/${id}`, { method: 'DELETE' });
    if (result.ok) await refresh();
    else alert(result.error ?? 'Failed to archive');
  }

  return (
    <AdminShell
      title="Products"
      actions={
        <button onClick={openQuickAdd} className={adminButtonPrimary}>
          + Quick Add
        </button>
      }
    >
      

      <div className={`${adminCard} mb-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search title / slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void refresh();
            }}
            className={`${adminInput} w-full max-w-xs`}
          />
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className={`${adminInput} max-w-[200px]`}
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus | '')}
            className={`${adminInput} max-w-[160px]`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <button onClick={refresh} className={adminButtonSecondary}>
            Apply
          </button>
          <span className="ml-auto text-sm text-content-soft">{total} total</span>
        </div>
      </div>

      <div className={`${adminCard} min-w-0`}>
        {loading ? (
          <p className="text-sm text-content-soft">Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-content-soft">No products match.</p>
        ) : (
          <>
            {/* Mobile: stacked cards - no horizontal overflow */}
            <ul className="space-y-3 sm:hidden">
              {products.map((p) => {
                const primaryImage = p.images?.[0];
                return (
                  <li key={p.id} className="min-w-0 rounded-xl border border-line p-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {primaryImage ? (
                        primaryImage.url.startsWith('blob:') || primaryImage.url.startsWith('data:') ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={primaryImage.url}
                            alt=""
                            className="h-12 w-10 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <Image
                            src={primaryImage.url}
                            alt=""
                            width={40}
                            height={50}
                            unoptimized
                            className="h-12 w-10 shrink-0 rounded object-cover"
                          />
                        )
                      ) : (
                        <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-xs">
                          📸
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="min-w-0 truncate font-medium hover:underline"
                          >
                            {p.title}
                          </Link>
                          <StatusPill status={p.status} />
                        </div>
                        <p className="truncate text-xs text-content-soft">
                          {p.brand.name} · {p.category.name}
                        </p>
                        <p className="truncate text-xs text-content-soft">
                          {p._count.variants} variants · {p._count.retailerListings} retailers
                          {primaryImage?.isAiGenerated && ' · AI hero'}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          {Number(p.price) > 0 ? (
                            <p>
                              <span className="font-medium">₹{p.price}</span>
                              {p.mrp && (
                                <span className="ml-2 text-xs text-content-muted line-through">
                                  ₹{p.mrp}
                                </span>
                              )}
                            </p>
                          ) : <div />}
                          {p.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => onArchive(p.id)}
                              className={`${adminButtonDanger} shrink-0`}
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Tablet/desktop: table */}
            <div className="hidden sm:block">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-content-soft">
                    <th className="w-[45%] px-2 pb-3 font-medium">Product</th>
                    <th className="w-[18%] px-2 pb-3 font-medium">Brand</th>
                    <th className="w-[18%] px-2 pb-3 font-medium">Category</th>
                    <th className="w-[19%] px-2 pb-3 font-medium">Status</th>
                    <th className="w-[20%] px-2 pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const primaryImage = p.images?.[0];
                    return (
                      <tr key={p.id} className="border-b border-neutral-100">
                        <td className="px-2 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {primaryImage ? (
                              primaryImage.url.startsWith('blob:') || primaryImage.url.startsWith('data:') ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={primaryImage.url}
                                  alt=""
                                  className="h-12 w-10 shrink-0 rounded object-cover"
                                />
                              ) : (
                                <Image
                                  src={primaryImage.url}
                                  alt=""
                                  width={40}
                                  height={50}
                                  unoptimized
                                  className="h-12 w-10 shrink-0 rounded object-cover"
                                />
                              )
                            ) : (
                              <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-xs">
                                📸
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.title}</p>
                              <p className="truncate text-xs text-content-soft">
                                {p._count.variants} variants · {p._count.retailerListings} retailers
                                {primaryImage?.isAiGenerated && ' · AI hero'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="truncate px-2 py-3 text-content-soft">{p.brand.name}</td>
                        <td className="truncate px-2 py-3 text-content-soft">{p.category.name}</td>
                        <td className="px-2 py-3">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="px-2 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/products/${p.id}`}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-primary"
                            >
                              Edit
                            </Link>
                            {p.status !== 'ARCHIVED' && (
                              <button
                                onClick={() => onArchive(p.id)}
                                className={adminButtonDanger}
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function StatusPill({ status }: { status: ProductStatus }) {
  const tone =
    status === 'ACTIVE'
      ? 'bg-green-100 text-green-800'
      : status === 'DRAFT'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-line text-content-soft';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}
