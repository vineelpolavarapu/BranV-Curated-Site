import { Controller, Get } from '@nestjs/common';
import { ArticleStatus, BrandStatus } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsPublicService } from './products-public.service';
import { BannersService } from '../banners/banners.service';
import { EditsService } from '../edits/edits.service';

const NEW_ARRIVAL_DAYS = 30;
const CATEGORY_SECTION_SIZE = 5;
const CATEGORY_SECTION_COUNT = 7;

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
      latestArticles,
      categorySections,
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
      this.buildCategorySections(),
    ]);

    return {
      banners,
      featuredBrands,
      newArrivals: newArrivals.data,
      newArrivalsCount: newArrivals.total,
      featuredEdit,
      latestArticles,
      categorySections,
      _newArrivalCutoff: newCutoff,
    };
  }

  /**
   * Per-category preview buckets for the home page. Takes the top-N L1
   * categories by displayOrder and, for each, returns up to 5 ACTIVE products
   * ordered featured-first (most-recently-featured first), then by createdAt
   * desc — so the latest admin-added product surfaces immediately and any
   * currently-featured product floats to the top of its row.
   */
  private async buildCategorySections() {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: { displayOrder: 'asc' },
      take: CATEGORY_SECTION_COUNT,
      select: { id: true, slug: true, name: true },
    });

    const now = new Date();
    const buckets = await Promise.all(
      categories.map(async (cat) => {
        const result = await this.products.list({
          page: 1,
          pageSize: CATEGORY_SECTION_SIZE,
          category: cat.slug,
        } as never);
        // products.list uses a single orderBy (newest). Re-sort here so that
        // any product with an active featuredUntil sits at the front. Keeps
        // the existing service signature unchanged.
        const sorted = [...(result.data as Array<{
          isFeatured: boolean;
          featuredUntil: Date | null;
          createdAt: Date | string;
        }>)].sort((a, b) => {
          const aFeat = !!a.featuredUntil && new Date(a.featuredUntil) > now;
          const bFeat = !!b.featuredUntil && new Date(b.featuredUntil) > now;
          if (aFeat !== bFeat) return aFeat ? -1 : 1;
          if (aFeat && bFeat) {
            return new Date(b.featuredUntil!).getTime() - new Date(a.featuredUntil!).getTime();
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return {
          category: cat,
          products: sorted.slice(0, CATEGORY_SECTION_SIZE),
        };
      }),
    );

    // Hide sections that have no published products — matches the storefront's
    // "hide empty" requirement so admin doesn't surface a blank row.
    return buckets.filter((b) => b.products.length > 0);
  }
}
