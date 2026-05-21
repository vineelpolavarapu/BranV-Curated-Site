'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Avatar } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

export default function AvatarsAdminPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Avatar | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const result = await apiFetch<Avatar[]>('/admin/avatars');
    if (result.ok && result.data) setAvatars(result.data);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function copyPrompt(avatar: Avatar) {
    await navigator.clipboard.writeText(avatar.promptTemplate);
    setCopiedId(avatar.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this avatar reference?')) return;
    const result = await apiFetch(`/admin/avatars/${id}`, { method: 'DELETE' });
    if (result.ok) await refresh();
    else alert(result.error ?? 'Failed to delete');
  }

  return (
    <AdminShell
      title="Avatar library"
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className={adminButtonPrimary}
        >
          + New avatar
        </button>
      }
    >
      <p className="mb-4 text-sm text-neutral-600">
        Vineel&apos;s AI avatar reference library. Each entry stores a reference
        image and the prompt template used to recreate the look in Gemini /
        ChatGPT / Midjourney. Tap <strong>Copy Prompt</strong> on a card and
        paste into the model.
      </p>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : avatars.length === 0 ? (
        <div className={adminCard}>
          <p className="text-sm text-neutral-500">
            No avatars yet. Add Vineel&apos;s base references to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {avatars.map((a) => (
            <article
              key={a.id}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
            >
              <div className="relative aspect-[3/4] bg-neutral-100">
                <Image
                  src={a.referenceImageUrl}
                  alt={a.name}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="space-y-2 p-4">
                <h3 className="text-sm font-semibold">{a.name}</h3>
                {a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="line-clamp-3 text-xs text-neutral-600">
                  {a.promptTemplate}
                </p>
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => copyPrompt(a)}
                    className={adminButtonSecondary}
                  >
                    {copiedId === a.id ? '✓ Copied' : 'Copy Prompt'}
                  </button>
                  <div className="flex gap-2">
                    {/* <button
                      onClick={() => {
                        setEditing(a);
                        setShowForm(true);
                      }}
                      className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                    >
                      Edit
                    </button> */}
                    <button
                      onClick={() => onDelete(a.id)}
                      className={adminButtonDanger}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <AvatarForm
          avatar={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </AdminShell>
  );
}

function AvatarForm({
  avatar,
  onClose,
  onSaved,
}: {
  avatar: Avatar | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(avatar?.name ?? '');
  const [referenceImageUrl, setReferenceImageUrl] = useState(
    avatar?.referenceImageUrl ?? '',
  );
  const [promptTemplate, setPromptTemplate] = useState(avatar?.promptTemplate ?? '');
  const [tags, setTags] = useState((avatar?.tags ?? []).join(', '));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = {
      name,
      referenceImageUrl,
      promptTemplate,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    const result = avatar
      ? await apiFetch(`/admin/avatars/${avatar.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch('/admin/avatars', {
          method: 'POST',
          body: JSON.stringify(body),
        });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Save failed');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            {avatar ? 'Edit avatar' : 'New avatar reference'}
          </h2>
          <button onClick={onClose} className="text-neutral-400">✕</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={adminLabel}>Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vineel — studio front"
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Reference image URL</label>
            <input
              required
              type="url"
              value={referenceImageUrl}
              onChange={(e) => setReferenceImageUrl(e.target.value)}
              placeholder="https://…"
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Prompt template</label>
            <textarea
              required
              rows={6}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="Use {{outfit}} where you want the per-product styling to be injected."
              className={adminInput}
            />
          </div>
          <div>
            <label className={adminLabel}>Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="studio, front, urban"
              className={adminInput}
            />
          </div>
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
