export interface OverviewBucket {
  clicks: number;
  selfReportedConversions: number;
  estimatedCommissionInr: number;
  reconciledCommissionInr: number;
}

export interface OverviewResponse {
  '1d': OverviewBucket;
  '7d': OverviewBucket;
  '30d': OverviewBucket;
  '90d': OverviewBucket;
}

export interface DashboardPayload {
  overview: OverviewResponse;
  trend: Array<{ day: string; count: number }>;
  topProducts: Array<{
    product: { id: string; slug: string | null; title: string };
    clicks: number;
  }>;
  system: {
    notificationOutbox: { pending: number; failed: number };
    syncFailureCount: number;
    pendingAffiliateConversions: number;
    apiP95Ms: number | null;
    errorRatePct: number | null;
  };
  lowConversionProducts: Array<{
    productId: string;
    slug: string;
    title: string;
    clicks: number;
  }>;
}

export interface AuditRow {
  id: string;
  action: string;
  actorId: string | null;
  actor: {
    id: string;
    email: string;
    role: 'MEMBER' | 'ADMIN';
  } | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditListResponse {
  data: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  actions: string[];
}

export interface SettingsMap {
  [key: string]: unknown;
}
