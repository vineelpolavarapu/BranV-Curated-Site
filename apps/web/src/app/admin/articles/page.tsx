'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminArticle, ArticleStatus } from '@/lib/article-types';
import { Page as PageT } from '@/lib/admin-types';
import {
  AdminShell,
  adminButtonDanger,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
} from '@/components/AdminShell';

const STATUSES: Array<ArticleStatus | ''> = [
  '',
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'ARCHIVED',
];

export default function ArticlesAdminPage() {
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ArticleStatus | ''>('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('pageSize', '40');
    const res = await apiFetch<PageT<AdminArticle>>(
      `/admin/articles?${params}`,
    );
    if (res.ok && res.data) {
      setArticles(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onArchive(id: string) {
    if (!confirm('Archive this article? It will be hidden from the public site.'))
      return;
    const res = await apiFetch(`/admin/articles/${id}`, { method: 'DELETE' });
    if (res.ok) await refresh();
    else alert(res.error ?? 'Failed to archive');
  }

  return (
    <AdminShell
      title="Articles"
      actions={
        <Link href="/admin/articles/new" className={adminButtonPrimary}>
          + New article
        </Link>
      }
    >
      <div className={`${adminCard} mb-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title / slug…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void refresh();
            }}
            className={`${adminInput} max-w-xs`}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ArticleStatus | '')}
            className={`${adminInput} max-w-[160px]`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <button onClick={refresh} className={adminButtonSecondary}>
            Apply
          </button>
          <span className="ml-auto text-sm text-neutral-500">{total} total</span>
        </div>
      </div>

      <div className={adminCard}>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : articles.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No articles yet. Click <strong>+ New article</strong> to start.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-2 pb-3 font-medium">Article</th>
                <th className="px-2 pb-3 font-medium">Status</th>
                <th className="px-2 pb-3 font-medium">Embeds</th>
                <th className="px-2 pb-3 font-medium">Scheduled / Published</th>
                <th className="px-2 pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100">
                  <td className="px-2 py-3">
                    <Link
                      href={`/admin/articles/${a.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-neutral-500">/{a.slug}</p>
                  </td>
                  <td className="px-2 py-3">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="px-2 py-3 text-neutral-600">
                    {a._count?.articleProducts ?? 0}
                  </td>
                  <td className="px-2 py-3 text-xs text-neutral-600">
                    {a.status === 'SCHEDULED' && a.scheduledAt
                      ? `→ ${new Date(a.scheduledAt).toLocaleString()}`
                      : a.publishedAt
                        ? new Date(a.publishedAt).toLocaleString()
                        : '—'}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/articles/${a.id}`}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                      >
                        Edit
                      </Link>
                      {a.status === 'PUBLISHED' && (
                        <a
                          href={`/articles/${a.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                        >
                          View ↗
                        </a>
                      )}
                      {a.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => onArchive(a.id)}
                          className={adminButtonDanger}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function StatusPill({ status }: { status: ArticleStatus }) {
  const tone =
    status === 'PUBLISHED'
      ? 'bg-green-100 text-green-800'
      : status === 'SCHEDULED'
        ? 'bg-blue-100 text-blue-800'
        : status === 'DRAFT'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-neutral-200 text-neutral-700';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}
