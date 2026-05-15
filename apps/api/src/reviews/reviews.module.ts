import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import {
  ReviewsAdminController,
  ReviewsPublicController,
} from './reviews.controller';

@Module({
  controllers: [ReviewsPublicController, ReviewsAdminController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
