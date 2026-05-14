'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { AdminArticle } from '@/lib/article-types';
import { AdminShell, adminButtonSecondary } from '@/components/AdminShell';
import { ArticleEditor } from '@/components/admin/ArticleEditor';

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<AdminArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiFetch<AdminArticle>(
        `/admin/articles/${params.id}`,
      );
      if (res.ok && res.data) setArticle(res.data);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return (
      <AdminShell title="Loading article…">
        <div className="h-2 w-32 animate-pulse rounded bg-neutral-200" />
      </AdminShell>
    );
  }
  if (!article) {
    return (
      <AdminShell title="Article not found">
        <button className={adminButtonSecondary}>Back</button>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={article.title}>
      <p className="mb-4 text-sm text-neutral-500">/{article.slug}</p>
      <ArticleEditor article={article} />
    </AdminShell>
  );
}
