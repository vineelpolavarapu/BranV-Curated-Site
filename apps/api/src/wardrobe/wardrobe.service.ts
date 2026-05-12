import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const itemInclude = {
  product: {
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      images: {
        where: { isPrimary: true },
        orderBy: { position: 'asc' as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.WardrobeItemInclude;

type ItemWithIncludes = Prisma.WardrobeItemGetPayload<{
  include: typeof itemInclude;
}>;

export interface WardrobeStats {
  totalItems: number;
  totalSpend: number;
  favoriteBrand: { name: string; slug: string; count: number } | null;
}

@Injectable()
export class WardrobeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent: `(userId, productId)` is unique, so re-purchasing the same
   * product just refreshes the click linkage and self-reported metadata.
   */
  async addFromClick(input: {
    userId: string;
    productId: string;
    retailer: string;
    clickEventId: string;
  }) {
    return this.prisma.wardrobeItem.upsert({
      where: {
        userId_productId: {
          userId: input.userId,
          productId: input.productId,
        },
      },
      update: {
        retailer: input.retailer,
        clickEventId: input.clickEventId,
        removedAt: null,
      },
      create: {
        userId: input.userId,
        productId: input.productId,
        retailer: input.retailer,
        clickEventId: input.clickEventId,
      },
    });
  }

  async listForUser(userId: string, page: number, pageSize: number) {
    const [items, total, stats] = await Promise.all([
      this.prisma.wardrobeItem.findMany({
        where: { userId, removedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: itemInclude,
      }),
      this.prisma.wardrobeItem.count({
        where: { userId, removedAt: null },
      }),
      this.computeStats(userId),
    ]);
    return {
      items: items.map((i) => this.shape(i)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      stats,
    };
  }

  async remove(userId: string, itemId: string) {
    const item = await this.prisma.wardrobeItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.userId !== userId) {
      throw new NotFoundException('Wardrobe item not found');
    }
    // Soft-remove so the unique (userId, productId) constraint allows
    // re-adding later without a manual cleanup step.
    return this.prisma.wardrobeItem.update({
      where: { id: itemId },
      data: { removedAt: new Date() },
    });
  }

  private async computeStats(userId: string): Promise<WardrobeStats> {
    const items = await this.prisma.wardrobeItem.findMany({
      where: { userId, removedAt: null },
      select: {
        selfReportedPrice: true,
        product: {
          select: {
            price: true,
            brand: { select: { name: true, slug: true } },
          },
        },
      },
    });

    const totalSpend = items.reduce((acc, it) => {
      const p = it.selfReportedPrice
        ? Number(it.selfReportedPrice)
        : Number(it.product.price);
      return acc + p;
    }, 0);

    const counts = new Map<string, { name: string; slug: string; count: number }>();
    for (const it of items) {
      const b = it.product.brand;
      const cur = counts.get(b.slug) ?? { name: b.name, slug: b.slug, count: 0 };
      cur.count += 1;
      counts.set(b.slug, cur);
    }
    const favoriteBrand = [...counts.values()].sort(
      (a, b) => b.count - a.count,
    )[0] ?? null;

    return { totalItems: items.length, totalSpend, favoriteBrand };
  }

  private shape(item: ItemWithIncludes) {
    const img = item.product.images[0] ?? null;
    return {
      id: item.id,
      retailer: item.retailer,
      selfReportedPrice: item.selfReportedPrice
        ? Number(item.selfReportedPrice)
        : null,
      selfReportedDate: item.selfReportedDate,
      notes: item.notes,
      tags: item.tags,
      createdAt: item.createdAt,
      product: {
        id: item.product.id,
        slug: item.product.slug,
        title: item.product.title,
        price: Number(item.product.price),
        currency: item.product.currency,
        brand: item.product.brand,
        primaryImage: img
          ? {
              url: img.url,
              altText: img.altText,
              isAiGenerated: img.isAiGenerated,
            }
          : null,
      },
    };
  }
}
