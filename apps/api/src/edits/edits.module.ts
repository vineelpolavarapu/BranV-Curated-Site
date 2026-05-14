import { Module } from '@nestjs/common';
import { EditsService } from './edits.service';
import {
  EditsAdminController,
  EditsPublicController,
} from './edits.controller';
import { ClicksModule } from '../clicks/clicks.module';

@Module({
  imports: [ClicksModule],
  controllers: [EditsAdminController, EditsPublicController],
  providers: [EditsService],
  exports: [EditsService],
})
export class EditsModule {}
