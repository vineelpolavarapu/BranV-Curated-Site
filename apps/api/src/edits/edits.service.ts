import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EditStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClicksService } from '../clicks/clicks.service';
import { ensureUniqueSlug, slugify } from '../common/utils/slug';
import { makePage, PageResult } from '../common/dto/pagination.dto';
import {
  CreateEditDto,
  EditListQueryDto,
  UpdateEditDto,
} from './dto/edit.dto';

@Injectable()
export class EditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clicks: ClicksService,
  ) {}

  // ────────────────────────── ADMIN ──────────────────────────

  async listAdmin(q: EditListQueryDto): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 24;
    const where: Prisma.EditWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { slug: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.edit.count({ where }),
      this.prisma.edit.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { editProducts: true } },
        },
      }),
    ]);
    return makePage(data, total, page, pageSize);
  }

  async getAdminById(id: string) {
    const edit = await this.prisma.edit.findUnique({
      where: { id },
      include: {
        editProducts: {
          orderBy: { position: 'asc' },
          include: {
            product: { select: { id: true, slug: true, title: true } },
          },
        },
      },
    });
    if (!edit) throw new NotFoundException('Edit not found');
    return edit;
  }

  async create(dto: CreateEditDto, actorId: string) {
    const base = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    const slug = await ensureUniqueSlug(base, async (cand) => {
      const exists = await this.prisma.edit.findUnique({ where: { slug: cand } });
      return !!exists;
    });
    const status = dto.status ?? EditStatus.DRAFT;
    const productIds = dto.productIds ?? [];
    await this.validateProductIds(productIds);

    const edit = await this.prisma.$transaction(async (tx) => {
      if (dto.isFeaturedOnHome) {
        await tx.edit.updateMany({
          where: { isFeaturedOnHome: true },
          data: { isFeaturedOnHome: false },
        });
      }
      return tx.edit.create({
        data: {
          slug,
          title: dto.title,
          heroUrl: dto.heroUrl,
          description: dto.description,
          status,
          isFeaturedOnHome: dto.isFeaturedOnHome ?? false,
          publishedAt: status === EditStatus.PUBLISHED ? new Date() : null,
          editProducts: {
            create: productIds.map((productId, idx) => ({ productId, position: idx })),
          },
        },
      });
    });
    await this.audit.record({
      actorId,
      action: 'edit.create',
      targetType: 'edit',
      targetId: edit.id,
      metadata: { slug: edit.slug },
    });
    return edit;
  }

  async update(id: string, dto: UpdateEditDto, actorId: string) {
    const existing = await this.prisma.edit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Edit not found');

    let nextSlug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      nextSlug = await ensureUniqueSlug(slugify(dto.slug), async (cand) => {
        const conflict = await this.prisma.edit.findUnique({
          where: { slug: cand },
        });
        return !!conflict && conflict.id !== id;
      });
    }
    const nextStatus = dto.status ?? existing.status;
    const publishedAt =
      nextStatus === EditStatus.PUBLISHED &&
      existing.status !== EditStatus.PUBLISHED
        ? new Date()
        : existing.publishedAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isFeaturedOnHome) {
        await tx.edit.updateMany({
          where: { isFeaturedOnHome: true, id: { not: id } },
          data: { isFeaturedOnHome: false },
        });
      }
      if (dto.productIds) {
        await this.validateProductIds(dto.productIds);
        await tx.editProduct.deleteMany({ where: { editId: id } });
        if (dto.productIds.length > 0) {
          await tx.editProduct.createMany({
            data: dto.productIds.map((productId, idx) => ({
              editId: id,
              productId,
              position: idx,
            })),
          });
        }
      }
      return tx.edit.update({
        where: { id },
        data: {
          slug: nextSlug,
          title: dto.title ?? undefined,
          heroUrl: dto.heroUrl ?? undefined,
          description: dto.description ?? undefined,
          status: nextStatus,
          isFeaturedOnHome: dto.isFeaturedOnHome ?? undefined,
          publishedAt,
        },
      });
    });
    await this.audit.record({
      actorId,
      action: 'edit.update',
      targetType: 'edit',
      targetId: id,
    });
    return updated;
  }

  async archive(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.edit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Edit not found');
    await this.prisma.edit.update({
      where: { id },
      data: { status: EditStatus.ARCHIVED, isFeaturedOnHome: false },
    });
    await this.audit.record({
      actorId,
      action: 'edit.archive',
      targetType: 'edit',
      targetId: id,
    });
  }

  // ────────────────────────── PUBLIC ──────────────────────────

  async listPublic() {
    return this.prisma.edit.findMany({
      where: { status: EditStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        heroUrl: true,
        description: true,
        publishedAt: true,
        isFeaturedOnHome: true,
        _count: { select: { editProducts: true } },
      },
    });
  }

  async getPublicBySlug(slug: string) {
    const edit = await this.prisma.edit.findUnique({
      where: { slug },
      include: {
        editProducts: {
          orderBy: { position: 'asc' },
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
    });
    if (!edit || edit.status !== EditStatus.PUBLISHED) {
      throw new NotFoundException('Edit not found');
    }

    const products = await Promise.all(
      edit.editProducts.map(async (ep) => {
        const p = ep.product;
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
              sourcePageUrl: `/edits/${edit.slug}`,
            })
          : null;
        const img = p.images[0] ?? null;
        return {
          slug: p.slug,
          title: p.title,
          brand: p.brand,
          price: Number(p.price),
          mrp: p.mrp ? Number(p.mrp) : null,
          discountPct: p.discountPct ? Number(p.discountPct) : null,
          currency: p.currency,
          primaryImage: img
            ? { url: img.url, altText: img.altText, isAiGenerated: img.isAiGenerated }
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
        };
      }),
    );

    return {
      id: edit.id,
      slug: edit.slug,
      title: edit.title,
      heroUrl: edit.heroUrl,
      description: edit.description,
      publishedAt: edit.publishedAt,
      products,
    };
  }

  async getFeaturedForHome() {
    const featured = await this.prisma.edit.findFirst({
      where: { status: EditStatus.PUBLISHED, isFeaturedOnHome: true },
      include: { _count: { select: { editProducts: true } } },
    });
    if (!featured) return null;
    return {
      id: featured.id,
      slug: featured.slug,
      title: featured.title,
      heroUrl: featured.heroUrl,
      description: featured.description,
      productCount: featured._count.editProducts,
    };
  }

  private async validateProductIds(ids: string[]) {
    if (ids.length === 0) return;
    const found = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException('One or more productIds are invalid');
    }
  }
}
