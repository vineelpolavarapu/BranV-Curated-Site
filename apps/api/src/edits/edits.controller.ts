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
import { EditsService } from './edits.service';
import { CreateEditDto, EditListQueryDto, UpdateEditDto } from './dto/edit.dto';

@Controller('admin/edits')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class EditsAdminController {
  constructor(private readonly edits: EditsService) {}

  @Get() list(@Query() q: EditListQueryDto) { return this.edits.listAdmin(q); }
  @Get(':id') getOne(@Param('id') id: string) { return this.edits.getAdminById(id); }

  @Post()
  create(@Body() dto: CreateEditDto, @CurrentUser() user: AuthenticatedUser) {
    return this.edits.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.edits.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.edits.archive(id, user.id);
  }
}

@Controller('edits')
export class EditsPublicController {
  constructor(private readonly edits: EditsService) {}

  @Public() @Get() list() { return this.edits.listPublic(); }
  @Public() @Get(':slug') detail(@Param('slug') slug: string) {
    return this.edits.getPublicBySlug(slug);
  }
}
