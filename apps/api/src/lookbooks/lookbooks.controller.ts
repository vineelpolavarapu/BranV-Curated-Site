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
import { Public } from '../common/decorators/public.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { LookbooksService } from './lookbooks.service';
import {
  CreateLookbookDto,
  LookbookListQueryDto,
  UpdateLookbookDto,
} from './dto/lookbook.dto';

@Controller('admin/lookbooks')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class LookbooksAdminController {
  constructor(private readonly lookbooks: LookbooksService) {}

  @Get()
  list(@Query() q: LookbookListQueryDto) {
    return this.lookbooks.listAdmin(q);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.lookbooks.getAdminById(id);
  }

  @Post()
  create(@Body() dto: CreateLookbookDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lookbooks.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLookbookDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lookbooks.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.lookbooks.archive(id, user.id);
  }
}

@Controller('lookbooks')
export class LookbooksPublicController {
  constructor(private readonly lookbooks: LookbooksService) {}

  @Public()
  @Get()
  list() {
    return this.lookbooks.listPublic();
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.lookbooks.getPublicBySlug(slug);
  }
}
