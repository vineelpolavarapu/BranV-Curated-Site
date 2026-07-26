'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { LookbookAdmin } from '@/lib/phase7-types';
import { AdminShell, adminButtonSecondary } from '@/components/AdminShell';
import { LookbookEditor } from '@/components/admin/LookbookEditor';

export default function EditLookbookPage() {
  const params = useParams<{ id: string }>();
  const [lookbook, setLookbook] = useState<LookbookAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiFetch<LookbookAdmin>(`/admin/lookbooks/${params.id}`);
      if (res.ok && res.data) setLookbook(res.data);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return (
      <AdminShell title="Loading…">
        <div className="h-2 w-32 animate-pulse rounded bg-line" />
      </AdminShell>
    );
  }
  if (!lookbook) {
    return (
      <AdminShell title="Lookbook not found">
        <button className={adminButtonSecondary}>Back</button>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={lookbook.title}>
      <p className="mb-4 text-sm text-content-soft">/{lookbook.slug}</p>
      <LookbookEditor lookbook={lookbook} />
    </AdminShell>
  );
}
