import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { tryReadUserId } from '../common/utils/optional-auth';
import { ReviewsService } from './reviews.service';
import {
  AdminReviewsListQueryDto,
  CreateReviewDto,
  ModerateReviewDto,
  ReviewsListQueryDto,
} from './dto/review.dto';

@Controller('products/:productId/reviews')
export class ReviewsPublicController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  list(
    @Param('productId') productId: string,
    @Query() q: ReviewsListQueryDto,
  ) {
    return this.reviews.listForProduct(productId, q);
  }

  /**
   * Lets the frontend show the right CTA: "Leave a review", "Already reviewed",
   * "Buy to review", or "Sign in to review". Public on purpose — when there's
   * no auth cookie we return an "anonymous" shape (canReview: false) rather
   * than throwing 401, since every storefront product page mounts this and a
   * 401 here just clutters logs / the browser console for signed-out visitors.
   */
  @Public()
  @Get('me')
  async getMine(
    @Param('productId') productId: string,
    @Req() req: Request,
  ) {
    const userId = tryReadUserId(req, this.config);
    if (!userId) {
      return { canReview: false, hasWardrobeItem: false, ownReview: null };
    }
    return this.reviews.getReviewability(productId, userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @Post()
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviews.create(productId, user.id, dto);
  }
}

@Controller('admin/reviews')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class ReviewsAdminController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() q: AdminReviewsListQueryDto) {
    return this.reviews.listAdmin(q);
  }

  @Patch(':id')
  moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviews.moderate(id, dto, user.id);
  }
}
