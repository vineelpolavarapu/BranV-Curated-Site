'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { DropAdmin } from '@/lib/phase7-types';
import { AdminShell, adminButtonSecondary } from '@/components/AdminShell';
import { DropEditor } from '@/components/admin/DropEditor';

export default function EditDropPage() {
  const params = useParams<{ id: string }>();
  const [drop, setDrop] = useState<DropAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiFetch<DropAdmin>(`/admin/drops/${params.id}`);
      if (res.ok && res.data) setDrop(res.data);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return (
      <AdminShell title="Loading drop…">
        <div className="h-2 w-32 animate-pulse rounded bg-neutral-200" />
      </AdminShell>
    );
  }
  if (!drop) {
    return (
      <AdminShell title="Drop not found">
        <button className={adminButtonSecondary}>Back</button>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={drop.name}>
      <p className="mb-4 text-sm text-neutral-500">/{drop.slug}</p>
      <DropEditor drop={drop} />
    </AdminShell>
  );
}
