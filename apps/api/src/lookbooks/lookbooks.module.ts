import { Module } from '@nestjs/common';
import { LookbooksService } from './lookbooks.service';
import {
  LookbooksAdminController,
  LookbooksPublicController,
} from './lookbooks.controller';
import { ClicksModule } from '../clicks/clicks.module';

@Module({
  imports: [ClicksModule],
  controllers: [LookbooksAdminController, LookbooksPublicController],
  providers: [LookbooksService],
  exports: [LookbooksService],
})
export class LookbooksModule {}
