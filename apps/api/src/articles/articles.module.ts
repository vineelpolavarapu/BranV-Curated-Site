import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesAdminController } from './articles-admin.controller';
import { ArticlesPublicController } from './articles-public.controller';
import { ArticlesScheduler } from './articles.scheduler';
import { ClicksModule } from '../clicks/clicks.module';

@Module({
  imports: [ClicksModule],
  controllers: [ArticlesAdminController, ArticlesPublicController],
  providers: [ArticlesService, ArticlesScheduler],
  exports: [ArticlesService],
})
export class ArticlesModule {}
