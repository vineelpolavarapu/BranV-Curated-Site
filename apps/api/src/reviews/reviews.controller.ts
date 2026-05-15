import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { ReviewsService } from './reviews.service';
import {
  AdminReviewsListQueryDto,
  CreateReviewDto,
  ModerateReviewDto,
  ReviewsListQueryDto,
} from './dto/review.dto';

@Controller('products/:productId/reviews')
export class ReviewsPublicController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get()
  list(
    @Param('productId') productId: string,
    @Query() q: ReviewsListQueryDto,
  ) {
    return this.reviews.listForProduct(productId, q);
  }

  /** Lets the frontend show the right CTA: "Leave a review", "Already reviewed", "Buy to review". */
  @UseGuards(RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @Get('me')
  async getMine(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviews.getReviewability(productId, user.id);
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
