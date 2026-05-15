import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PriceSyncService } from './price-sync.service';

@Injectable()
export class PriceSyncScheduler {
  private readonly logger = new Logger(PriceSyncScheduler.name);

  constructor(private readonly sync: PriceSyncService) {}

  /** Nightly at 03:00 (BUILD_GUIDE §9.1). */
  @Cron('0 3 * * *')
  async nightly() {
    this.logger.log('Starting nightly price sync…');
    try {
      const stats = await this.sync.syncAll();
      this.logger.log(`Price sync done: ${JSON.stringify(stats)}`);
    } catch (err) {
      this.logger.error(
        `Price sync run failed: ${(err as Error).message}`,
      );
    }
  }
}
