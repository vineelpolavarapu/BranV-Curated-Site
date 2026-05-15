import { Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PriceSyncService } from './price-sync.service';

@Controller('admin/price-sync')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class PriceSyncController {
  constructor(private readonly sync: PriceSyncService) {}

  /** Manual trigger — handy for dev/testing without waiting for the cron. */
  @Post('run')
  run() {
    return this.sync.syncAll();
  }
}
