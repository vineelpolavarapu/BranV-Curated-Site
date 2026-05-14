import { Module } from '@nestjs/common';
import { BannersService } from './banners.service';
import { BannersAdminController } from './banners.controller';

@Module({
  controllers: [BannersAdminController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
