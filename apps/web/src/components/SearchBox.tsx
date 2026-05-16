'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AutocompleteResult } from '@/lib/storefront-types';

export function SearchBox({ overlay = false }: { overlay?: boolean } = {}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<AutocompleteResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setHits(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const result = await apiFetch<AutocompleteResult>(
        `/search/autocomplete?q=${encodeURIComponent(q)}`,
      );
      if (result.ok) setHits(result.data);
    }, 150);
    return () => clearTimeout(timeout);
  }, [q]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  }

  const hasHits =
    hits &&
    (hits.products.length > 0 || hits.brands.length > 0 || hits.categories.length > 0);

  const inputClasses = overlay
    ? 'w-full rounded-full border border-white/40 bg-white/10 py-2 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/70 backdrop-blur focus:border-white focus:bg-white/20 focus:ring-1 focus:ring-white/60'
    : 'w-full rounded-full border border-neutral-300 bg-white py-2 pl-10 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900';
  const iconClasses = overlay
    ? 'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/80'
    : 'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400';

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl">
      <form onSubmit={onSubmit} className="relative">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={iconClasses}
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search products, brands, categories…"
          className={inputClasses}
        />
      </form>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-xl">
          {!hasHits ? (
            <p className="px-4 py-3 text-sm text-neutral-500">No matches.</p>
          ) : (
            <div className="max-h-96 divide-y divide-neutral-100 overflow-auto py-1 text-sm">
              {hits!.products.length > 0 && (
                <Section title="Products">
                  {hits!.products.map((p) => (
                    <SearchItem
                      key={p.slug}
                      href={`/products/${p.slug}`}
                      title={p.title}
                      subtitle={p.brand}
                      onClick={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}
              {hits!.brands.length > 0 && (
                <Section title="Brands">
                  {hits!.brands.map((b) => (
                    <SearchItem
                      key={b.slug}
                      href={`/brands/${b.slug}`}
                      title={b.name}
                      onClick={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}
              {hits!.categories.length > 0 && (
                <Section title="Categories">
                  {hits!.categories.map((c) => (
                    <SearchItem
                      key={c.slug}
                      href={`/category/${c.slug}`}
                      title={c.name}
                      subtitle={c.path}
                      onClick={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
          <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-right">
            <button
              type="button"
              onClick={onSubmit}
              className="text-xs font-medium text-neutral-700 hover:text-neutral-950"
            >
              See all results →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function SearchItem({
  href,
  title,
  subtitle,
  onClick,
}: {
  href: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-1.5 hover:bg-neutral-100"
    >
      <p className="font-medium text-neutral-900">{title}</p>
      {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
    </Link>
  );
}
