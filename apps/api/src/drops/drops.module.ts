import { Module } from '@nestjs/common';
import { DropsService } from './drops.service';
import { DropsAdminController } from './drops-admin.controller';
import { DropsPublicController } from './drops-public.controller';
import { DropsScheduler } from './drops.scheduler';
import { ClicksModule } from '../clicks/clicks.module';

@Module({
  imports: [ClicksModule],
  controllers: [DropsAdminController, DropsPublicController],
  providers: [DropsService, DropsScheduler],
  exports: [DropsService],
})
export class DropsModule {}
