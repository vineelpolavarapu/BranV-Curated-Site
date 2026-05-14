import { Injectable, NotFoundException } from '@nestjs/common';
import { BrandStoryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertBrandStoryDto } from './dto/brand-story.dto';

@Injectable()
export class BrandStoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAdminByBrand(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: { story: true },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand.story ?? null;
  }

  async upsert(brandId: string, dto: UpsertBrandStoryDto, actorId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');

    const story = await this.prisma.brandStory.upsert({
      where: { brandId },
      update: {
        heroUrl: dto.heroUrl ?? undefined,
        bodyMd: dto.bodyMd ?? undefined,
        status: dto.status ?? undefined,
      },
      create: {
        brandId,
        heroUrl: dto.heroUrl ?? null,
        bodyMd: dto.bodyMd ?? '',
        status: dto.status ?? BrandStoryStatus.DRAFT,
      },
    });
    await this.audit.record({
      actorId,
      action: 'brand_story.upsert',
      targetType: 'brand_story',
      targetId: story.id,
      metadata: { brandId, status: story.status },
    });
    return story;
  }

  async getPublishedByBrandSlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: { story: true },
    });
    if (!brand || !brand.story) return null;
    if (brand.story.status !== BrandStoryStatus.PUBLISHED) return null;
    return {
      heroUrl: brand.story.heroUrl,
      bodyMd: brand.story.bodyMd,
    };
  }
}
