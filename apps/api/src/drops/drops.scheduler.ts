import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DropsService } from './drops.service';

@Injectable()
export class DropsScheduler {
  private readonly logger = new Logger(DropsScheduler.name);

  constructor(private readonly drops: DropsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    try {
      const { launched, ended } = await this.drops.tickStatuses();
      if (launched > 0 || ended > 0) {
        this.logger.log(`Drop scheduler: launched=${launched} ended=${ended}`);
      }
    } catch (err) {
      this.logger.error(
        `Drop scheduler tick failed: ${(err as Error).message}`,
      );
    }
  }
}
