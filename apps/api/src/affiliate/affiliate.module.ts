import { Module } from '@nestjs/common';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { AffiliateWorker } from './affiliate.worker';
import { ScrapeModule } from '../scrape/scrape.module';

@Module({
  imports: [ScrapeModule],
  controllers: [AffiliateController],
  providers: [AffiliateService, AffiliateWorker],
  exports: [AffiliateService],
})
export class AffiliateModule {}
