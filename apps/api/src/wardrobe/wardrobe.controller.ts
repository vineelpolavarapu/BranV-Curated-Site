import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { WardrobeService } from './wardrobe.service';

@Controller()
@UseGuards(RolesGuard)
@Roles(UserRole.MEMBER, UserRole.ADMIN)
export class WardrobeController {
  constructor(private readonly wardrobe: WardrobeService) {}

  @Get('me/wardrobe')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 24,
  ) {
    return this.wardrobe.listForUser(
      user.id,
      page,
      Math.min(Math.max(pageSize, 1), 100),
    );
  }

  @Delete('wardrobe/items/:id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.wardrobe.remove(user.id, id);
  }
}
