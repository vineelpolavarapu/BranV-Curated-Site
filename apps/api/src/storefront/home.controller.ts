import { Controller, Get } from '@nestjs/common';
import { ArticleStatus, BrandStatus, DropStatus } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsPublicService } from './products-public.service';
import { BannersService } from '../banners/banners.service';
import { EditsService } from '../edits/edits.service';

const NEW_ARRIVAL_DAYS = 30;

@Controller('home')
export class HomeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsPublicService,
    private readonly banners: BannersService,
    private readonly edits: EditsService,
  ) {}

  @Public()
  @Get()
  async overview() {
    const newCutoff = new Date(
      Date.now() - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000,
    );

    const [
      featuredBrands,
      newArrivals,
      banners,
      featuredEdit,
      activeDrops,
      latestArticles,
    ] = await Promise.all([
      this.prisma.brand.findMany({
        where: { status: BrandStatus.ACTIVE, isFeatured: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          heroUrl: true,
        },
        take: 12,
      }),
      this.products.list({
        page: 1,
        pageSize: 12,
        sort: undefined,
        isNew: true,
      } as never),
      this.banners.listActiveForHome(),
      this.edits.getFeaturedForHome(),
      this.prisma.drop.findMany({
        where: { status: DropStatus.LIVE },
        orderBy: { launchAt: 'desc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          name: true,
          heroUrl: true,
          launchAt: true,
          endsAt: true,
        },
      }),
      this.prisma.article.findMany({
        where: { status: ArticleStatus.PUBLISHED },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroUrl: true,
          publishedAt: true,
          readingMinutes: true,
        },
      }),
    ]);

    return {
      banners,
      featuredBrands,
      newArrivals: newArrivals.data,
      newArrivalsCount: newArrivals.total,
      featuredEdit,
      activeDrops,
      latestArticles,
      _newArrivalCutoff: newCutoff,
    };
  }
}
