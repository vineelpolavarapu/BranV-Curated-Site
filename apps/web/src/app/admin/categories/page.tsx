'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AttributeSchema, CategoryNode, FilterType } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

const FILTER_TYPES: FilterType[] = ['SELECT', 'MULTI_SELECT', 'RANGE', 'TOGGLE'];

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
  const [schemas, setSchemas] = useState<AttributeSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AttributeSchema | null>(null);

  const tree = useMemo(() => buildTree(categories), [categories]);
  const selected = useMemo(
    () => categories.find((c) => c.id === selectedId) ?? null,
    [categories, selectedId],
  );

  useEffect(() => {
    void (async () => {
      const result = await apiFetch<CategoryNode[]>('/admin/categories');
      if (result.ok && result.data) {
        setCategories(result.data);
      }
      // Don't auto-expand or auto-select — landing shows only L1 names so the
      // admin can pick which one to drill into.
      setLoading(false);
    })();
  }, []);

  function toggleL1(id: string) {
    setExpandedL1s((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedId(id);
  }

  function pickL2(id: string, parentId: string | null) {
    setSelectedId(id);
    if (parentId) {
      setExpandedL1s((prev) => {
        if (prev.has(parentId)) return prev;
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setSchemas([]);
      return;
    }
    void (async () => {
      const result = await apiFetch<AttributeSchema[]>(
        `/admin/categories/${selectedId}/attribute-schemas`,
      );
      if (result.ok && result.data) setSchemas(result.data);
    })();
  }, [selectedId]);

  async function refreshSchemas() {
    if (!selectedId) return;
    const result = await apiFetch<AttributeSchema[]>(
      `/admin/categories/${selectedId}/attribute-schemas`,
    );
    if (result.ok && result.data) setSchemas(result.data);
  }

  async function onDeleteSchema(attributeKey: string) {
    if (!selectedId) return;
    if (!confirm(`Delete the "${attributeKey}" attribute schema?`)) return;
    await apiFetch(
      `/admin/categories/${selectedId}/attribute-schemas/${attributeKey}`,
      { method: 'DELETE' },
    );
    await refreshSchemas();
  }

  return (
    <AdminShell title="Categories & filters">
      <p className="mb-4 text-sm text-neutral-600">
        L1/L2 categories are seeded via <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">pnpm seed:catalog</code>.
        Edit attribute schemas here they drive the storefront filter UI in Phase 4.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className={`${adminCard} min-w-0 overflow-hidden`}>
          
          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : (
            <ul className="space-y-0.5 overflow-hidden text-sm">
              {tree.map((l1) => (
                <CategoryAccordion
                  key={l1.id}
                  l1={l1}
                  expanded={expandedL1s.has(l1.id)}
                  selectedId={selectedId}
                  onToggle={() => toggleL1(l1.id)}
                  onPickChild={(childId) => pickL2(childId, l1.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          {!selected ? (
            <div className={adminCard}>
              <p className="text-sm text-neutral-500">Select a category.</p>
            </div>
          ) : (
            <div className={`${adminCard} min-w-0`}>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-neutral-500">
                    Attribute schemas for
                  </p>
                  <h2 className="truncate text-xl font-semibold tracking-tight">
                    {selected.name}
                  </h2>
                  <p className="truncate text-xs text-neutral-500">{selected.path}</p>
                </div>
                <button
                  onClick={() => {
                    setEditing(null);
                    setShowForm(true);
                  }}
                  className={`${adminButtonPrimary} shrink-0 self-start sm:self-auto`}
                >
                  + Add attribute
                </button>
              </div>

              {schemas.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No attributes for this category yet.
                </p>
              ) : (
                <>
                  {/* Mobile: stacked cards — no horizontal overflow */}
                  <ul className="space-y-3 sm:hidden">
                    {schemas.map((s) => (
                      <li
                        key={s.id}
                        className="min-w-0 rounded-xl border border-neutral-200 p-3"
                      >
                        <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.displayName}</p>
                            <p className="truncate font-mono text-xs text-neutral-500">
                              {s.attributeKey}
                            </p>
                          </div>
                          <button
                            onClick={() => onDeleteSchema(s.attributeKey)}
                            className={`${adminButtonDanger} shrink-0`}
                          >
                            Delete
                          </button>
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                          <dt className="text-neutral-500">Type</dt>
                          <dd className="min-w-0 truncate text-neutral-700">{s.filterType}</dd>
                          <dt className="text-neutral-500">Options</dt>
                          <dd className="min-w-0 truncate text-neutral-500">
                            {Array.isArray(s.optionsJson)
                              ? (s.optionsJson as string[]).join(', ')
                              : '—'}
                          </dd>
                        </dl>
                      </li>
                    ))}
                  </ul>

                  {/* Tablet/desktop: table */}
                  <div className="hidden sm:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                          <th className="pb-2 font-medium">Key</th>
                          <th className="pb-2 font-medium">Display</th>
                          <th className="pb-2 font-medium">Type</th>
                          <th className="pb-2 font-medium">Options</th>
                          <th className="pb-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {schemas.map((s) => (
                          <tr key={s.id} className="border-b border-neutral-100">
                            <td className="py-2 font-mono text-xs">{s.attributeKey}</td>
                            <td className="py-2">{s.displayName}</td>
                            <td className="py-2 text-neutral-600">{s.filterType}</td>
                            <td className="max-w-xs truncate py-2 text-xs text-neutral-500">
                              {Array.isArray(s.optionsJson)
                                ? (s.optionsJson as string[]).join(', ')
                                : '—'}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => onDeleteSchema(s.attributeKey)}
                                  className={adminButtonDanger}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showForm && selected && (
        <AttributeForm
          categoryId={selected.id}
          schema={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await refreshSchemas();
          }}
        />
      )}
    </AdminShell>
  );
}

type Tree = CategoryNode & { children: Tree[] };

function buildTree(items: CategoryNode[]): Tree[] {
  const map = new Map<string, Tree>();
  items.forEach((i) => map.set(i.id, { ...i, children: [] }));
  const roots: Tree[] = [];
  map.forEach((n) => {
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(n);
    else roots.push(n);
  });
  return roots;
}

function CategoryAccordion({
  l1,
  expanded,
  selectedId,
  onToggle,
  onPickChild,
}: {
  l1: Tree;
  expanded: boolean;
  selectedId: string | null;
  onToggle: () => void;
  onPickChild: (id: string) => void;
}) {
  const isL1Selected = selectedId === l1.id;
  const hasChildren = l1.children.length > 0;

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-controls={hasChildren ? `cat-children-${l1.id}` : undefined}
        className={`flex w-full min-w-0 items-center justify-between rounded px-2 py-1.5 text-left transition ${
          isL1Selected
            ? 'bg-neutral-900 text-white'
            : 'hover:bg-neutral-100'
        }`}
      >
        <span className="min-w-0 truncate font-medium">{l1.name}</span>
        <span className="ml-2 flex shrink-0 items-center gap-2">
          {l1._count && l1._count.attributeSchemas > 0 && (
            <span className="text-[10px] uppercase opacity-60">
              {l1._count.attributeSchemas}
            </span>
          )}
          {hasChildren && <Chevron expanded={expanded} />}
        </span>
      </button>
      {hasChildren && (
        <div
          id={`cat-children-${l1.id}`}
          // grid-rows-[0fr→1fr] gives a smooth collapse without measuring height
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <ul className="ml-3 mt-0.5 space-y-0.5 overflow-hidden border-l border-neutral-200 pl-2">
            {l1.children.map((l2) => {
              const isL2Selected = selectedId === l2.id;
              return (
                <li key={l2.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onPickChild(l2.id)}
                    className={`flex w-full min-w-0 items-center justify-between rounded px-2 py-1.5 text-left text-sm transition ${
                      isL2Selected
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="min-w-0 truncate">{l2.name}</span>
                    {l2._count && l2._count.attributeSchemas > 0 && (
                      <span className="ml-2 shrink-0 text-[10px] uppercase opacity-60">
                        {l2._count.attributeSchemas}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      className={`transition-transform duration-200 ${
        expanded ? 'rotate-180' : ''
      }`}
    >
      <path
        d="M2 4 L6 8 L10 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AttributeForm({
  categoryId,
  schema,
  onClose,
  onSaved,
}: {
  categoryId: string;
  schema: AttributeSchema | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [attributeKey, setAttributeKey] = useState(schema?.attributeKey ?? '');
  const [displayName, setDisplayName] = useState(schema?.displayName ?? '');
  const [filterType, setFilterType] = useState<FilterType>(
    schema?.filterType ?? 'MULTI_SELECT',
  );
  const [optionsCsv, setOptionsCsv] = useState(
    Array.isArray(schema?.optionsJson)
      ? (schema?.optionsJson as string[]).join(', ')
      : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsOptions = filterType === 'SELECT' || filterType === 'MULTI_SELECT';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const optionsJson = needsOptions
      ? optionsCsv
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
    const body = {
      attributeKey,
      displayName,
      filterType,
      optionsJson,
    };
    const result = await apiFetch(
      `/admin/categories/${categoryId}/attribute-schemas`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Save failed');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="min-w-0 truncate text-lg font-semibold">
            {schema ? 'Edit attribute' : 'New attribute'}
          </h2>
          <button onClick={onClose} className="shrink-0 text-neutral-400">✕</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={adminLabel}>Key</label>
              <input
                required
                disabled={!!schema}
                value={attributeKey}
                onChange={(e) => setAttributeKey(e.target.value)}
                className={adminInput}
                placeholder="e.g. size"
              />
            </div>
            <div>
              <label className={adminLabel}>Display name</label>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={adminInput}
                placeholder="e.g. Size"
              />
            </div>
          </div>
          <div>
            <label className={adminLabel}>Filter type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className={adminInput}
            >
              {FILTER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {needsOptions && (
            <div>
              <label className={adminLabel}>Options (comma-separated)</label>
              <input
                value={optionsCsv}
                onChange={(e) => setOptionsCsv(e.target.value)}
                className={adminInput}
                placeholder="XS, S, M, L, XL"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={adminButtonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={adminButtonPrimary}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
