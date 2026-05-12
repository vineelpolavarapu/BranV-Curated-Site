import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ConvertUrlDto } from './dto/affiliate.dto';
import { AffiliateService } from './affiliate.service';

@Controller('admin/affiliate')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AffiliateController {
  constructor(private readonly affiliate: AffiliateService) {}

  /**
   * Convert a raw retailer URL to an affiliate-tagged URL.
   * Used directly when an admin pastes a URL outside of Quick Add;
   * Quick Add itself calls AffiliateService internally inside its transaction.
   */
  @Post('convert-url')
  convertUrl(@Body() dto: ConvertUrlDto) {
    return this.affiliate.convert(dto.rawUrl);
  }
}
