import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Aggregates raw click_events, self_reported_conversions, and reconciled
 * affiliate_payout_items into the three daily summary tables that back the
 * admin analytics endpoints.
 *
 * Idempotent: every query is INSERT … ON CONFLICT DO UPDATE keyed on the
 * row PK so re-running a day rebuilds it cleanly. We rebuild a trailing
 * window each tick to cover late-arriving self-reports and reconciliation
 * uploads.
 */
@Injectable()
export class AnalyticsRollupService {
  private readonly logger = new Logger(AnalyticsRollupService.name);
  private readonly estimatedRate: number;
  /** How many trailing days to rebuild on each scheduled tick. */
  readonly rollupWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.estimatedRate =
      Number(config.get('ANALYTICS_ESTIMATED_RATE_PCT') ?? 5) / 100;
    this.rollupWindowDays = Number(
      config.get('ANALYTICS_ROLLUP_WINDOW_DAYS') ?? 3,
    );
  }

  // ──────────────────────────── PUBLIC ────────────────────────────

  /** Rebuild rollups for the trailing N days, ending at today (inclusive). */
  async rollupRecent(days = this.rollupWindowDays): Promise<{
    daysProcessed: number;
    clickRows: number;
    conversionRows: number;
    contentRows: number;
  }> {
    const today = startOfUtcDay(new Date());
    let clickRows = 0;
    let conversionRows = 0;
    let contentRows = 0;
    for (let i = days - 1; i >= 0; i--) {
      const day = addDays(today, -i);
      const r = await this.rollupDay(day);
      clickRows += r.clicks;
      conversionRows += r.conversions;
      contentRows += r.content;
    }
    return {
      daysProcessed: days,
      clickRows,
      conversionRows,
      contentRows,
    };
  }

  /** Rebuild rollups for a single UTC day. */
  async rollupDay(day: Date): Promise<{
    clicks: number;
    conversions: number;
    content: number;
  }> {
    const start = startOfUtcDay(day);
    const end = addDays(start, 1);
    const [clicks, conversions, content] = await Promise.all([
      this.rollupClicks(start, end),
      this.rollupConversions(start, end),
      this.rollupContent(start, end),
    ]);
    return { clicks, conversions, content };
  }

  /**
   * Backfill every day with at least one click_events row from its first
   * recorded click to today. Called on boot when summary tables are empty.
   */
  async backfillAll(): Promise<{ daysProcessed: number }> {
    const oldest = await this.prisma.clickEvent.findFirst({
      orderBy: { redirectedAt: 'asc' },
      select: { redirectedAt: true },
    });
    if (!oldest) {
      this.logger.log('Backfill skipped: no click_events rows');
      return { daysProcessed: 0 };
    }
    const start = startOfUtcDay(oldest.redirectedAt);
    const today = startOfUtcDay(new Date());
    const totalDays =
      Math.floor((today.getTime() - start.getTime()) / DAY_MS) + 1;
    this.logger.log(
      `Analytics backfill starting: ${totalDays} day(s) from ${start.toISOString().slice(0, 10)}`,
    );
    for (let i = 0; i < totalDays; i++) {
      const day = addDays(start, i);
      await this.rollupDay(day);
    }
    return { daysProcessed: totalDays };
  }

  /** True when none of the rollup tables have data — used to gate backfill. */
  async isEmpty(): Promise<boolean> {
    const [c, v, p] = await Promise.all([
      this.prisma.analyticsDailyClicks.count(),
      this.prisma.analyticsDailyConversions.count(),
      this.prisma.analyticsContentPerf.count(),
    ]);
    return c === 0 && v === 0 && p === 0;
  }

  // ──────────────────────────── PRIVATE ────────────────────────────

  private async rollupClicks(start: Date, end: Date): Promise<number> {
    const result = await this.prisma.$executeRaw`
      INSERT INTO analytics_daily_clicks ("day", "productId", retailer, clicks, "uniqueUsers", "updatedAt")
      SELECT
        date_trunc('day', "redirectedAt")::date AS day,
        "productId",
        retailer,
        count(*)::int AS clicks,
        count(DISTINCT "userId")::int AS unique_users,
        NOW() AS updated_at
      FROM click_events
      WHERE "redirectedAt" >= ${start} AND "redirectedAt" < ${end}
      GROUP BY 1, 2, 3
      ON CONFLICT ("day", "productId", retailer) DO UPDATE
      SET clicks = EXCLUDED.clicks,
          "uniqueUsers" = EXCLUDED."uniqueUsers",
          "updatedAt" = NOW();
    `;
    // Delete rows for this day that no longer have any underlying clicks
    // (e.g. after a click_events row was deleted). Cheap on the trailing
    // window; unbounded across history would be too much.
    await this.prisma.$executeRaw`
      DELETE FROM analytics_daily_clicks
      WHERE "day" = ${start}::date
        AND NOT EXISTS (
          SELECT 1 FROM click_events ce
          WHERE date_trunc('day', ce."redirectedAt")::date = analytics_daily_clicks."day"
            AND ce."productId" = analytics_daily_clicks."productId"
            AND ce.retailer = analytics_daily_clicks.retailer
        );
    `;
    return Number(result);
  }

  private async rollupConversions(start: Date, end: Date): Promise<number> {
    const result = await this.prisma.$executeRaw`
      INSERT INTO analytics_daily_conversions (
        "day", "productId",
        "selfReportedPurchases", "selfReportedBrowsing", "selfReportedNeedsHelp",
        "estimatedCommissionInr", "reconciledCommissionInr",
        "updatedAt"
      )
      SELECT
        d.day,
        d."productId",
        COALESCE(SUM(CASE WHEN d.outcome = 'PURCHASED' THEN 1 ELSE 0 END), 0)::int AS purchases,
        COALESCE(SUM(CASE WHEN d.outcome = 'BROWSING' THEN 1 ELSE 0 END), 0)::int AS browsing,
        COALESCE(SUM(CASE WHEN d.outcome = 'NEEDS_HELP' THEN 1 ELSE 0 END), 0)::int AS needs_help,
        COALESCE(SUM(CASE WHEN d.outcome = 'PURCHASED' THEN d.price * ${this.estimatedRate} ELSE 0 END), 0)::numeric(14,2) AS estimated,
        COALESCE(SUM(d.commission), 0)::numeric(14,2) AS reconciled,
        NOW() AS updated_at
      FROM (
        SELECT
          date_trunc('day', src."reportedAt")::date AS day,
          ce."productId" AS "productId",
          src.outcome AS outcome,
          p.price AS price,
          NULL::numeric AS commission
        FROM self_reported_conversions src
        JOIN click_events ce ON ce.id = src."clickEventId"
        JOIN products p ON p.id = ce."productId"
        WHERE src."reportedAt" >= ${start} AND src."reportedAt" < ${end}
        UNION ALL
        SELECT
          date_trunc('day', api."occurredAt")::date AS day,
          ce."productId" AS "productId",
          NULL::"ClickReportOutcome" AS outcome,
          NULL::numeric AS price,
          COALESCE(api."commissionInr", 0) AS commission
        FROM affiliate_payout_items api
        JOIN click_events ce ON ce.id = api."matchedClickEventId"
        WHERE api.status = 'MATCHED'
          AND api."occurredAt" IS NOT NULL
          AND api."occurredAt" >= ${start} AND api."occurredAt" < ${end}
      ) d
      WHERE d.day = ${start}::date
      GROUP BY d.day, d."productId"
      ON CONFLICT ("day", "productId") DO UPDATE
      SET "selfReportedPurchases" = EXCLUDED."selfReportedPurchases",
          "selfReportedBrowsing" = EXCLUDED."selfReportedBrowsing",
          "selfReportedNeedsHelp" = EXCLUDED."selfReportedNeedsHelp",
          "estimatedCommissionInr" = EXCLUDED."estimatedCommissionInr",
          "reconciledCommissionInr" = EXCLUDED."reconciledCommissionInr",
          "updatedAt" = NOW();
    `;
    await this.prisma.$executeRaw`
      DELETE FROM analytics_daily_conversions
      WHERE "day" = ${start}::date
        AND NOT EXISTS (
          SELECT 1 FROM self_reported_conversions src
          JOIN click_events ce ON ce.id = src."clickEventId"
          WHERE date_trunc('day', src."reportedAt")::date = analytics_daily_conversions."day"
            AND ce."productId" = analytics_daily_conversions."productId"
        )
        AND NOT EXISTS (
          SELECT 1 FROM affiliate_payout_items api
          JOIN click_events ce ON ce.id = api."matchedClickEventId"
          WHERE api.status = 'MATCHED'
            AND api."occurredAt" IS NOT NULL
            AND date_trunc('day', api."occurredAt")::date = analytics_daily_conversions."day"
            AND ce."productId" = analytics_daily_conversions."productId"
        );
    `;
    return Number(result);
  }

  private async rollupContent(start: Date, end: Date): Promise<number> {
    // Derive (surfaceType, surfaceSlug) from sourcePageUrl. We only count
    // surface paths we recognize; anything else falls under '(direct)'/'home'
    // and is grouped together.
    const result = await this.prisma.$executeRaw`
      INSERT INTO analytics_content_perf (
        "day", "surfaceType", "surfaceSlug",
        clicks, "selfReportedConversions", "reconciledCommissionInr",
        "updatedAt"
      )
      SELECT
        date_trunc('day', ce."redirectedAt")::date AS day,
        s.surface_type AS surface_type,
        s.surface_slug AS surface_slug,
        count(DISTINCT ce.id)::int AS clicks,
        count(DISTINCT CASE WHEN src.outcome = 'PURCHASED' THEN src.id END)::int AS conversions,
        COALESCE(SUM(api."commissionInr") FILTER (WHERE api.status = 'MATCHED'), 0)::numeric(14,2) AS reconciled,
        NOW() AS updated_at
      FROM click_events ce
      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN ce."sourcePageUrl" LIKE '%/articles/%'  THEN 'article'
            WHEN ce."sourcePageUrl" LIKE '%/edits/%'     THEN 'edit'
            WHEN ce."sourcePageUrl" LIKE '%/lookbooks/%' THEN 'lookbook'
            WHEN ce."sourcePageUrl" LIKE '%/products/%'  THEN 'product'
            WHEN ce."sourcePageUrl" LIKE '%/category/%'  THEN 'category'
            ELSE 'home'
          END AS surface_type,
          CASE
            WHEN ce."sourcePageUrl" LIKE '%/articles/%'  THEN regexp_replace(ce."sourcePageUrl", '^.*/articles/([^/?#]+).*$',  '\1')
            WHEN ce."sourcePageUrl" LIKE '%/edits/%'     THEN regexp_replace(ce."sourcePageUrl", '^.*/edits/([^/?#]+).*$',     '\1')
            WHEN ce."sourcePageUrl" LIKE '%/lookbooks/%' THEN regexp_replace(ce."sourcePageUrl", '^.*/lookbooks/([^/?#]+).*$', '\1')
            WHEN ce."sourcePageUrl" LIKE '%/products/%'  THEN regexp_replace(ce."sourcePageUrl", '^.*/products/([^/?#]+).*$',  '\1')
            WHEN ce."sourcePageUrl" LIKE '%/category/%'  THEN regexp_replace(ce."sourcePageUrl", '^.*/category/([^/?#]+).*$',  '\1')
            ELSE '(direct)'
          END AS surface_slug
      ) s
      LEFT JOIN self_reported_conversions src ON src."clickEventId" = ce.id
      LEFT JOIN affiliate_payout_items api ON api."matchedClickEventId" = ce.id
      WHERE ce."redirectedAt" >= ${start} AND ce."redirectedAt" < ${end}
      GROUP BY 1, 2, 3
      ON CONFLICT ("day", "surfaceType", "surfaceSlug") DO UPDATE
      SET clicks = EXCLUDED.clicks,
          "selfReportedConversions" = EXCLUDED."selfReportedConversions",
          "reconciledCommissionInr" = EXCLUDED."reconciledCommissionInr",
          "updatedAt" = NOW();
    `;
    await this.prisma.$executeRaw`
      DELETE FROM analytics_content_perf
      WHERE "day" = ${start}::date
        AND NOT EXISTS (
          SELECT 1 FROM click_events ce
          WHERE date_trunc('day', ce."redirectedAt")::date = analytics_content_perf."day"
        );
    `;
    return Number(result);
  }
}

// ──────────────────────────── helpers ────────────────────────────

const DAY_MS = 86_400_000;

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
