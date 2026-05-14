'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { Page, ProductRow } from '@/lib/admin-types';
import {
  adminButtonPrimary,
  adminButtonSecondary,
  adminInput,
} from '@/components/AdminShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (product: { slug: string; title: string }) => void;
}

/**
 * Modal product search used by ArticleEditor's "Insert product" action.
 * Returns the picked product's slug so the editor can insert
 * `<div data-product="slug"></div>` into the body.
 */
export function ProductPicker({ open, onClose, onPick }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setResults([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await apiFetch<Page<ProductRow>>(
        `/admin/products?search=${encodeURIComponent(search)}&status=ACTIVE&pageSize=12`,
      );
      setLoading(false);
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
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-semibold">Insert product embed</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900"
          >
            ✕
          </button>
        </header>
        <div className="p-5">
          <input
            autoFocus
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by title or slug…"
            className={adminInput}
          />
          <div className="mt-4 max-h-80 overflow-auto">
            {loading && (
              <p className="text-sm text-neutral-500">Searching…</p>
            )}
            {!loading && search.trim() && results.length === 0 && (
              <p className="text-sm text-neutral-500">No matches.</p>
            )}
            <ul className="space-y-1">
              {results.map((p) => {
                const img = p.images?.[0];
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onPick({ slug: p.slug, title: p.title })}
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
                      <span className="text-xs font-medium text-emerald-700">
                        Insert
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className={adminButtonSecondary}
          >
            Cancel
          </button>
          <span className={adminButtonPrimary} aria-hidden style={{ opacity: 0, pointerEvents: 'none' }}>
            {/* keeps the footer height stable */}
          </span>
        </footer>
      </div>
    </div>
  );
}
