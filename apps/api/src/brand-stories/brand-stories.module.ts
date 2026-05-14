import { Module } from '@nestjs/common';
import { BrandStoriesService } from './brand-stories.service';
import {
  BrandStoriesAdminController,
  BrandStoriesPublicController,
} from './brand-stories.controller';

@Module({
  controllers: [BrandStoriesAdminController, BrandStoriesPublicController],
  providers: [BrandStoriesService],
  exports: [BrandStoriesService],
})
export class BrandStoriesModule {}
