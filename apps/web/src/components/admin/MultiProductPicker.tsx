'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Page, ProductRow } from '@/lib/admin-types';
import {
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminInput,
} from '@/components/AdminShell';
import { ProductLite } from '@/lib/phase7-types';

interface Props {
  /** The current selection as an ordered list of product IDs. */
  value: ProductLite[];
  onChange: (next: ProductLite[]) => void;
  label?: string;
}

/**
 * Ordered product picker used by drops + edits. Search opens a chooser modal,
 * confirmed picks land at the end of the list, and each row has move-up /
 * move-down / remove controls.
 */
export function MultiProductPicker({ value, onChange, label = 'Products' }: Props) {
  const [showSearch, setShowSearch] = useState(false);

  function move(idx: number, dir: -1 | 1) {
    const next = [...value];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  function remove(id: string) {
    onChange(value.filter((p) => p.id !== id));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-700">
          {label} ({value.length})
        </p>
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className={adminButtonSecondary}
        >
          + Add product
        </button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
          No products yet. Click <strong>+ Add product</strong>.
        </p>
      ) : (
        <ul className="space-y-1">
          {value.map((p, idx) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <span className="w-6 text-xs text-neutral-500">{idx + 1}.</span>
              <div className="flex-1">
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-neutral-500">/{p.slug}</p>
              </div>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
                aria-label="Move up"
                className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={idx === value.length - 1}
                onClick={() => move(idx, 1)}
                aria-label="Move down"
                className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className={adminButtonDanger}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <ProductSearchModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        excludedIds={new Set(value.map((p) => p.id))}
        onPick={(p) => {
          if (value.some((v) => v.id === p.id)) return;
          onChange([...value, p]);
        }}
      />
    </div>
  );
}

function ProductSearchModal({
  open,
  onClose,
  excludedIds,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  excludedIds: Set<string>;
  onPick: (p: ProductLite) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductRow[]>([]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ pageSize: '20' });
      if (search.trim()) params.set('search', search.trim());
      const res = await apiFetch<Page<ProductRow>>(`/admin/products?${params}`);
      if (res.ok && res.data) setResults(res.data.data);
    }, 150);
    return () => clearTimeout(t);
  }, [open, search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-semibold">Add product</h2>
          <button onClick={onClose} className="text-neutral-400">✕</button>
        </header>
        <div className="p-5">
          <input
            autoFocus
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className={adminInput}
          />
          <ul className="mt-4 max-h-80 space-y-1 overflow-auto">
            {results
              .filter((r) => !excludedIds.has(r.id))
              .map((p) => {
                const img = p.images?.[0];
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick({ id: p.id, slug: p.slug, title: p.title });
                      }}
                      className="flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left hover:border-neutral-300 hover:bg-neutral-50"
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
                        <div className="h-12 w-9 rounded bg-neutral-200" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-neutral-500">
                          {p.brand.name} · /{p.slug}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-emerald-700">+ Add</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
        <footer className="flex justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
          <button onClick={onClose} className={adminButtonPrimary}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
