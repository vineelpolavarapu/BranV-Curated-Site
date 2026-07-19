'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { SettingsMap } from '@/lib/phase10-types';
import {
  AdminShell,
  adminButtonPrimary,
  adminCard,
  adminInput,
  adminLabel,
} from '@/components/AdminShell';

interface SettingSpec {
  key: string;
  label: string;
  kind: 'number' | 'string' | 'boolean' | 'text';
  hint?: string;
  min?: number;
  max?: number;
}

const SETTING_SPECS: SettingSpec[] = [
  {
    key: 'PRICE_SYNC_DRIFT_THRESHOLD_PCT',
    label: 'Price-sync drift threshold (%)',
    kind: 'number',
    min: 0,
    max: 100,
    hint: 'Only update product price when retailer drift crosses this.',
  },
  {
    key: 'NEW_ARRIVAL_DAYS',
    label: '"New" window (days)',
    kind: 'number',
    min: 1,
    max: 90,
    hint: 'Products created within this window are flagged as new arrivals.',
  },
  {
    key: 'ANALYTICS_ESTIMATED_RATE_PCT',
    label: 'Estimated commission rate (%)',
    kind: 'number',
    min: 0,
    max: 50,
    hint: 'Used for the dashboard "estimated commission" KPI.',
  },
  {
    key: 'BASE_CURRENCY',
    label: 'Base currency',
    kind: 'string',
    hint: 'ISO 4217 code; INR for India.',
  },
  {
    key: 'GOOGLE_OAUTH_ENABLED',
    label: 'Google OAuth enabled',
    kind: 'boolean',
  },
  {
    key: 'WEB_PUSH_ENABLED',
    label: 'Web push enabled',
    kind: 'boolean',
  },
  {
    key: 'SMS_ENABLED',
    label: 'SMS notifications enabled',
    kind: 'boolean',
  },
  {
    key: 'AFFILIATE_DISCLOSURE_TEXT',
    label: 'Affiliate disclosure text',
    kind: 'text',
    hint: 'Shown on the account page (and anywhere else the storefront reads /settings/public). Explains BranV’s affiliate relationship to shoppers.',
  },
];

export default function SettingsAdminPage() {
  const [values, setValues] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<SettingsMap>('/admin/settings');
    if (res.ok && res.data) setValues(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(spec: SettingSpec, raw: string | boolean) {
    setSavingKey(spec.key);
    setError(null);
    setFlash(null);

    let value: unknown = raw;
    if (spec.kind === 'number') value = Number(raw);
    if (spec.kind === 'boolean') value = Boolean(raw);

    const res = await apiFetch('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: spec.key, value }),
    });
    setSavingKey(null);
    if (!res.ok) {
      setError(res.error ?? 'Save failed');
      return;
    }
    setFlash(`✓ Saved ${spec.label}`);
    setValues((v) => ({ ...v, [spec.key]: value }));
    setTimeout(() => setFlash(null), 1800);
  }

  return (
    <AdminShell title="Platform settings">
      <p className="mb-4 text-sm text-neutral-600">
        Tunables that take effect within the next request cycle (≤30s Redis cache).
      </p>

      {loading ? (
        <div className="h-2 w-32 animate-pulse rounded bg-neutral-200" />
      ) : (
        <div className={adminCard}>
          <ul className="divide-y divide-neutral-200">
            {SETTING_SPECS.map((spec) => (
              <li key={spec.key} className="py-4">
                <SettingRow
                  spec={spec}
                  value={values[spec.key]}
                  saving={savingKey === spec.key}
                  onSave={(v) => onSave(spec, v)}
                />
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {flash && <p className="mt-3 text-sm text-emerald-700">{flash}</p>}
        </div>
      )}
    </AdminShell>
  );
}

function SettingRow({
  spec,
  value,
  saving,
  onSave,
}: {
  spec: SettingSpec;
  value: unknown;
  saving: boolean;
  onSave: (raw: string | boolean) => void;
}) {
  if (spec.kind === 'boolean') {
    const current = Boolean(value);
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{spec.label}</p>
          {spec.hint && <p className="text-xs text-neutral-500">{spec.hint}</p>}
          <p className="mt-1 font-mono text-[10px] uppercase text-neutral-400">
            {spec.key}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={current}
            disabled={saving}
            onChange={(e) => onSave(e.target.checked)}
          />
          {current ? 'On' : 'Off'}
        </label>
      </div>
    );
  }

  return (
    <BoxedInput spec={spec} value={value} saving={saving} onSave={onSave} />
  );
}

function BoxedInput({
  spec,
  value,
  saving,
  onSave,
}: {
  spec: SettingSpec;
  value: unknown;
  saving: boolean;
  onSave: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(
    value === undefined || value === null ? '' : String(value),
  );
  return (
    <div className={`grid gap-2 ${spec.kind === 'text' ? '' : 'md:grid-cols-[1fr_auto] md:items-end'}`}>
      <div>
        <label className={adminLabel}>{spec.label}</label>
        {spec.kind === 'text' ? (
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={adminInput}
          />
        ) : (
          <input
            type={spec.kind === 'number' ? 'number' : 'text'}
            min={spec.min}
            max={spec.max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={adminInput}
          />
        )}
        {spec.hint && (
          <p className="mt-1 text-xs text-neutral-500">{spec.hint}</p>
        )}
        <p className="mt-1 font-mono text-[10px] uppercase text-neutral-400">
          {spec.key}
        </p>
      </div>
      <button
        type="button"
        disabled={saving || String(value) === draft}
        onClick={() => onSave(draft)}
        className={`${adminButtonPrimary} ${spec.kind === 'text' ? 'mt-2 w-fit' : ''}`}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
