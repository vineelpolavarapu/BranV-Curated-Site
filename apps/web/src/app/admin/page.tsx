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
        <div className="h-2 w-32 animate-pulse rounded bg-line" />
      </AdminShell>
    );
  }

  // TODO(backend-parity): the FastAPI port of /admin/analytics/dashboard
  // returns a flat overview shape (clickEvents7d, selfReportedConversions7d)
  // instead of the 1d/7d/30d time-window slices + commission fields the
  // original NestJS API exposed. This shim maps whatever the backend actually
  // returns into the shape the KPI cards expect, with zero fallbacks.
  // Remove this once apps/api/app/routes/admin_analytics.py returns 1d/7d/30d
  // slices and estimatedCommissionInr / reconciledCommissionInr.
  const raw = data as unknown as Record<string, unknown>;
  const overviewAny = (raw.overview ?? {}) as Record<string, unknown>;
  const slice = (key: '1d' | '7d' | '30d') =>
    ((overviewAny[key] ?? {}) as Record<string, number | undefined>);
  const flatWeekClicks = Number(overviewAny.clickEvents7d ?? 0);
  const flatWeekConversions = Number(overviewAny.selfReportedConversions7d ?? 0);

  const today = {
    clicks: slice('1d').clicks ?? 0,
    selfReportedConversions: slice('1d').selfReportedConversions ?? 0,
  };
  const week = {
    clicks: slice('7d').clicks ?? flatWeekClicks,
    selfReportedConversions:
      slice('7d').selfReportedConversions ?? flatWeekConversions,
  };
  const mtd = {
    estimatedCommissionInr: slice('30d').estimatedCommissionInr ?? 0,
    reconciledCommissionInr: slice('30d').reconciledCommissionInr ?? 0,
  };

  const trend = (raw.trend ?? []) as DashboardPayload['trend'];
  const topProducts = (raw.topProducts ??
    ((raw.content as Record<string, unknown> | undefined)?.topProducts7d ??
      [])) as DashboardPayload['topProducts'];
  const lowConversionProducts = (raw.lowConversionProducts ??
    []) as DashboardPayload['lowConversionProducts'];
  const backendSystem = (data.system ?? {}) as Partial<
    DashboardPayload['system']
  >;
  const backendOutbox = (backendSystem.notificationOutbox ?? {}) as {
    pending?: number;
    failed?: number;
  };
  const system = {
    syncFailureCount: backendSystem.syncFailureCount ?? 0,
    pendingAffiliateConversions:
      backendSystem.pendingAffiliateConversions ?? 0,
    hiddenReviewCount: backendSystem.hiddenReviewCount ?? 0,
    notificationOutbox: {
      pending: backendOutbox.pending ?? 0,
      failed: backendOutbox.failed ?? 0,
    },
  };

  return (
    <AdminShell title="Dashboard">
      {/* Alert chips */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {system.syncFailureCount > 0 && (
          <Link
            href="/admin/products"
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            {system.syncFailureCount} sync failure
            {system.syncFailureCount === 1 ? '' : 's'}
          </Link>
        )}
        {system.pendingAffiliateConversions > 0 && (
          <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-medium text-content-soft">
            {system.pendingAffiliateConversions} pending affiliate conversions
          </span>
        )}
        {system.notificationOutbox.failed > 0 && (
          <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            {system.notificationOutbox.failed} failed notifications
          </span>
        )}
        {system.hiddenReviewCount > 0 && (
          <Link
            href="/admin/reviews"
            className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium hover:bg-surface-muted"
          >
            {system.hiddenReviewCount} hidden reviews
          </Link>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Clicks today"
          value={today.clicks}
          sub={`${week.clicks} this week`}
        />
        <Kpi
          label="Conversions today"
          value={today.selfReportedConversions}
          sub={`${week.selfReportedConversions} this week`}
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
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-soft">
            Clicks · last 14 days
          </h2>
          <MiniBarChart data={trend} ariaLabel="Click events per day" />
        </div>
        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-soft">
            Top products · 30d
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-content-soft">No clicks yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {topProducts.slice(0, 6).map((p) => (
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
                  <span className="font-mono text-xs text-content-soft">
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
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-soft">
            Low-conversion alerts
          </h2>
          {lowConversionProducts.length === 0 ? (
            <p className="text-sm text-content-soft">
              Nothing flagged - every clicked product has at least one self-reported buy.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {lowConversionProducts.map((p) => (
                <li key={p.productId} className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/products/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate hover:underline"
                  >
                    {p.title}
                  </Link>
                  <span className="font-mono text-xs text-content-soft">
                    {p.clicks} clicks · 0 conversions
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-content-soft">
            ≥10 clicks in 30 days, zero self-reported conversions. Audit the
            scrape data or copy.
          </p>
        </div>
        <div className={adminCard}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-soft">
            System
          </h2>
          <ul className="space-y-1 text-sm">
            <SystemRow
              label="Notification outbox · pending"
              value={system.notificationOutbox.pending}
            />
            <SystemRow
              label="Notification outbox · failed"
              value={system.notificationOutbox.failed}
            />
            <SystemRow
              label="Listings with 3+ failed syncs"
              value={system.syncFailureCount}
            />
            <SystemRow
              label="Pending affiliate conversions"
              value={system.pendingAffiliateConversions}
            />
            <SystemRow
              label="Hidden reviews"
              value={system.hiddenReviewCount}
            />
            <li className="flex justify-between gap-2 text-content-soft">
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
      <p className="text-xs font-medium uppercase tracking-wider text-content-soft">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-content-soft">{sub}</p>}
    </div>
  );
}

function SystemRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex justify-between gap-2">
      <span className="text-content-soft">{label}</span>
      <span className={`font-mono text-xs ${value > 0 ? 'text-amber-700' : 'text-content-soft'}`}>
        {value}
      </span>
    </li>
  );
}

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}
