'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { DashboardPayload } from '@/lib/phase10-types';
import { AdminShell, adminCard } from '@/components/AdminShell';
import { MiniBarChart } from '@/components/admin/MiniBarChart';

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiFetch<DashboardPayload>(
        '/admin/analytics/dashboard',
      );
      if (res.ok && res.data) setData(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading || !data) {
    return (
      <AdminShell title="Dashboard">
        <div className="h-2 w-32 animate-pulse rounded bg-neutral-200" />
      </AdminShell>
    );
  }

  const today = data.overview['1d'];
  const mtd = data.overview['30d'];

  return (
    <AdminShell title="Dashboard">
      {/* Alert chips */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {data.system.syncFailureCount > 0 && (
          <Link
            href="/admin/products"
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            {data.system.syncFailureCount} sync failure
            {data.system.syncFailureCount === 1 ? '' : 's'}
          </Link>
        )}
        {data.system.pendingAffiliateConversions > 0 && (
          <span className="rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            {data.system.pendingAffiliateConversions} pending affiliate conversions
          </span>
        )}
        {data.system.notificationOutbox.failed > 0 && (
          <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            {data.system.notificationOutbox.failed} failed notifications
          </span>
        )}
        {data.system.hiddenReviewCount > 0 && (
          <Link
            href="/admin/reviews"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-50"
          >
            {data.system.hiddenReviewCount} hidden reviews
          </Link>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Clicks today"
          value={today.clicks}
          sub={`${data.overview['7d'].clicks} this week`}
        />
        <Kpi
          label="Conversions today"
          value={today.selfReportedConversions}
          sub={`${data.overview['7d'].selfReportedConversions} this week`}
        />
        <Kpi
          label="Estimated commission MTD"
          value={`₹${formatInr(mtd.estimatedCommissionInr)}`}
          sub="self-reported × 5%"
        />
        <Kpi
          label="Reconciled MTD"
          value={`₹${formatInr(mtd.reconciledCommissionInr)}`}
          sub="from uploaded CSVs"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className={`${adminCard} lg:col-span-2`}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-700">
            Clicks · last 14 days
          </h2>
          <MiniBarChart data={data.trend} ariaLabel="Click events per day" />
        </div>
        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-700">
            Top products · 30d
          </h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-neutral-500">No clicks yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.topProducts.slice(0, 6).map((p) => (
                <li
                  key={p.product.id}
                  className="flex items-baseline justify-between gap-2"
                >
                  <Link
                    href={p.product.slug ? `/products/${p.product.slug}` : '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate hover:underline"
                  >
                    {p.product.title}
                  </Link>
                  <span className="font-mono text-xs text-neutral-600">
                    {p.clicks}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-700">
            Low-conversion alerts
          </h2>
          {data.lowConversionProducts.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing flagged — every clicked product has at least one self-reported buy.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.lowConversionProducts.map((p) => (
                <li key={p.productId} className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/products/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate hover:underline"
                  >
                    {p.title}
                  </Link>
                  <span className="font-mono text-xs text-neutral-500">
                    {p.clicks} clicks · 0 conversions
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-neutral-500">
            ≥10 clicks in 30 days, zero self-reported conversions. Audit the
            scrape data or copy.
          </p>
        </div>
        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-700">
            System
          </h2>
          <ul className="space-y-1 text-sm">
            <SystemRow
              label="Notification outbox · pending"
              value={data.system.notificationOutbox.pending}
            />
            <SystemRow
              label="Notification outbox · failed"
              value={data.system.notificationOutbox.failed}
            />
            <SystemRow
              label="Listings with 3+ failed syncs"
              value={data.system.syncFailureCount}
            />
            <SystemRow
              label="Pending affiliate conversions"
              value={data.system.pendingAffiliateConversions}
            />
            <SystemRow
              label="Hidden reviews"
              value={data.system.hiddenReviewCount}
            />
            <li className="flex justify-between gap-2 text-neutral-500">
              <span>API p95 · error rate</span>
              <span className="text-xs">tracked in Phase 13 (OTel)</span>
            </li>
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className={adminCard}>
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function SystemRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex justify-between gap-2">
      <span className="text-neutral-700">{label}</span>
      <span className={`font-mono text-xs ${value > 0 ? 'text-amber-700' : 'text-neutral-500'}`}>
        {value}
      </span>
    </li>
  );
}

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}
