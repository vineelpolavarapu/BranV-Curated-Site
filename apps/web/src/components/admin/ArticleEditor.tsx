'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { AdminArticle, ArticleStatus } from '@/lib/article-types';
import {
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';
import { ProductPicker } from './ProductPicker';

interface Props {
  article?: AdminArticle;
}

export function ArticleEditor({ article }: Props) {
  const router = useRouter();
  const editing = !!article;

  const [title, setTitle] = useState(article?.title ?? '');
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [heroUrl, setHeroUrl] = useState(article?.heroUrl ?? '');
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? '');
  const [bodyMd, setBodyMd] = useState(
    article?.bodyMd ??
      '# New article\n\nWrite your intro paragraph here.\n\nUse **Insert product** above to drop a shoppable card.\n',
  );
  const [status, setStatus] = useState<ArticleStatus>(article?.status ?? 'DRAFT');
  const [scheduledAt, setScheduledAt] = useState(
    article?.scheduledAt ? toLocalDateTimeInput(article.scheduledAt) : '',
  );
  const [tags, setTags] = useState((article?.tags ?? []).join(', '));
  const [metaTitle, setMetaTitle] = useState(article?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(
    article?.metaDescription ?? '',
  );
  const [ogImage, setOgImage] = useState(article?.ogImage ?? '');

  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setBodyMd((b) => b + '\n' + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = bodyMd.slice(0, start);
    const after = bodyMd.slice(end);
    const next = `${before}\n\n${text}\n\n${after}`;
    setBodyMd(next);
    // Move caret to just past the inserted snippet.
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = before.length + text.length + 4;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  function onPickProduct({ slug }: { slug: string; title: string }) {
    setShowPicker(false);
    insertAtCursor(`<div data-product="${slug}"></div>`);
  }

  async function onSave(overrideStatus?: ArticleStatus) {
    setSubmitting(true);
    setError(null);
    setFlash(null);

    const effectiveStatus = overrideStatus ?? status;
    const body = {
      title,
      slug: slug || undefined,
      heroUrl: heroUrl || undefined,
      excerpt: excerpt || undefined,
      bodyMd,
      status: effectiveStatus,
      scheduledAt: scheduledAt
        ? new Date(scheduledAt).toISOString()
        : undefined,
      tags: tags
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
      ogImage: ogImage || undefined,
    };

    const result = editing
      ? await apiFetch<AdminArticle>(`/admin/articles/${article!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch<AdminArticle>('/admin/articles', {
          method: 'POST',
          body: JSON.stringify(body),
        });

    setSubmitting(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Save failed');
      return;
    }
    setStatus(result.data.status);
    setFlash(
      editing ? '✓ Saved' : `✓ Created · ${result.data.status}`,
    );
    if (!editing) {
      router.replace(`/admin/articles/${result.data.id}`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await onSave();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className={adminCard}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={adminLabel}>Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated from title"
                className={adminInput}
              />
            </div>
            <div>
              <label className={adminLabel}>Tags (comma-separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="monsoon, formal, edit"
                className={adminInput}
              />
            </div>
            <div className="md:col-span-2">
              <label className={adminLabel}>Hero image URL</label>
              <input
                type="url"
                value={heroUrl}
                onChange={(e) => setHeroUrl(e.target.value)}
                placeholder="https://…"
                className={adminInput}
              />
            </div>
            <div className="md:col-span-2">
              <label className={adminLabel}>Excerpt</label>
              <textarea
                rows={2}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className={adminInput}
              />
            </div>
          </div>
        </div>

        <div className={adminCard}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-content-soft">
              Body (Markdown)
            </h2>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className={adminButtonSecondary}
            >
              + Insert product
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <textarea
              ref={textareaRef}
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              rows={22}
              spellCheck
              className={`${adminInput} font-mono text-sm`}
            />
            <div className="overflow-auto rounded-md border border-line bg-surface p-4">
              <div className="prose prose-sm prose-neutral max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    div(props) {
                      const { node: _node, ...rest } = props as {
                        node?: unknown;
                      } & Record<string, unknown>;
                      const slug = rest['data-product'];
                      if (typeof slug === 'string') {
                        return (
                          <div className="my-4 rounded-md border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-success">
                            🛍 product embed · <code>{slug}</code>
                          </div>
                        );
                      }
                      return <div {...(rest as Record<string, unknown>)} />;
                    },
                  }}
                >
                  {bodyMd}
                </ReactMarkdown>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-content-soft">
            Embeds resolve to live shoppable cards on the public page.
          </p>
        </div>

        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-soft">
            SEO
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={adminLabel}>Meta title</label>
              <input
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className={adminInput}
                placeholder={title}
              />
            </div>
            <div className="md:col-span-2">
              <label className={adminLabel}>Meta description</label>
              <textarea
                rows={2}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className={adminInput}
              />
            </div>
            <div className="md:col-span-2">
              <label className={adminLabel}>OG image URL</label>
              <input
                type="url"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                className={adminInput}
              />
            </div>
          </div>
        </div>

        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-soft">
            Publish
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={adminLabel}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ArticleStatus)}
                className={adminInput}
              >
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className={adminLabel}>Scheduled for</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={adminInput}
              />
              <p className="mt-1 text-xs text-content-soft">
                Scheduler flips SCHEDULED → PUBLISHED within ~60s of this time.
              </p>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          {flash && <p className="mt-3 text-sm text-success">{flash}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className={adminButtonPrimary}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
            {status !== 'PUBLISHED' && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => onSave('PUBLISHED')}
                className={adminButtonSecondary}
              >
                Publish now
              </button>
            )}
          </div>
        </div>
      </form>

      <ProductPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onPick={onPickProduct}
      />
    </>
  );
}

function toLocalDateTimeInput(iso: string): string {
  // datetime-local needs YYYY-MM-DDTHH:mm without timezone — convert from ISO.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
