import { Module } from '@nestjs/common';
import { ProductsAdminController } from './products.controller';
import { ProductsService } from './products.service';
import { ScrapeModule } from '../scrape/scrape.module';
import { AffiliateModule } from '../affiliate/affiliate.module';

@Module({
  imports: [ScrapeModule, AffiliateModule],
  controllers: [ProductsAdminController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
