import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsRollupService } from './analytics-rollup.service';

/**
 * Drives the analytics daily-summary tables. On boot, if the rollup tables
 * are empty we backfill from the first click_event onward (one-shot, async)
 * so the dashboard isn't empty after a fresh deploy. Every hour we rebuild
 * the trailing window so late-arriving self-reports and reconciliation rows
 * get folded in.
 */
@Injectable()
export class AnalyticsScheduler implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsScheduler.name);

  constructor(private readonly rollup: AnalyticsRollupService) {}

  async onModuleInit() {
    // Don't block boot — backfill can take a while on a populated DB. The
    // hourly tick covers correctness if the backfill races with new data.
    void this.maybeBackfill();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async tick() {
    const startedAt = Date.now();
    try {
      const r = await this.rollup.rollupRecent();
      this.logger.log(
        `Analytics rollup: ${r.daysProcessed}d window, ` +
          `clicks=${r.clickRows} conv=${r.conversionRows} content=${r.contentRows} ` +
          `(${Date.now() - startedAt}ms)`,
      );
    } catch (err) {
      this.logger.error(
        `Analytics rollup tick failed: ${(err as Error).message}`,
      );
    }
  }

  private async maybeBackfill() {
    try {
      const empty = await this.rollup.isEmpty();
      if (!empty) return;
      const r = await this.rollup.backfillAll();
      this.logger.log(
        `Analytics backfill complete: ${r.daysProcessed} day(s) rolled up`,
      );
    } catch (err) {
      this.logger.error(
        `Analytics backfill failed: ${(err as Error).message}`,
      );
    }
  }
}
