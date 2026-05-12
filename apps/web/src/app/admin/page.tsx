'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Brand,
  CategoryNode,
  Page,
  ProductRow,
  Avatar,
} from '@/lib/admin-types';
import { AdminShell, adminCard } from '@/components/AdminShell';

export default function AdminDashboardPage() {
  const [brands, setBrands] = useState(0);
  const [products, setProducts] = useState(0);
  const [drafts, setDrafts] = useState(0);
  const [categories, setCategories] = useState(0);
  const [avatars, setAvatars] = useState(0);

  useEffect(() => {
    void (async () => {
      const [b, p, d, c, a] = await Promise.all([
        apiFetch<Page<Brand>>('/admin/brands?pageSize=1'),
        apiFetch<Page<ProductRow>>('/admin/products?pageSize=1'),
        apiFetch<Page<ProductRow>>('/admin/products?pageSize=1&status=DRAFT'),
        apiFetch<CategoryNode[]>('/admin/categories'),
        apiFetch<Avatar[]>('/admin/avatars'),
      ]);
      if (b.ok && b.data) setBrands(b.data.total);
      if (p.ok && p.data) setProducts(p.data.total);
      if (d.ok && d.data) setDrafts(d.data.total);
      if (c.ok && c.data) setCategories(c.data.length);
      if (a.ok && a.data) setAvatars(a.data.length);
    })();
  }, []);

  return (
    <AdminShell title="Dashboard">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Brands" value={brands} href="/admin/brands" />
        <Stat label="Products" value={products} href="/admin/products" />
        <Stat label="Drafts" value={drafts} href="/admin/products?status=DRAFT" />
        <Stat label="Categories" value={categories} href="/admin/categories" />
        <Stat label="Avatars" value={avatars} href="/admin/avatars" />
      </div>

      <div className={`${adminCard} mt-8`}>
        <h2 className="mb-2 text-lg font-semibold">Catalog core online</h2>
        <p className="text-sm text-neutral-600">
          Phase 2 ships brand, category, product and avatar management. The
          Quick Add modal (single-modal product entry under 60 seconds) lands in
          Phase 3. Click analytics and audit dashboards land in Phase 10.
        </p>
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </Link>
  );
}
