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
        const firstL1 = result.data.find((c) => !c.parentId);
        if (firstL1) setSelectedId(firstL1.id);
      }
      setLoading(false);
    })();
  }, []);

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
        Edit attribute schemas here — they drive the storefront filter UI in Phase 4.
      </p>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-700">
            Taxonomy
          </h2>
          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : (
            <ul className="space-y-0.5 text-sm">
              {tree.map((node) => (
                <CategoryNodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          {!selected ? (
            <div className={adminCard}>
              <p className="text-sm text-neutral-500">Select a category.</p>
            </div>
          ) : (
            <div className={adminCard}>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-500">
                    Attribute schemas for
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {selected.name}
                  </h2>
                  <p className="text-xs text-neutral-500">{selected.path}</p>
                </div>
                <button
                  onClick={() => {
                    setEditing(null);
                    setShowForm(true);
                  }}
                  className={adminButtonPrimary}
                >
                  + Add attribute
                </button>
              </div>

              {schemas.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No attributes for this category yet.
                </p>
              ) : (
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
                              onClick={() => {
                                setEditing(s);
                                setShowForm(true);
                              }}
                              className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                            >
                              Edit
                            </button>
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

function CategoryNodeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: Tree;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <li>
        <button
          onClick={() => onSelect(node.id)}
          className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left ${
            selectedId === node.id
              ? 'bg-neutral-900 text-white'
              : 'hover:bg-neutral-100'
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <span>{node.name}</span>
          {node._count && node._count.attributeSchemas > 0 && (
            <span className="ml-2 text-[10px] uppercase opacity-60">
              {node._count.attributeSchemas}
            </span>
          )}
        </button>
      </li>
      {node.children.map((c) => (
        <CategoryNodeRow
          key={c.id}
          node={c}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
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
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            {schema ? 'Edit attribute' : 'New attribute'}
          </h2>
          <button onClick={onClose} className="text-neutral-400">✕</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
