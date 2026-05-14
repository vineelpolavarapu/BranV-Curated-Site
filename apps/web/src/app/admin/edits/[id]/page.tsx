'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { EditAdmin } from '@/lib/phase7-types';
import { AdminShell, adminButtonSecondary } from '@/components/AdminShell';
import { EditEditor } from '@/components/admin/EditEditor';

export default function EditEditPage() {
  const params = useParams<{ id: string }>();
  const [edit, setEdit] = useState<EditAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiFetch<EditAdmin>(`/admin/edits/${params.id}`);
      if (res.ok && res.data) setEdit(res.data);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return (
      <AdminShell title="Loading…">
        <div className="h-2 w-32 animate-pulse rounded bg-neutral-200" />
      </AdminShell>
    );
  }
  if (!edit) {
    return (
      <AdminShell title="Edit not found">
        <button className={adminButtonSecondary}>Back</button>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={edit.title}>
      <p className="mb-4 text-sm text-neutral-500">/{edit.slug}</p>
      <EditEditor edit={edit} />
    </AdminShell>
  );
}
