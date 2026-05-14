'use client';

import { AdminShell } from '@/components/AdminShell';
import { LookbookEditor } from '@/components/admin/LookbookEditor';

export default function NewLookbookPage() {
  return (
    <AdminShell title="New lookbook">
      <LookbookEditor />
    </AdminShell>
  );
}
