import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRollupService } from './analytics-rollup.service';
import { AnalyticsScheduler } from './analytics.scheduler';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRollupService, AnalyticsScheduler],
  exports: [AnalyticsService, AnalyticsRollupService],
})
export class AnalyticsModule {}
