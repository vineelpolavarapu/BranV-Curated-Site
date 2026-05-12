import { Controller, Get } from '@nestjs/common';
import { BrandStatus, ProductStatus } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsPublicService } from './products-public.service';

const NEW_ARRIVAL_DAYS = 30;

@Controller('home')
export class HomeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsPublicService,
  ) {}

  @Public()
  @Get()
  async overview() {
    const newCutoff = new Date(
      Date.now() - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000,
    );

    const [featuredBrands, newArrivals] = await Promise.all([
      this.prisma.brand.findMany({
        where: { status: BrandStatus.ACTIVE, isFeatured: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          heroUrl: true,
          country: true,
        },
        take: 12,
      }),
      this.products.list({
        page: 1,
        pageSize: 12,
        // ProductSort.NEWEST
        sort: undefined,
        isNew: true,
      } as never),
    ]);

    return {
      featuredBrands,
      newArrivals: newArrivals.data,
      newArrivalsCount: newArrivals.total,
      // Articles / drops / edits / banners populate in Phases 6–7.
      banners: [] as Array<unknown>,
      latestArticles: [] as Array<unknown>,
      activeDrops: [] as Array<unknown>,
      featuredEdit: null as unknown,
      _newArrivalCutoff: newCutoff,
    };
  }
}
