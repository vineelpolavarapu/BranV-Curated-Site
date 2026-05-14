'use client';

import { AdminShell } from '@/components/AdminShell';
import { ArticleEditor } from '@/components/admin/ArticleEditor';

export default function NewArticlePage() {
  return (
    <AdminShell title="New article">
      <ArticleEditor />
    </AdminShell>
  );
}
