import { Module } from '@nestjs/common';
import { PriceSyncService } from './price-sync.service';
import { PriceSyncScheduler } from './price-sync.scheduler';
import { PriceSyncController } from './price-sync.controller';
import { ScrapeModule } from '../scrape/scrape.module';

@Module({
  imports: [ScrapeModule],
  controllers: [PriceSyncController],
  providers: [PriceSyncService, PriceSyncScheduler],
  exports: [PriceSyncService],
})
export class PriceSyncModule {}
