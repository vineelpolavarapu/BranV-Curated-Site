import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import {
  NewsletterAdminController,
  NewsletterController,
} from './newsletter.controller';

@Module({
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
