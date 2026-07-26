'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AutocompleteResult } from '@/lib/storefront-types';
import { Icon } from './icons';

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
    ? 'w-full h-12 rounded-full border border-white/40 bg-primary-fg/10 pl-11 pr-12 text-sm text-primary-fg outline-none placeholder:text-primary-fg/70 backdrop-blur focus:border-primary-fg focus:bg-primary-fg/20 focus:ring-2 focus:ring-primary-fg/50 transition-all'
    : 'w-full h-12 rounded-full border border-line bg-surface pl-11 pr-12 text-sm text-content outline-none placeholder:text-content-muted focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm transition-all';
  const iconClasses = overlay
    ? 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary-fg/80'
    : 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-muted';

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl">
      <form onSubmit={onSubmit} className="relative flex items-center">
        <Icon.Search size={18} strokeWidth={1.8} aria-hidden className={iconClasses} />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search for shirts, jeans, jackets…"
          className={inputClasses}
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-1.5 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-fg shadow-sm transition-all hover:bg-primary-hover hover:scale-105 active:scale-95"
        >
          <Icon.Search size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </form>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface text-content shadow-xl">
          {!hasHits ? (
            <p className="px-4 py-3 text-sm text-content-soft">No matches.</p>
          ) : (
            <div className="max-h-96 divide-y divide-line overflow-auto py-1 text-sm">
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
          <div className="border-t border-line bg-surface-muted px-3 py-2 text-right">
            <button
              type="button"
              onClick={onSubmit}
              className="text-xs font-medium text-content-soft hover:text-primary"
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
      <p className="px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-content-muted">
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
      className="block px-4 py-1.5 hover:bg-surface-muted"
    >
      <p className="font-medium text-content">{title}</p>
      {subtitle && <p className="text-xs text-content-soft">{subtitle}</p>}
    </Link>
  );
}
