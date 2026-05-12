import { Module } from '@nestjs/common';
import { ClicksController } from './clicks.controller';
import { ClicksService } from './clicks.service';
import { WardrobeModule } from '../wardrobe/wardrobe.module';

@Module({
  imports: [WardrobeModule],
  controllers: [ClicksController],
  providers: [ClicksService],
  exports: [ClicksService],
})
export class ClicksModule {}
