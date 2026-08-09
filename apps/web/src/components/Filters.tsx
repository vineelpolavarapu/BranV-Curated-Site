'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CustomSelect } from './CustomSelect';
import { Icon } from './icons';

export interface FilterDefinition {
  attributeKey: string;
  displayName: string;
  filterType: 'SELECT' | 'MULTI_SELECT' | 'RANGE' | 'TOGGLE';
  optionsJson?: string[] | null;
}

export interface FilterContext {
  /** Per-category attribute filters from /api/categories/:slug/filters. */
  categoryFilters?: FilterDefinition[];
  /** Universal brand options for the brand multi-select. */
  brands?: Array<{ slug: string; name: string }>;
  /** Retailers that have at least one IN_STOCK listing across results. */
  retailers?: string[];
  /** Colors observed across the current result set. */
  colors?: string[];
}

const UNIVERSAL_FILTERS = [
  { key: 'minPrice', type: 'price-min', label: 'Price' },
  { key: 'discount', type: 'discount', label: 'Discount' },
  { key: 'brand', type: 'brand', label: 'Brand' },
  { key: 'retailer', type: 'retailer', label: 'Retailer' },
] as const;

export function Filters({ context }: { context: FilterContext }) {
  const [openMobile, setOpenMobile] = useState(false);
  const search = useSearchParams();

  const activeCount = useMemo(() => {
    let n = 0;
    for (const [k] of search.entries()) {
      if (k !== 'page' && k !== 'sort' && k !== 'q') n += 1;
    }
    return n;
  }, [search]);

  return (
    <>
      {/* Mobile + tablet trigger */}
      <button
        onClick={() => setOpenMobile(true)}
        className="lg:hidden flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-medium text-content"
      >
        <Icon.Filter size={16} strokeWidth={1.75} aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-fg">
            {activeCount}
          </span>
        )}
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <FilterBody context={context} />
      </aside>

      {/* Mobile sheet */}
      {openMobile && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenMobile(false);
          }}
        >
          <div className="relative mt-16 flex max-h-[82vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3.5 shadow-xs">
              <h2 className="text-base font-bold text-slate-800">Filters</h2>
              <button
                onClick={() => setOpenMobile(false)}
                aria-label="Close filters"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <Icon.Close size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            {/* Scrollable Modal Content */}
            <div className="overflow-y-auto px-5 py-4 pb-28 overscroll-contain space-y-5">
              <FilterBody context={context} onApply={() => setOpenMobile(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterBody({
  context,
  onApply,
}: {
  context: FilterContext;
  onApply?: () => void;
}) {
  return (
    <div className="space-y-6 text-sm">
      <ActiveFilterChips onCleared={onApply} />
      {UNIVERSAL_FILTERS.map((f) => {
        if (f.type === 'price-min') return <PriceFilter key={f.key} />;
        if (f.type === 'discount') return <DiscountFilter key={f.key} />;
        if (f.type === 'brand' && context.brands?.length) {
          return <BrandFilter key={f.key} brands={context.brands} />;
        }
        if (f.type === 'retailer' && context.retailers?.length) {
          return <RetailerFilter key={f.key} retailers={context.retailers} />;
        }
        return null;
      })}
      {(context.categoryFilters ?? []).map((cf) => (
        <CategoryFilter key={cf.attributeKey} filter={cf} />
      ))}
      <ToggleFilter param="onSale" label="On sale only" />
      <ToggleFilter param="inStock" label="In stock at retailer" />
      <ToggleFilter param="isNew" label="New arrivals" />
      <div className="lg:hidden pt-2">
        <button
          onClick={onApply}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ──────────────── small URL-binding helpers ────────────────

function useUrlParam() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function set(name: string, value: string | undefined) {
    const next = new URLSearchParams(Array.from(search.entries()));
    if (value === undefined || value === '') next.delete(name);
    else next.set(name, value);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }
  function toggleArrayValue(name: string, value: string) {
    const next = new URLSearchParams(Array.from(search.entries()));
    const current = next.getAll(name);
    next.delete(name);
    if (current.includes(value)) {
      current.filter((v) => v !== value).forEach((v) => next.append(name, v));
    } else {
      [...current, value].forEach((v) => next.append(name, v));
    }
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }
  function clearAll() {
    const keep = new URLSearchParams();
    const q = search.get('q');
    if (q) keep.set('q', q);
    router.replace(`${pathname}?${keep.toString()}`);
  }
  return { search, set, toggleArrayValue, clearAll };
}

// ──────────────── Active filter chips ────────────────

function ActiveFilterChips({ onCleared }: { onCleared?: () => void }) {
  const { search, clearAll } = useUrlParam();
  const chips: Array<{ key: string; value: string; label: string }> = [];
  for (const [k, v] of search.entries()) {
    if (k === 'page' || k === 'sort' || k === 'q') continue;
    chips.push({ key: k, value: v, label: `${k}: ${v}` });
  }
  if (chips.length === 0) return null;
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <span
            key={`${c.key}-${c.value}`}
            className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-content-soft"
          >
            {c.label}
          </span>
        ))}
      </div>
      <button
        onClick={() => {
          clearAll();
          onCleared?.();
        }}
        className="mt-2 text-xs text-content-soft underline"
      >
        Clear all filters
      </button>
    </div>
  );
}

// ──────────────── Individual filter UIs ────────────────

function PriceFilter() {
  const { search, set } = useUrlParam();
  const min = search.get('minPrice') ?? '';
  const max = search.get('maxPrice') ?? '';
  return (
    <Group title="Price">
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Min"
          value={min}
          onChange={(e) => set('minPrice', e.target.value || undefined)}
          className="w-20 rounded border border-line bg-surface px-2 py-1 text-sm text-content"
        />
        <span className="text-content-muted">-</span>
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={(e) => set('maxPrice', e.target.value || undefined)}
          className="w-20 rounded border border-line bg-surface px-2 py-1 text-sm text-content"
        />
      </div>
    </Group>
  );
}

function DiscountFilter() {
  const { search, set } = useUrlParam();
  const current = search.get('discount') ?? '';
  return (
    <Group title="Discount">
      <div className="flex flex-wrap gap-1">
        {['10', '20', '30', '50'].map((d) => (
          <button
            key={d}
            onClick={() => set('discount', current === d ? undefined : d)}
            className={`rounded-md border px-2 py-1 text-xs ${current === d
              ? 'border-primary bg-primary text-primary-fg'
              : 'border-line hover:bg-surface-muted'
              }`}
          >
            {d}%+
          </button>
        ))}
      </div>
    </Group>
  );
}

function BrandFilter({
  brands,
}: {
  brands: Array<{ slug: string; name: string }>;
}) {
  const { search, toggleArrayValue } = useUrlParam();
  const selected = new Set(search.getAll('brand'));
  return (
    <Group title="Brand">
      <ul className="max-h-44 space-y-1 overflow-auto pr-1">
        {brands.map((b) => (
          <li key={b.slug}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(b.slug)}
                onChange={() => toggleArrayValue('brand', b.slug)}
              />
              {b.name}
            </label>
          </li>
        ))}
      </ul>
    </Group>
  );
}

function RetailerFilter({ retailers }: { retailers: string[] }) {
  const { search, toggleArrayValue } = useUrlParam();
  const selected = new Set(search.getAll('retailer'));
  return (
    <Group title="Retailer">
      <ul className="space-y-1">
        {retailers.map((r) => (
          <li key={r}>
            <label className="flex items-center gap-2 text-sm capitalize">
              <input
                type="checkbox"
                checked={selected.has(r)}
                onChange={() => toggleArrayValue('retailer', r)}
              />
              {r}
            </label>
          </li>
        ))}
      </ul>
    </Group>
  );
}

function CategoryFilter({ filter }: { filter: FilterDefinition }) {
  const { search, set, toggleArrayValue } = useUrlParam();

  if (filter.filterType === 'TOGGLE') {
    const checked = search.get(filter.attributeKey) === 'true';
    return (
      <Group title={filter.displayName}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) =>
              set(filter.attributeKey, e.target.checked ? 'true' : undefined)
            }
          />
          {filter.displayName}
        </label>
      </Group>
    );
  }

  const options = Array.isArray(filter.optionsJson) ? filter.optionsJson : [];
  if (options.length === 0) return null;

  // Universal-named keys (size, color, material) map to top-level query params
  // the API already understands; everything else uses the attributeKey verbatim.
  const paramName =
    filter.attributeKey === 'size' || filter.attributeKey === 'color'
      ? filter.attributeKey
      : filter.attributeKey === 'material'
        ? 'material'
        : filter.attributeKey;

  const selected = new Set(search.getAll(paramName));

  if (filter.filterType === 'SELECT') {
    const current = search.get(paramName) ?? '';
    return (
      <Group title={filter.displayName}>
        <CustomSelect
          value={current}
          onChange={(v) => set(paramName, v || undefined)}
          options={[
            { value: '', label: 'Any' },
            ...options.map((o) => ({ value: o, label: o })),
          ]}
          className="w-full"
          ariaLabel={filter.displayName}
        />
      </Group>
    );
  }

  return (
    <Group title={filter.displayName}>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = selected.has(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggleArrayValue(paramName, o)}
              className={`rounded-md border px-2 py-1 text-xs ${active
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-line hover:bg-surface-muted'
                }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </Group>
  );
}

function ToggleFilter({ param, label }: { param: string; label: string }) {
  const { search, set } = useUrlParam();
  const checked = search.get(param) === 'true';
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => set(param, e.target.checked ? 'true' : undefined)}
      />
      {label}
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-content-soft">
        {title}
      </p>
      {children}
    </div>
  );
}

// ──────────────── Sort dropdown (sibling component for listings) ────────────────

export function SortPicker() {
  const { search, set } = useUrlParam();
  const value = search.get('sort') ?? 'Filter';
  return (
    <CustomSelect
      value={value}
      onChange={(v) => set('sort', v)}
      ariaLabel="Sort by"
      options={[
        { value: 'relevance', label: 'Relevance' },
        { value: 'newest', label: 'Newest' },
        { value: 'oldest', label: 'Oldest' },
        { value: 'best_rated', label: 'Best rated' },
      ]}
    />
  );
}
