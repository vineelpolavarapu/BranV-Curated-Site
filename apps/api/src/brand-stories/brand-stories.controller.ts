import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { BrandStoriesService } from './brand-stories.service';
import { UpsertBrandStoryDto } from './dto/brand-story.dto';

@Controller('admin/brands/:brandId/story')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class BrandStoriesAdminController {
  constructor(private readonly stories: BrandStoriesService) {}

  @Get()
  get(@Param('brandId') brandId: string) {
    return this.stories.getAdminByBrand(brandId);
  }

  @Put()
  upsert(
    @Param('brandId') brandId: string,
    @Body() dto: UpsertBrandStoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stories.upsert(brandId, dto, user.id);
  }
}

@Controller('brands')
export class BrandStoriesPublicController {
  constructor(private readonly stories: BrandStoriesService) {}

  /** Embedded under the brand detail response in storefront pages. */
  @Public()
  @Get(':slug/story')
  story(@Param('slug') slug: string) {
    return this.stories.getPublishedByBrandSlug(slug);
  }
}
