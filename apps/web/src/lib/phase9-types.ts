export type AffiliatePartner = 'CUELINKS' | 'AMAZON' | 'EARNKARO' | 'DIRECT';

export type PayoutItemStatus = 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS';

export interface PayoutSummary {
  id: string;
  partner: AffiliatePartner;
  csvFilename: string | null;
  reportedPeriodStart: string | null;
  reportedPeriodEnd: string | null;
  reportedCommissionInr: string | number | null;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  notes: string | null;
  createdAt: string;
  uploadedBy?: { id: string; email: string } | null;
}

export interface PayoutItem {
  id: string;
  matchedClickEventId: string | null;
  retailerOrderId: string | null;
  amountInr: string | number | null;
  commissionInr: string | number | null;
  occurredAt: string | null;
  status: PayoutItemStatus;
  rawRow: Record<string, string> | null;
  matchedClickEvent: {
    id: string;
    product: { slug: string; title: string };
  } | null;
}

export interface PayoutDetail extends PayoutSummary {
  items: PayoutItem[];
}

export interface VarianceResponse {
  payouts: Array<{
    partner: AffiliatePartner;
    reportedCommissionInr: string | number | null;
    reportedClicks: number | null;
    reportedOrders: number | null;
    matchedCount: number;
    unmatchedCount: number;
    ambiguousCount: number;
    createdAt: string;
  }>;
  trackedByPartner: Record<string, number>;
}
