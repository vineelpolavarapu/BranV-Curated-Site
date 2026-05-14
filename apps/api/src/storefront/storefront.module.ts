import { Module } from '@nestjs/common';
import { ProductsPublicController } from './products-public.controller';
import { ProductsPublicService } from './products-public.service';
import { BrandsPublicController } from './brands-public.controller';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { HomeController } from './home.controller';
import { ClicksModule } from '../clicks/clicks.module';
import { BannersModule } from '../banners/banners.module';
import { EditsModule } from '../edits/edits.module';

@Module({
  imports: [ClicksModule, BannersModule, EditsModule],
  controllers: [
    ProductsPublicController,
    BrandsPublicController,
    SearchController,
    HomeController,
  ],
  providers: [ProductsPublicService, SearchService],
  exports: [ProductsPublicService, SearchService],
})
export class StorefrontModule {}
