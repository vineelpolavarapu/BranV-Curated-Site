import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { BrandStatus } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('brands')
export class BrandsPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.brand.findMany({
      where: { status: BrandStatus.ACTIVE },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        heroUrl: true,
        country: true,
        isFeatured: true,
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
    });
  }

  @Public()
  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: {
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!brand || brand.status !== BrandStatus.ACTIVE) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }
}
