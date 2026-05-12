import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  BulkUpsertAttributeSchemaDto,
  UpsertAttributeSchemaDto,
} from './dto/category.dto';
import { CategoriesService } from './categories.service';

// ─────────── PUBLIC: read-only category tree (used by storefront in Phase 4) ───────────

@Controller('categories')
export class CategoriesPublicController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  list() {
    return this.categories.listAll();
  }

  @Public()
  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    return this.categories.getBySlug(slug);
  }

  @Public()
  @Get(':slug/filters')
  async getFilters(@Param('slug') slug: string) {
    const category = await this.categories.getBySlug(slug);
    return {
      categorySlug: slug,
      filters: category.attributeSchemas,
    };
  }
}

// ─────────── ADMIN: edit attribute schemas per category ───────────

@Controller('admin/categories')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class CategoriesAdminController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.listAll();
  }

  @Get(':id/attribute-schemas')
  listSchemas(@Param('id') id: string) {
    return this.categories.listAttributeSchemas(id);
  }

  @Post(':id/attribute-schemas')
  upsertSchema(
    @Param('id') id: string,
    @Body() dto: UpsertAttributeSchemaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categories.upsertAttributeSchema(id, dto, user.id);
  }

  @Put(':id/attribute-schemas')
  bulkUpsertSchemas(
    @Param('id') id: string,
    @Body() dto: BulkUpsertAttributeSchemaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categories.bulkUpsertAttributeSchemas(id, dto, user.id);
  }

  @Delete(':id/attribute-schemas/:attributeKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSchema(
    @Param('id') id: string,
    @Param('attributeKey') attributeKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.categories.deleteAttributeSchema(id, attributeKey, user.id);
  }
}
