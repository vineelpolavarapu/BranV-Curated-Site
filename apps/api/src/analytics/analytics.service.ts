import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AffiliatePayoutItemStatus,
  ClickReportOutcome,
  DropStatus,
  OutboxStatus,
  ProductStatus,
  ReviewStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES_DAYS = [1, 7, 30, 90] as const;
type RangeKey = '1d' | '7d' | '30d' | '90d';

export interface OverviewBucket {
  clicks: number;
  selfReportedConversions: number;
  estimatedCommissionInr: number;
  reconciledCommissionInr: number;
}

/**
 * Read-side analytics queries powering /admin/analytics/*.
 *
 * Historic days come from the rollup tables (analytics_daily_clicks /
 * _conversions / _content_perf) which the AnalyticsScheduler refreshes
 * hourly. Today's bucket is computed live from the raw tables so the
 * "Clicks today" KPI never lags behind by an hour. This keeps dashboard
 * latency flat as raw click volume grows.
 */
@Injectable()
export class AnalyticsService {
  private readonly estimatedRate: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Flat 5% — PRD §2.1 says 1–10% per category. Phase 11+ can wire
    // per-partner rates from platform_settings.
    this.estimatedRate =
      Number(config.get('ANALYTICS_ESTIMATED_RATE_PCT') ?? 5) / 100;
  }

  // ────────────────────────── OVERVIEW ──────────────────────────

  async overview(): Promise<Record<RangeKey, OverviewBucket>> {
    const today = startOfUtcDay(new Date());
    const earliest = addDays(today, -(Math.max(...RANGES_DAYS) - 1)); // 90d back

    const [historicClicks, historicConversions, todayValues] = await Promise.all([
      this.prisma.analyticsDailyClicks.findMany({
        where: { day: { gte: earliest, lt: today } },
        select: { day: true, clicks: true },
      }),
      this.prisma.analyticsDailyConversions.findMany({
        where: { day: { gte: earliest, lt: today } },
        select: {
          day: true,
          selfReportedPurchases: true,
          estimatedCommissionInr: true,
          reconciledCommissionInr: true,
        },
      }),
      this.computeTodayOverview(today),
    ]);

    const buckets: Record<RangeKey, OverviewBucket> = {
      '1d': zero(),
      '7d': zero(),
      '30d': zero(),
      '90d': zero(),
    };

    for (const days of RANGES_DAYS) {
      const start = addDays(today, -(days - 1));
      const startMs = start.getTime();
      let rClicks = 0;
      let rConv = 0;
      let rEst = 0;
      let rRec = 0;
      for (const row of historicClicks) {
        if (row.day.getTime() >= startMs) rClicks += row.clicks;
      }
      for (const row of historicConversions) {
        if (row.day.getTime() < startMs) continue;
        rConv += row.selfReportedPurchases;
        rEst += Number(row.estimatedCommissionInr);
        rRec += Number(row.reconciledCommissionInr);
      }
      buckets[`${days}d` as RangeKey] = {
        clicks: rClicks + todayValues.clicks,
        selfReportedConversions: rConv + todayValues.purchases,
        estimatedCommissionInr: round2(rEst + todayValues.estimatedCommission),
        reconciledCommissionInr: round2(
          rRec + todayValues.reconciledCommission,
        ),
      };
    }
    return buckets;
  }

  private async computeTodayOverview(today: Date): Promise<{
    clicks: number;
    purchases: number;
    estimatedCommission: number;
    reconciledCommission: number;
  }> {
    const [clicks, purchaseRows, reconciledAgg] = await Promise.all([
      this.prisma.clickEvent.count({
        where: { redirectedAt: { gte: today } },
      }),
      this.prisma.selfReportedConversion.findMany({
        where: {
          outcome: ClickReportOutcome.PURCHASED,
          reportedAt: { gte: today },
        },
        select: {
          clickEvent: { select: { product: { select: { price: true } } } },
        },
      }),
      this.prisma.affiliatePayoutItem.aggregate({
        where: {
          status: AffiliatePayoutItemStatus.MATCHED,
          occurredAt: { gte: today },
        },
        _sum: { commissionInr: true },
      }),
    ]);
    const estimatedCommission = purchaseRows.reduce(
      (acc, r) =>
        acc + Number(r.clickEvent.product.price) * this.estimatedRate,
      0,
    );
    return {
      clicks,
      purchases: purchaseRows.length,
      estimatedCommission,
      reconciledCommission: Number(reconciledAgg._sum.commissionInr ?? 0),
    };
  }

  // ────────────────────────── CLICKS DETAIL ──────────────────────────

  async clicks() {
    const today = startOfUtcDay(new Date());
    const start30 = addDays(today, -29);

    const [topProducts, topRetailers, topSources, trend] = await Promise.all([
      this.topProductsLast30Days(start30, today),
      this.topRetailersLast30Days(start30),
      this.topSourcesLast30Days(start30),
      this.dailyClicksSeries(14),
    ]);

    return { topProducts, topRetailers, topSources, trend };
  }

  /** Top 10 products by clicks in the trailing 30 days. */
  private async topProductsLast30Days(start: Date, today: Date) {
    // Sum rollup over [start, today) plus today's live counts.
    const [historic, todayRows] = await Promise.all([
      this.prisma.analyticsDailyClicks.groupBy({
        by: ['productId'],
        where: { day: { gte: start, lt: today } },
        _sum: { clicks: true },
      }),
      this.prisma.clickEvent.groupBy({
        by: ['productId'],
        where: { redirectedAt: { gte: today } },
        _count: { _all: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const row of historic) {
      counts.set(row.productId, row._sum.clicks ?? 0);
    }
    for (const row of todayRows) {
      counts.set(
        row.productId,
        (counts.get(row.productId) ?? 0) + row._count._all,
      );
    }
    const top10 = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const products = await this.prisma.product.findMany({
      where: { id: { in: top10.map(([id]) => id) } },
      select: { id: true, slug: true, title: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    return top10.map(([productId, clicks]) => ({
      product:
        productById.get(productId) ?? {
          id: productId,
          slug: null,
          title: 'Unknown',
        },
      clicks,
    }));
  }

  /** Top 10 retailers by clicks in the trailing 30 days (always raw — small cardinality). */
  private async topRetailersLast30Days(start: Date) {
    const rows = await this.prisma.clickEvent.groupBy({
      by: ['retailer'],
      where: { redirectedAt: { gte: start } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    return rows.map((r) => ({ retailer: r.retailer, clicks: r._count._all }));
  }

  /** Top 10 source pages by clicks in the trailing 30 days. */
  private async topSourcesLast30Days(start: Date) {
    const rows = await this.prisma.clickEvent.groupBy({
      by: ['sourcePageUrl'],
      where: { redirectedAt: { gte: start }, sourcePageUrl: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    return rows.map((s) => ({
      path: s.sourcePageUrl ?? '(direct)',
      clicks: s._count._all,
    }));
  }

  /**
   * Daily clicks series for the last N days. Historic days come from the
   * rollup; today's value comes from a single count on the raw table.
   */
  private async dailyClicksSeries(
    days: number,
  ): Promise<Array<{ day: string; count: number }>> {
    const today = startOfUtcDay(new Date());
    const start = addDays(today, -(days - 1));

    const [historic, todayClicks] = await Promise.all([
      this.prisma.analyticsDailyClicks.groupBy({
        by: ['day'],
        where: { day: { gte: start, lt: today } },
        _sum: { clicks: true },
      }),
      this.prisma.clickEvent.count({
        where: { redirectedAt: { gte: today } },
      }),
    ]);

    const lookup = new Map<string, number>();
    for (const row of historic) {
      lookup.set(isoDay(row.day), row._sum.clicks ?? 0);
    }
    lookup.set(isoDay(today), todayClicks);

    const out: Array<{ day: string; count: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = isoDay(d);
      out.push({ day: key, count: lookup.get(key) ?? 0 });
    }
    return out;
  }

  // ────────────────────────── CONTENT (ARTICLES) ──────────────────────────

  async content() {
    const today = startOfUtcDay(new Date());
    const start30 = addDays(today, -29);

    // Historic from rollup + today raw.
    const [historic, todayRows] = await Promise.all([
      this.prisma.analyticsContentPerf.groupBy({
        by: ['surfaceSlug'],
        where: {
          surfaceType: 'article',
          day: { gte: start30, lt: today },
        },
        _sum: { clicks: true, reconciledCommissionInr: true },
      }),
      this.contentTodayRaw('article', today),
    ]);

    const combined = new Map<
      string,
      { clicks: number; reconciled: number }
    >();
    for (const row of historic) {
      combined.set(row.surfaceSlug, {
        clicks: row._sum.clicks ?? 0,
        reconciled: Number(row._sum.reconciledCommissionInr ?? 0),
      });
    }
    for (const row of todayRows) {
      const prev = combined.get(row.slug) ?? { clicks: 0, reconciled: 0 };
      combined.set(row.slug, {
        clicks: prev.clicks + row.clicks,
        reconciled: prev.reconciled + row.reconciled,
      });
    }

    const slugs = [...combined.keys()];
    if (slugs.length === 0) return { articles: [] };
    const articles = await this.prisma.article.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, title: true, publishedAt: true },
    });
    const bySlug = new Map(articles.map((a) => [a.slug, a]));

    return {
      articles: [...combined.entries()]
        .map(([slug, v]) => ({
          slug,
          title: bySlug.get(slug)?.title ?? slug,
          clicks: v.clicks,
          reconciledCommissionInr: round2(v.reconciled),
        }))
        .filter((r) => r.title !== r.slug || r.clicks > 0)
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 20),
    };
  }

  /** Today's content perf computed live from raw tables, filtered by surface. */
  private async contentTodayRaw(
    surface: 'article' | 'drop',
    today: Date,
  ): Promise<Array<{ slug: string; clicks: number; reconciled: number }>> {
    const pattern = `%/${surface}s/%`;
    const rows = await this.prisma.$queryRaw<
      Array<{ slug: string; clicks: number; reconciled: number }>
    >`
      SELECT
        regexp_replace(ce."sourcePageUrl", ${`^.*/${surface}s/([^/?#]+).*$`}, '\\1') AS slug,
        count(DISTINCT ce.id)::int AS clicks,
        COALESCE(SUM(api."commissionInr") FILTER (WHERE api.status = 'MATCHED'), 0)::float AS reconciled
      FROM click_events ce
      LEFT JOIN affiliate_payout_items api ON api."matchedClickEventId" = ce.id
      WHERE ce."sourcePageUrl" LIKE ${pattern}
        AND ce."redirectedAt" >= ${today}
      GROUP BY slug;
    `;
    return rows.map((r) => ({
      slug: r.slug,
      clicks: Number(r.clicks),
      reconciled: Number(r.reconciled),
    }));
  }

  // ────────────────────────── DROPS ──────────────────────────

  async drops() {
    const drops = await this.prisma.drop.findMany({
      where: { status: { in: [DropStatus.LIVE, DropStatus.ENDED] } },
      orderBy: { launchAt: 'desc' },
      take: 30,
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        launchAt: true,
      },
    });
    if (drops.length === 0) return { drops: [] };

    const slugList = drops.map((d) => d.slug);
    const today = startOfUtcDay(new Date());
    const earliest = drops.reduce(
      (min, d) => (d.launchAt && d.launchAt < min ? d.launchAt : min),
      today,
    );
    const rollupStart = startOfUtcDay(earliest);

    const [historic, todayRaw] = await Promise.all([
      this.prisma.analyticsContentPerf.groupBy({
        by: ['surfaceSlug'],
        where: {
          surfaceType: 'drop',
          surfaceSlug: { in: slugList },
          day: { gte: rollupStart, lt: today },
        },
        _sum: {
          clicks: true,
          selfReportedConversions: true,
          reconciledCommissionInr: true,
        },
      }),
      this.contentTodayRaw('drop', today),
    ]);

    type Stats = { clicks: number; conv: number; revenue: number };
    const stats = new Map<string, Stats>();
    for (const row of historic) {
      stats.set(row.surfaceSlug, {
        clicks: row._sum.clicks ?? 0,
        conv: row._sum.selfReportedConversions ?? 0,
        revenue: Number(row._sum.reconciledCommissionInr ?? 0),
      });
    }
    for (const row of todayRaw) {
      const prev = stats.get(row.slug) ?? { clicks: 0, conv: 0, revenue: 0 };
      stats.set(row.slug, {
        clicks: prev.clicks + row.clicks,
        conv: prev.conv,
        revenue: prev.revenue + row.reconciled,
      });
    }

    return {
      drops: drops.map((d) => {
        const s = stats.get(d.slug);
        return {
          slug: d.slug,
          name: d.name,
          status: d.status,
          launchAt: d.launchAt,
          clicks: s?.clicks ?? 0,
          conversions: s?.conv ?? 0,
          reconciledCommissionInr: round2(s?.revenue ?? 0),
        };
      }),
    };
  }

  // ────────────────────────── MEMBERS ──────────────────────────

  async members() {
    const since30 = new Date(Date.now() - 30 * DAY_MS);

    const [total, newCount, returningRows, topWardrobeRows] = await Promise.all(
      [
        this.prisma.user.count({
          where: { status: UserStatus.ACTIVE, role: 'MEMBER' },
        }),
        this.prisma.user.count({
          where: {
            status: UserStatus.ACTIVE,
            role: 'MEMBER',
            createdAt: { gte: since30 },
          },
        }),
        // Returning = members who have ≥2 click events.
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM (
            SELECT "userId" FROM click_events
            WHERE "userId" IS NOT NULL
            GROUP BY "userId" HAVING count(*) >= 2
          ) t;
        `,
        this.prisma.$queryRaw<
          Array<{ user_id: string; email: string; items: number }>
        >`
          SELECT
            w."userId" AS user_id,
            u.email,
            count(*)::int AS items
          FROM wardrobe_items w
          JOIN users u ON u.id = w."userId"
          WHERE w."removedAt" IS NULL
          GROUP BY w."userId", u.email
          ORDER BY items DESC
          LIMIT 10;
        `,
      ],
    );

    return {
      totalActiveMembers: total,
      newMembersLast30: newCount,
      returningMembers: Number(returningRows[0]?.count ?? 0),
      topWardrobes: topWardrobeRows.map((r) => ({
        userId: r.user_id,
        email: r.email,
        itemCount: Number(r.items),
      })),
    };
  }

  // ────────────────────────── SYSTEM HEALTH ──────────────────────────

  async system() {
    const [
      outboxPending,
      outboxFailed,
      syncFailures,
      pendingAffiliateLinks,
      hiddenReviews,
    ] = await Promise.all([
      this.prisma.notificationOutbox.count({
        where: { status: OutboxStatus.PENDING },
      }),
      this.prisma.notificationOutbox.count({
        where: { status: OutboxStatus.FAILED },
      }),
      this.prisma.productRetailerListing.count({
        where: { syncFailedCount: { gte: 3 } },
      }),
      this.prisma.affiliateLink.count({
        where: { pendingConversion: true },
      }),
      this.prisma.review.count({
        where: { status: ReviewStatus.HIDDEN },
      }),
    ]);

    return {
      notificationOutbox: { pending: outboxPending, failed: outboxFailed },
      syncFailureCount: syncFailures,
      pendingAffiliateConversions: pendingAffiliateLinks,
      hiddenReviewCount: hiddenReviews,
      // p95 latency + error rate land in Phase 13 with metrics + OTel.
      apiP95Ms: null,
      errorRatePct: null,
    };
  }

  // ────────────────────────── DASHBOARD MIXED ──────────────────────────

  /**
   * Combined payload for the admin /admin landing page — single round-trip,
   * KPI cards + charts + alerts.
   */
  async dashboard() {
    const today = startOfUtcDay(new Date());
    const start30 = addDays(today, -29);

    const [overview, clicks, system, liveDropCount, lowConversion] =
      await Promise.all([
        this.overview(),
        this.clicks(),
        this.system(),
        this.prisma.drop.count({ where: { status: DropStatus.LIVE } }),
        this.lowConversionLast30Days(start30, today),
      ]);

    return {
      overview,
      trend: clicks.trend,
      topProducts: clicks.topProducts,
      system,
      liveDropCount,
      lowConversionProducts: lowConversion,
    };
  }

  /**
   * Products with ≥10 clicks in the last 30 days but zero self-reported
   * purchases. Reads from rollup historicals + today raw.
   */
  private async lowConversionLast30Days(start: Date, today: Date) {
    const [clickRows, convRows, todayClicks, todayConv] = await Promise.all([
      this.prisma.analyticsDailyClicks.groupBy({
        by: ['productId'],
        where: { day: { gte: start, lt: today } },
        _sum: { clicks: true },
      }),
      this.prisma.analyticsDailyConversions.groupBy({
        by: ['productId'],
        where: { day: { gte: start, lt: today } },
        _sum: { selfReportedPurchases: true },
      }),
      this.prisma.clickEvent.groupBy({
        by: ['productId'],
        where: { redirectedAt: { gte: today } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ product_id: string; conv: number }>>`
        SELECT ce."productId" AS product_id, count(*)::int AS conv
        FROM self_reported_conversions src
        JOIN click_events ce ON ce.id = src."clickEventId"
        WHERE src.outcome = 'PURCHASED' AND src."reportedAt" >= ${today}
        GROUP BY ce."productId";
      `,
    ]);

    const clicksByProduct = new Map<string, number>();
    for (const r of clickRows)
      clicksByProduct.set(r.productId, r._sum.clicks ?? 0);
    for (const r of todayClicks)
      clicksByProduct.set(
        r.productId,
        (clicksByProduct.get(r.productId) ?? 0) + r._count._all,
      );

    const convByProduct = new Map<string, number>();
    for (const r of convRows)
      convByProduct.set(r.productId, r._sum.selfReportedPurchases ?? 0);
    for (const r of todayConv)
      convByProduct.set(
        r.product_id,
        (convByProduct.get(r.product_id) ?? 0) + Number(r.conv),
      );

    // Filter: ≥10 clicks, 0 conversions. Then look up product metadata.
    const candidates = [...clicksByProduct.entries()]
      .filter(([id, clicks]) => clicks >= 10 && (convByProduct.get(id) ?? 0) === 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (candidates.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: candidates.map(([id]) => id) },
        status: ProductStatus.ACTIVE,
      },
      select: { id: true, slug: true, title: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return candidates
      .filter(([id]) => byId.has(id))
      .map(([id, clicks]) => {
        const p = byId.get(id)!;
        return {
          productId: id,
          slug: p.slug,
          title: p.title,
          clicks,
        };
      });
  }
}

// ──────────────────────────── helpers ────────────────────────────

function zero(): OverviewBucket {
  return {
    clicks: 0,
    selfReportedConversions: 0,
    estimatedCommissionInr: 0,
    reconciledCommissionInr: 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
