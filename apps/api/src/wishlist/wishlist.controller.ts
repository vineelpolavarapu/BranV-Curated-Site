import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { tryReadUserId } from '../common/utils/optional-auth';
import { AddWishlistDto, UpdateWishlistDto } from './dto/wishlist.dto';
import { WishlistService } from './wishlist.service';

@Controller()
@UseGuards(RolesGuard)
@Roles(UserRole.MEMBER, UserRole.ADMIN)
export class WishlistController {
  constructor(
    private readonly wishlist: WishlistService,
    private readonly config: ConfigService,
  ) {}

  @Get('me/wishlist')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 24,
  ) {
    return this.wishlist.listForUser(
      user.id,
      page,
      Math.min(Math.max(pageSize, 1), 100),
    );
  }

  /**
   * Called by WishlistProvider on every storefront page to seed heart icons
   * across product cards. Public so anonymous visitors get `[]` instead of a
   * 401 on every shell mount. Signed-in users still get their real wishlist IDs.
   */
  @Public()
  @Get('me/wishlist/ids')
  async ids(@Req() req: Request) {
    const userId = tryReadUserId(req, this.config);
    if (!userId) return [];
    return this.wishlist.listIdsForUser(userId);
  }

  @Post('wishlist/items')
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddWishlistDto,
  ) {
    return this.wishlist.add({
      userId: user.id,
      productId: dto.productId,
      notifyOnPriceDrop: dto.notifyOnPriceDrop,
    });
  }

  @Delete('wishlist/items/:productId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ) {
    await this.wishlist.remove(user.id, productId);
  }

  @Patch('wishlist/items/:productId')
  setNotify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() dto: UpdateWishlistDto,
  ) {
    return this.wishlist.setNotify(user.id, productId, dto.notifyOnPriceDrop);
  }
}
