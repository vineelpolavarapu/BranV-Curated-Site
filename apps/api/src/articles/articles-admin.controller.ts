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
import { ArticlesService } from './articles.service';
import {
  ArticleListQueryDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/article.dto';

@Controller('admin/articles')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class ArticlesAdminController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list(@Query() q: ArticleListQueryDto) {
    return this.articles.listAdmin(q);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.articles.getAdminById(id);
  }

  @Post()
  create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.articles.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.articles.archive(id, user.id);
  }
}
