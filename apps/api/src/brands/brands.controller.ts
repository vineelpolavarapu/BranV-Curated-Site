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
import { Roles } from '../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { BrandsService } from './brands.service';

@Controller('admin/brands')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  list(@Query() q: PaginationDto) {
    return this.brands.list(q.page ?? 1, q.pageSize ?? 20, q.search);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.brands.getById(id);
  }

  @Post()
  create(@Body() dto: CreateBrandDto, @CurrentUser() user: AuthenticatedUser) {
    return this.brands.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.brands.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.brands.delete(id, user.id);
  }
}
