import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AffiliateService } from './affiliate.service';

@Injectable()
export class AffiliateWorker {
  private readonly logger = new Logger(AffiliateWorker.name);

  constructor(private readonly affiliate: AffiliateService) {}

  /** Retries Cuelinks conversion for any links flagged `pendingConversion`. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryPending() {
    const resolved = await this.affiliate.resolvePending(50);
    if (resolved > 0) {
      this.logger.log(`Resolved ${resolved} pending affiliate link(s)`);
    }
  }
}
