import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';

@Controller('admin/analytics')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
  }

  @Get('clicks')
  clicks() {
    return this.analytics.clicks();
  }

  @Get('content')
  content() {
    return this.analytics.content();
  }

  @Get('drops')
  drops() {
    return this.analytics.drops();
  }

  @Get('members')
  members() {
    return this.analytics.members();
  }

  @Get('system')
  system() {
    return this.analytics.system();
  }

  /** Combined payload used by /admin landing — saves on round-trips. */
  @Get('dashboard')
  dashboard() {
    return this.analytics.dashboard();
  }
}
