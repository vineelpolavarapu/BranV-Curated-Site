import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { BannersService } from './banners.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@Controller('admin/banners')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class BannersAdminController {
  constructor(private readonly banners: BannersService) {}

  @Get() list() { return this.banners.listAdmin(); }
  @Get(':id') getOne(@Param('id') id: string) { return this.banners.getById(id); }

  @Post()
  create(@Body() dto: CreateBannerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.banners.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.banners.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.banners.delete(id, user.id);
  }
}
