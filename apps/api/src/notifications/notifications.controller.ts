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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { tryReadUserId } from '../common/utils/optional-auth';
import { NotificationsService } from './notifications.service';
import {
  NotificationsListQueryDto,
  UpdatePreferenceDto,
} from './dto/notifications.dto';

@Controller()
@UseGuards(RolesGuard)
@Roles(UserRole.MEMBER, UserRole.ADMIN)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

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

  /**
   * Polled by the NotificationsBell on every storefront page. Public so
   * anonymous visitors get `{ count: 0 }` rather than a 401, which would
   * spam the browser console + API logs on every poll for signed-out users.
   * Signed-in users still get their real unread count.
   */
  @Public()
  @Get('notifications/unread-count')
  async unread(@Req() req: Request) {
    const userId = tryReadUserId(req, this.config);
    if (!userId) return { count: 0 };
    const count = await this.notifications.unreadCount(userId);
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
