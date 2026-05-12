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
import { Roles } from '../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AvatarsService } from './avatars.service';
import { CreateAvatarDto, UpdateAvatarDto } from './dto/avatar.dto';

@Controller('admin/avatars')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AvatarsController {
  constructor(private readonly avatars: AvatarsService) {}

  @Get()
  list() {
    return this.avatars.list();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.avatars.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreateAvatarDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.avatars.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAvatarDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.avatars.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.avatars.delete(id, user.id);
  }
}
