import { Injectable, NotFoundException } from '@nestjs/common';
import { Brand, BrandStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ensureUniqueSlug, slugify } from '../common/utils/slug';
import { makePage, PageResult } from '../common/dto/pagination.dto';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

export type BrandWithCount = Brand & { _count: { products: number } };

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<PageResult<BrandWithCount>> {
    const where: Prisma.BrandWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, data] = await this.prisma.$transaction([
      this.prisma.brand.count({ where }),
      this.prisma.brand.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { products: true } } },
      }),
    ]);
    return makePage(data, total, page, pageSize);
  }

  async getById(id: string): Promise<BrandWithCount> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(dto: CreateBrandDto, actorId: string): Promise<Brand> {
    const baseSlug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const slug = await ensureUniqueSlug(baseSlug, async (cand) => {
      const exists = await this.prisma.brand.findUnique({
        where: { slug: cand },
      });
      return !!exists;
    });

    const brand = await this.prisma.brand.create({
      data: {
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl,
        heroUrl: dto.heroUrl,
        description: dto.description,
        isFeatured: dto.isFeatured ?? false,
        status: dto.status ?? BrandStatus.ACTIVE,
      },
    });

    await this.audit.record({
      actorId,
      action: 'brand.create',
      targetType: 'brand',
      targetId: brand.id,
      metadata: { name: brand.name, slug: brand.slug },
    });
    return brand;
  }

  async update(
    id: string,
    dto: UpdateBrandDto,
    actorId: string,
  ): Promise<Brand> {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Brand not found');

    let nextSlug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      nextSlug = await ensureUniqueSlug(slugify(dto.slug), async (cand) => {
        const conflict = await this.prisma.brand.findUnique({
          where: { slug: cand },
        });
        return !!conflict && conflict.id !== id;
      });
    }

    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        slug: nextSlug,
        logoUrl: dto.logoUrl ?? undefined,
        heroUrl: dto.heroUrl ?? undefined,
        description: dto.description ?? undefined,
        isFeatured: dto.isFeatured ?? undefined,
        status: dto.status ?? undefined,
      },
    });
    await this.audit.record({
      actorId,
      action: 'brand.update',
      targetType: 'brand',
      targetId: id,
    });
    return brand;
  }

  /**
   * Soft delete: archive instead of removing rows so click history and
   * existing product references stay intact (PRD §21 Key Constraints).
   * Hard delete only allowed when the brand has zero products.
   */
  async delete(id: string, actorId: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');

    if (brand._count.products > 0) {
      await this.prisma.brand.update({
        where: { id },
        data: { status: BrandStatus.ARCHIVED },
      });
      await this.audit.record({
        actorId,
        action: 'brand.archive',
        targetType: 'brand',
        targetId: id,
        metadata: { productCount: brand._count.products },
      });
    } else {
      await this.prisma.brand.delete({ where: { id } });
      await this.audit.record({
        actorId,
        action: 'brand.delete',
        targetType: 'brand',
        targetId: id,
      });
    }
  }
}
