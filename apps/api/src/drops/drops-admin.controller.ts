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
import { DropsService } from './drops.service';
import {
  CreateDropDto,
  DropListQueryDto,
  UpdateDropDto,
} from './dto/drop.dto';

@Controller('admin/drops')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class DropsAdminController {
  constructor(private readonly drops: DropsService) {}

  @Get()
  list(@Query() q: DropListQueryDto) {
    return this.drops.listAdmin(q);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.drops.getAdminById(id);
  }

  @Post()
  create(
    @Body() dto: CreateDropDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.drops.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDropDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.drops.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.drops.archive(id, user.id);
  }
}
