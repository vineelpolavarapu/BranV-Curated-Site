'use client';

import { AdminShell } from '@/components/AdminShell';
import { EditEditor } from '@/components/admin/EditEditor';

export default function NewEditPage() {
  return (
    <AdminShell title="New edit">
      <EditEditor />
    </AdminShell>
  );
}
