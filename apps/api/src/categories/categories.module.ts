import { Module } from '@nestjs/common';
import {
  CategoriesAdminController,
  CategoriesPublicController,
} from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesPublicController, CategoriesAdminController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
