'use client';

import { AdminShell } from '@/components/AdminShell';
import { DropEditor } from '@/components/admin/DropEditor';

export default function NewDropPage() {
  return (
    <AdminShell title="New drop">
      <DropEditor />
    </AdminShell>
  );
}
