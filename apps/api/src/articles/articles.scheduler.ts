import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArticlesService } from './articles.service';

/** Flips SCHEDULED → PUBLISHED at scheduledAt (BUILD_GUIDE §6.2 step 3). */
@Injectable()
export class ArticlesScheduler {
  private readonly logger = new Logger(ArticlesScheduler.name);

  constructor(private readonly articles: ArticlesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    try {
      await this.articles.publishDueScheduled();
    } catch (err) {
      this.logger.error(
        `Article scheduler tick failed: ${(err as Error).message}`,
      );
    }
  }
}
