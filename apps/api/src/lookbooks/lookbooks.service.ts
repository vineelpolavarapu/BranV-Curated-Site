import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LookbookStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClicksService } from '../clicks/clicks.service';
import { ensureUniqueSlug, slugify } from '../common/utils/slug';
import { makePage, PageResult } from '../common/dto/pagination.dto';
import {
  CreateLookbookDto,
  LookbookImageInput,
  LookbookListQueryDto,
  UpdateLookbookDto,
} from './dto/lookbook.dto';

@Injectable()
export class LookbooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clicks: ClicksService,
  ) {}

  // ────────────────────────── ADMIN ──────────────────────────

  async listAdmin(q: LookbookListQueryDto): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 24;
    const where: Prisma.LookbookWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { slug: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.lookbook.count({ where }),
      this.prisma.lookbook.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { images: true } },
        },
      }),
    ]);
    return makePage(data, total, page, pageSize);
  }

  async getAdminById(id: string) {
    const lb = await this.prisma.lookbook.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { position: 'asc' },
          include: {
            tags: {
              include: {
                product: { select: { id: true, slug: true, title: true } },
              },
            },
          },
        },
      },
    });
    if (!lb) throw new NotFoundException('Lookbook not found');
    return lb;
  }

  async create(dto: CreateLookbookDto, actorId: string) {
    const base = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    const slug = await ensureUniqueSlug(base, async (cand) => {
      const exists = await this.prisma.lookbook.findUnique({ where: { slug: cand } });
      return !!exists;
    });

    const status = dto.status ?? LookbookStatus.DRAFT;
    await this.validateImageProductIds(dto.images);

    const lookbook = await this.prisma.lookbook.create({
      data: {
        slug,
        title: dto.title,
        heroUrl: dto.heroUrl,
        description: dto.description,
        status,
        publishedAt: status === LookbookStatus.PUBLISHED ? new Date() : null,
        images: {
          create: (dto.images ?? []).map((img, idx) => ({
            imageUrl: img.imageUrl,
            position: img.position ?? idx,
            tags: {
              create: (img.tags ?? []).map((t) => ({
                productId: t.productId,
                xPercent: t.xPercent,
                yPercent: t.yPercent,
              })),
            },
          })),
        },
      },
    });
    await this.audit.record({
      actorId,
      action: 'lookbook.create',
      targetType: 'lookbook',
      targetId: lookbook.id,
      metadata: { slug: lookbook.slug },
    });
    return lookbook;
  }

  async update(id: string, dto: UpdateLookbookDto, actorId: string) {
    const existing = await this.prisma.lookbook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lookbook not found');

    let nextSlug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      nextSlug = await ensureUniqueSlug(slugify(dto.slug), async (cand) => {
        const conflict = await this.prisma.lookbook.findUnique({
          where: { slug: cand },
        });
        return !!conflict && conflict.id !== id;
      });
    }

    const nextStatus = dto.status ?? existing.status;
    const publishedAt =
      nextStatus === LookbookStatus.PUBLISHED &&
      existing.status !== LookbookStatus.PUBLISHED
        ? new Date()
        : existing.publishedAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.images) {
        await this.validateImageProductIds(dto.images);
        await tx.lookbookImage.deleteMany({ where: { lookbookId: id } });
        for (let i = 0; i < dto.images.length; i++) {
          const img = dto.images[i];
          await tx.lookbookImage.create({
            data: {
              lookbookId: id,
              imageUrl: img.imageUrl,
              position: img.position ?? i,
              tags: {
                create: (img.tags ?? []).map((t) => ({
                  productId: t.productId,
                  xPercent: t.xPercent,
                  yPercent: t.yPercent,
                })),
              },
            },
          });
        }
      }
      return tx.lookbook.update({
        where: { id },
        data: {
          slug: nextSlug,
          title: dto.title ?? undefined,
          heroUrl: dto.heroUrl ?? undefined,
          description: dto.description ?? undefined,
          status: nextStatus,
          publishedAt,
        },
      });
    });
    await this.audit.record({
      actorId,
      action: 'lookbook.update',
      targetType: 'lookbook',
      targetId: id,
    });
    return updated;
  }

  async archive(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.lookbook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lookbook not found');
    await this.prisma.lookbook.update({
      where: { id },
      data: { status: LookbookStatus.ARCHIVED },
    });
    await this.audit.record({
      actorId,
      action: 'lookbook.archive',
      targetType: 'lookbook',
      targetId: id,
    });
  }

  // ────────────────────────── PUBLIC ──────────────────────────

  async listPublic() {
    return this.prisma.lookbook.findMany({
      where: { status: LookbookStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        heroUrl: true,
        description: true,
        publishedAt: true,
        _count: { select: { images: true } },
      },
    });
  }

  async getPublicBySlug(slug: string) {
    const lb = await this.prisma.lookbook.findUnique({
      where: { slug },
      include: {
        images: {
          orderBy: { position: 'asc' },
          include: {
            tags: {
              include: {
                product: {
                  include: {
                    brand: { select: { id: true, name: true, slug: true } },
                    images: {
                      where: { isPrimary: true },
                      take: 1,
                      orderBy: { position: 'asc' },
                    },
                    retailerListings: {
                      where: { availabilityStatus: 'IN_STOCK' },
                      include: {
                        affiliateLinks: {
                          where: { pendingConversion: false },
                          orderBy: { createdAt: 'desc' },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!lb || lb.status !== LookbookStatus.PUBLISHED) {
      throw new NotFoundException('Lookbook not found');
    }

    const shapedImages = await Promise.all(
      lb.images.map(async (img) => {
        const tags = await Promise.all(
          img.tags.map(async (t) => {
            const p = t.product;
            const listing = p.retailerListings[0] ?? null;
            const affiliate = listing?.affiliateLinks[0] ?? null;
            const partnerUrl =
              affiliate?.convertedUrl ?? listing?.retailerProductUrl ?? null;
            const trackingId = listing && partnerUrl
              ? await this.clicks.mint({
                  productId: p.id,
                  retailer: listing.retailer,
                  partner: affiliate?.partner ?? null,
                  partnerUrl,
                  sourcePageUrl: `/lookbooks/${lb.slug}`,
                })
              : null;
            const primary = p.images[0] ?? null;
            return {
              id: t.id,
              xPercent: Number(t.xPercent),
              yPercent: Number(t.yPercent),
              product: {
                slug: p.slug,
                title: p.title,
                brand: p.brand,
                price: Number(p.price),
                mrp: p.mrp ? Number(p.mrp) : null,
                currency: p.currency,
                primaryImage: primary
                  ? {
                      url: primary.url,
                      altText: primary.altText,
                      isAiGenerated: primary.isAiGenerated,
                    }
                  : null,
                buyNow: listing
                  ? {
                      retailer: listing.retailer,
                      url: partnerUrl!,
                      partner: affiliate?.partner ?? null,
                      pending: affiliate?.pendingConversion ?? true,
                      trackingId,
                    }
                  : null,
              },
            };
          }),
        );
        return {
          id: img.id,
          imageUrl: img.imageUrl,
          position: img.position,
          tags,
        };
      }),
    );

    return {
      id: lb.id,
      slug: lb.slug,
      title: lb.title,
      heroUrl: lb.heroUrl,
      description: lb.description,
      publishedAt: lb.publishedAt,
      images: shapedImages,
    };
  }

  // ────────────────────────── helpers ──────────────────────────

  private async validateImageProductIds(images?: LookbookImageInput[]) {
    if (!images || images.length === 0) return;
    const ids = new Set<string>();
    for (const img of images) {
      for (const t of img.tags ?? []) ids.add(t.productId);
    }
    if (ids.size === 0) return;
    const found = await this.prisma.product.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });
    if (found.length !== ids.size) {
      throw new BadRequestException('One or more tag productIds are invalid');
    }
  }
}
