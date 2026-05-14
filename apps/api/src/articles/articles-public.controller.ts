import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ArticlesService } from './articles.service';
import { ArticleListQueryDto } from './dto/article.dto';

@Controller('articles')
export class ArticlesPublicController {
  constructor(private readonly articles: ArticlesService) {}

  @Public()
  @Get()
  list(@Query() q: ArticleListQueryDto) {
    return this.articles.listPublic(q);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.articles.getPublicBySlug(slug);
  }

  @Public()
  @Get(':slug/related')
  related(@Param('slug') slug: string) {
    return this.articles.listRelated(slug);
  }
}
