import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProductsPublicService } from './products-public.service';
import { ProductListQueryDto } from './dto/storefront.dto';

@Controller('products')
export class ProductsPublicController {
  constructor(private readonly products: ProductsPublicService) {}

  @Public()
  @Get()
  list(@Query() q: ProductListQueryDto) {
    return this.products.list(q);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.products.getBySlug(slug);
  }

  @Public()
  @Get(':slug/related')
  related(@Param('slug') slug: string) {
    return this.products.related(slug);
  }
}
