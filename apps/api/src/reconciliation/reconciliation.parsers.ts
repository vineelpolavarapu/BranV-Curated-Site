import { AffiliatePartner } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { createHash } from 'node:crypto';

export interface NormalizedRow {
  /** Raw row content for debug display. */
  raw: Record<string, string>;
  /** Stable sha256 hash of (occurredAt|orderId|amount|commission|retailer) for dedupe. */
  rowHash: string;
  retailerOrderId: string | null;
  amountInr: number | null;
  commissionInr: number | null;
  occurredAt: Date | null;
}

export interface ParsedCsv {
  partner: AffiliatePartner;
  rows: NormalizedRow[];
}

/**
 * Detect the affiliate provider from the column headers and parse rows into
 * a shared shape. Real CSVs in the wild vary even within a single provider —
 * we keep header matching loose (lowercased + whitespace-trimmed contains).
 *
 * BUILD_GUIDE §9.1 step 3: parser detects provider from CSV column structure.
 */
export function parseCsv(buffer: Buffer): ParsedCsv {
  const text = buffer.toString('utf8');
  const records = parse(text, {
    columns: (header: string[]) => header.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  if (records.length === 0) {
    throw new Error('CSV is empty');
  }

  const headers = Object.keys(records[0]);
  const partner = detectPartner(headers);

  const rows = records
    .map((r) => normalize(r, partner))
    .filter((r): r is NormalizedRow => r !== null);

  return { partner, rows };
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function detectPartner(headers: string[]): AffiliatePartner {
  const set = new Set(headers);
  if (set.has('asin') || set.has('product_name_asin')) {
    return AffiliatePartner.AMAZON;
  }
  if (
    set.has('sub_id') ||
    set.has('cuelinks_id') ||
    set.has('cuelinks_track_id') ||
    headers.some((h) => h.includes('cuelinks'))
  ) {
    return AffiliatePartner.CUELINKS;
  }
  if (set.has('earnkaro_id') || headers.some((h) => h.includes('earnkaro'))) {
    return AffiliatePartner.EARNKARO;
  }
  // Generic / direct affiliate exports.
  return AffiliatePartner.DIRECT;
}

function normalize(
  row: Record<string, string>,
  partner: AffiliatePartner,
): NormalizedRow | null {
  const occurredAt = pickDate(row, [
    'date', 'order_date', 'tracking_date', 'created_at', 'transaction_date',
  ]);
  const retailerOrderId = pickString(row, [
    'order_id', 'asin', 'transaction_id', 'tracking_id', 'sub_id',
  ]);
  const amountInr = pickAmount(row, [
    'sales_amount', 'price', 'amount', 'order_amount', 'sale_amount',
  ]);
  const commissionInr = pickAmount(row, [
    'commission', 'commission_amount', 'earnings', 'payout',
  ]);

  // Skip rows that look like aggregate totals or have no useful content.
  if (commissionInr === null && amountInr === null && !retailerOrderId) {
    return null;
  }

  const rowHash = createHash('sha256')
    .update(
      JSON.stringify({
        partner,
        retailerOrderId,
        amountInr,
        commissionInr,
        occurredAt: occurredAt?.toISOString() ?? null,
      }),
    )
    .digest('hex');

  return {
    raw: row,
    rowHash,
    retailerOrderId,
    amountInr,
    commissionInr,
    occurredAt,
  };
}

function pickString(row: Record<string, string>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== '') return String(v).trim();
  }
  return null;
}

function pickAmount(row: Record<string, string>, keys: string[]): number | null {
  const raw = pickString(row, keys);
  if (raw === null) return null;
  // Strip currency symbols + thousands separators.
  const cleaned = raw.replace(/[^\d.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pickDate(row: Record<string, string>, keys: string[]): Date | null {
  const raw = pickString(row, keys);
  if (!raw) return null;
  // Try ISO first.
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;
  // DD/MM/YYYY → ISO retry. Cuelinks/EarnKaro often use Indian format.
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    const candidate = new Date(`${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }
  return null;
}
