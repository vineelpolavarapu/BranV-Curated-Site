'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  AffiliatePartner,
  PayoutDetail,
  PayoutSummary,
  VarianceResponse,
} from '@/lib/phase9-types';
import {
  AdminShell,
  adminButtonPrimary,
  adminButtonSecondary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

export default function ReconciliationAdminPage() {
  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [variance, setVariance] = useState<VarianceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [openDetail, setOpenDetail] = useState<PayoutDetail | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [list, vRes] = await Promise.all([
      apiFetch<PayoutSummary[]>('/admin/affiliate/reconciliation'),
      apiFetch<VarianceResponse>('/admin/affiliate/reconciliation/variance'),
    ]);
    if (list.ok && list.data) setPayouts(list.data);
    if (vRes.ok && vRes.data) setVariance(vRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminShell
      title="Affiliate reconciliation"
      actions={
        <button
          onClick={() => setShowUpload(true)}
          className={adminButtonPrimary}
        >
          + Upload CSV
        </button>
      }
    >
      <p className="mb-4 text-sm text-neutral-600">
        Upload Cuelinks / Amazon / EarnKaro CSV exports. We parse, match each
        row to a tracked click within ±48h and the amount band, and surface
        anything unmatched for review. Re-uploads of the same file are skipped.
      </p>

      <VarianceCards variance={variance} />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-neutral-700">
        Upload history
      </h2>
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : payouts.length === 0 ? (
        <div className={adminCard}>
          <p className="text-sm text-neutral-500">
            No payouts yet. Click <strong>+ Upload CSV</strong>.
          </p>
        </div>
      ) : (
        <div className={adminCard}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-2 pb-3 font-medium">Partner</th>
                <th className="px-2 pb-3 font-medium">File</th>
                <th className="px-2 pb-3 font-medium">Period</th>
                <th className="px-2 pb-3 font-medium">Rows</th>
                <th className="px-2 pb-3 font-medium">Matched</th>
                <th className="px-2 pb-3 font-medium">Ambiguous</th>
                <th className="px-2 pb-3 font-medium">Unmatched</th>
                <th className="px-2 pb-3 font-medium">Reported ₹</th>
                <th className="px-2 pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const matchRate =
                  p.rowCount > 0
                    ? Math.round((p.matchedCount / p.rowCount) * 100)
                    : 0;
                return (
                  <tr key={p.id} className="border-b border-neutral-100">
                    <td className="px-2 py-3 font-medium">{p.partner}</td>
                    <td className="px-2 py-3 text-xs text-neutral-600">
                      {p.csvFilename ?? '—'}
                      <p className="mt-0.5 text-[10px] text-neutral-400">
                        {new Date(p.createdAt).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-xs text-neutral-600">
                      {p.reportedPeriodStart
                        ? new Date(p.reportedPeriodStart).toLocaleDateString()
                        : '—'}
                      {' – '}
                      {p.reportedPeriodEnd
                        ? new Date(p.reportedPeriodEnd).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-2 py-3">{p.rowCount}</td>
                    <td className="px-2 py-3 text-emerald-700">
                      {p.matchedCount} ({matchRate}%)
                    </td>
                    <td className="px-2 py-3 text-amber-700">
                      {p.ambiguousCount}
                    </td>
                    <td className="px-2 py-3 text-red-700">
                      {p.unmatchedCount}
                    </td>
                    <td className="px-2 py-3">
                      {p.reportedCommissionInr
                        ? `₹${Number(p.reportedCommissionInr).toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await apiFetch<PayoutDetail>(
                            `/admin/affiliate/reconciliation/${p.id}`,
                          );
                          if (res.ok && res.data) setOpenDetail(res.data);
                        }}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={async () => {
            setShowUpload(false);
            await refresh();
          }}
        />
      )}
      {openDetail && (
        <DetailModal
          payout={openDetail}
          onClose={() => setOpenDetail(null)}
        />
      )}
    </AdminShell>
  );
}

function VarianceCards({ variance }: { variance: VarianceResponse | null }) {
  if (!variance) return null;
  const partners: AffiliatePartner[] = ['CUELINKS', 'AMAZON', 'EARNKARO', 'DIRECT'];
  // Roll up across recent payouts per partner.
  const byPartner = new Map<
    AffiliatePartner,
    { reported: number; matched: number; total: number }
  >();
  for (const p of variance.payouts) {
    const cur = byPartner.get(p.partner) ?? { reported: 0, matched: 0, total: 0 };
    cur.reported += Number(p.reportedCommissionInr ?? 0);
    cur.matched += p.matchedCount;
    cur.total += p.matchedCount + p.unmatchedCount + p.ambiguousCount;
    byPartner.set(p.partner, cur);
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {partners.map((partner) => {
        const stats = byPartner.get(partner);
        const tracked = variance.trackedByPartner[partner] ?? 0;
        return (
          <div key={partner} className={adminCard}>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              {partner}
            </p>
            <p className="mt-2 text-xs text-neutral-500">Tracked clicks</p>
            <p className="text-2xl font-semibold tracking-tight">{tracked}</p>
            <p className="mt-3 text-xs text-neutral-500">Reported commission</p>
            <p className="text-base font-medium">
              {stats?.reported
                ? `₹${stats.reported.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                : '—'}
            </p>
            <p className="mt-2 text-[10px] text-neutral-500">
              {stats ? `${stats.matched}/${stats.total} matched` : 'No uploads'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Pick a CSV file first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    if (notes) form.append('notes', notes);
    try {
      const res = await fetch(
        `${API_BASE}/admin/affiliate/reconciliation`,
        {
          method: 'POST',
          credentials: 'include',
          body: form,
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message ?? `Upload failed (${res.status})`);
        return;
      }
      onUploaded();
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Upload affiliate CSV</h2>
          <button onClick={onClose} className="text-neutral-400">✕</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={adminLabel}>CSV file</label>
            <input
              required
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Cuelinks / Amazon / EarnKaro exports. Provider is detected from
              column headers.
            </p>
          </div>
          <div>
            <label className={adminLabel}>Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. October 2026 Cuelinks payout"
              className={adminInput}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={adminButtonSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={adminButtonPrimary}
            >
              {submitting ? 'Parsing…' : 'Upload + parse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailModal({
  payout,
  onClose,
}: {
  payout: PayoutDetail;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {payout.partner} · {payout.csvFilename ?? 'CSV'}
            </h2>
            <p className="text-xs text-neutral-500">
              Uploaded {new Date(payout.createdAt).toLocaleString()} ·{' '}
              {payout.matchedCount} matched / {payout.ambiguousCount} ambiguous /{' '}
              {payout.unmatchedCount} unmatched (of {payout.rowCount})
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-2 pb-3 font-medium">Status</th>
                <th className="px-2 pb-3 font-medium">Date</th>
                <th className="px-2 pb-3 font-medium">Order</th>
                <th className="px-2 pb-3 font-medium">Amount</th>
                <th className="px-2 pb-3 font-medium">Commission</th>
                <th className="px-2 pb-3 font-medium">Matched click</th>
              </tr>
            </thead>
            <tbody>
              {payout.items.map((item) => {
                const tone =
                  item.status === 'MATCHED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : item.status === 'AMBIGUOUS'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-700';
                return (
                  <tr key={item.id} className="border-b border-neutral-100">
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-neutral-600">
                      {item.occurredAt
                        ? new Date(item.occurredAt).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs font-mono">
                      {item.retailerOrderId ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {item.amountInr ? `₹${Number(item.amountInr)}` : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {item.commissionInr
                        ? `₹${Number(item.commissionInr)}`
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {item.matchedClickEvent ? (
                        <a
                          href={`/products/${item.matchedClickEvent.product.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-700 underline hover:text-neutral-950"
                        >
                          {item.matchedClickEvent.product.title}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
