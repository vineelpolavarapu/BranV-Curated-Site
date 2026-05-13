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
} satisfies Prisma.WishlistItemInclude;

type ItemWithIncludes = Prisma.WishlistItemGetPayload<{
  include: typeof itemInclude;
}>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent — re-adding the same product is a no-op (but keeps notify flag). */
  async add(input: {
    userId: string;
    productId: string;
    notifyOnPriceDrop?: boolean;
  }) {
    return this.prisma.wishlistItem.upsert({
      where: {
        userId_productId: {
          userId: input.userId,
          productId: input.productId,
        },
      },
      update: {
        ...(input.notifyOnPriceDrop !== undefined && {
          notifyOnPriceDrop: input.notifyOnPriceDrop,
        }),
      },
      create: {
        userId: input.userId,
        productId: input.productId,
        notifyOnPriceDrop: input.notifyOnPriceDrop ?? false,
      },
    });
  }

  async remove(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!existing) {
      // Idempotent: removing a missing item is a no-op success.
      return { removed: false };
    }
    await this.prisma.wishlistItem.delete({
      where: { userId_productId: { userId, productId } },
    });
    return { removed: true };
  }

  async setNotify(userId: string, productId: string, notify: boolean) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!existing) throw new NotFoundException('Wishlist item not found');
    return this.prisma.wishlistItem.update({
      where: { userId_productId: { userId, productId } },
      data: { notifyOnPriceDrop: notify },
    });
  }

  async listForUser(userId: string, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.wishlistItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: itemInclude,
      }),
      this.prisma.wishlistItem.count({ where: { userId } }),
    ]);
    return {
      items: items.map((i) => this.shape(i)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /** Lightweight: just the product IDs — used by the web to seed heart state. */
  async listIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  }

  private shape(item: ItemWithIncludes) {
    const img = item.product.images[0] ?? null;
    return {
      id: item.id,
      productId: item.productId,
      notifyOnPriceDrop: item.notifyOnPriceDrop,
      createdAt: item.createdAt,
      product: {
        id: item.product.id,
        slug: item.product.slug,
        title: item.product.title,
        price: Number(item.product.price),
        mrp: item.product.mrp ? Number(item.product.mrp) : null,
        discountPct: item.product.discountPct
          ? Number(item.product.discountPct)
          : null,
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
