import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationsService } from './notifications.service';
import {
  NotificationsListQueryDto,
  UpdatePreferenceDto,
} from './dto/notifications.dto';

@Controller()
@UseGuards(RolesGuard)
@Roles(UserRole.MEMBER, UserRole.ADMIN)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: NotificationsListQueryDto,
  ) {
    return this.notifications.listForUser(
      user.id,
      q.page ?? 1,
      q.pageSize ?? 20,
      q.unreadOnly ?? false,
    );
  }

  @Get('notifications/unread-count')
  async unread(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notifications.unreadCount(user.id);
    return { count };
  }

  @Post('notifications/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.notifications.markRead(user.id, id);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    await this.notifications.markAllRead(user.id);
  }

  @Get('notification-preferences')
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listPreferences(user.id);
  }

  @Patch('notification-preferences')
  upsertPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.notifications.upsertPreference(
      user.id,
      dto.type,
      dto.channel,
      dto.enabled,
    );
  }
}
