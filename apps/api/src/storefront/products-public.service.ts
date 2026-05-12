import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClicksService } from '../clicks/clicks.service';
import { makePage, PageResult } from '../common/dto/pagination.dto';
import { ProductListQueryDto, ProductSort } from './dto/storefront.dto';

const cardInclude = {
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  subcategory: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' as const } },
  variants: { orderBy: { createdAt: 'asc' as const } },
  retailerListings: {
    where: { availabilityStatus: 'IN_STOCK' as const },
    include: {
      affiliateLinks: {
        where: { pendingConversion: false },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.ProductInclude;

const NEW_ARRIVAL_DAYS = 30;

@Injectable()
export class ProductsPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clicks: ClicksService,
  ) {}

  async list(q: ProductListQueryDto): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 24;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
    };

    if (q.category) {
      where.OR = [
        { category: { slug: q.category } },
        { subcategory: { slug: q.category } },
      ];
    }
    if (q.brand?.length) {
      where.brand = { slug: { in: q.brand } };
    }
    if (q.color?.length) {
      where.variants = { some: { color: { in: q.color, mode: 'insensitive' } } };
    }
    if (q.size?.length) {
      where.variants = {
        ...(where.variants ?? {}),
        some: {
          ...(where.variants as Prisma.ProductVariantListRelationFilter)?.some,
          size: { in: q.size, mode: 'insensitive' },
        },
      };
    }
    if (q.retailer?.length) {
      where.retailerListings = {
        some: {
          retailer: { in: q.retailer },
          availabilityStatus: 'IN_STOCK',
        },
      };
    }
    if (q.material) {
      where.tags = { has: q.material.toLowerCase() };
    }
    if (q.minPrice !== undefined) {
      where.price = { ...(where.price as object), gte: q.minPrice };
    }
    if (q.maxPrice !== undefined) {
      where.price = { ...(where.price as object), lte: q.maxPrice };
    }
    if (q.inStock) {
      where.retailerListings = {
        ...(where.retailerListings ?? {}),
        some: {
          ...(where.retailerListings as Prisma.ProductRetailerListingListRelationFilter)?.some,
          availabilityStatus: 'IN_STOCK',
        },
      };
    }
    if (q.onSale) {
      where.discountPct = { gt: 0 };
    }
    if (q.discount && q.discount > 0) {
      where.discountPct = {
        ...(where.discountPct as object),
        gte: q.discount,
      };
    }
    if (q.isNew) {
      const cutoff = new Date(
        Date.now() - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000,
      );
      where.createdAt = { gte: cutoff };
    }

    // Sort
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [];
    switch (q.sort) {
      case ProductSort.NEWEST:
        orderBy.push({ createdAt: 'desc' });
        break;
      case ProductSort.PRICE_ASC:
        orderBy.push({ price: 'asc' });
        break;
      case ProductSort.PRICE_DESC:
        orderBy.push({ price: 'desc' });
        break;
      case ProductSort.BEST_RATED:
      case ProductSort.POPULAR:
        // Phase 5/8 wire actual review/click counts; for now newest as a fallback.
        orderBy.push({ createdAt: 'desc' });
        break;
      case ProductSort.RELEVANCE:
      default:
        // Without an explicit search we still need a stable order.
        orderBy.push({ createdAt: 'desc' });
        break;
    }

    // Full-text search via the search_vector column (raw filter — Prisma doesn't
    // model tsvector). When `search` is present we route through a different
    // path that uses $queryRaw so we can rank by relevance.
    if (q.search?.trim()) {
      return this.searchedList(q.search.trim(), where, page, pageSize);
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: cardInclude,
      }),
    ]);
    return makePage(await this.shape(data), total, page, pageSize);
  }

  private async searchedList(
    q: string,
    where: Prisma.ProductWhereInput,
    page: number,
    pageSize: number,
  ): Promise<PageResult<unknown>> {
    // Find matching IDs first via raw FTS + trigram fallback, then load
    // products through Prisma so we still get full relational include.
    const idRows = await this.prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT id,
             GREATEST(
               ts_rank(search_vector, plainto_tsquery('simple', ${q})),
               similarity(title, ${q})
             ) AS rank
      FROM products
      WHERE (search_vector @@ plainto_tsquery('simple', ${q})
             OR title % ${q})
        AND status = 'ACTIVE'
      ORDER BY rank DESC, "createdAt" DESC
      LIMIT 500;
    `;

    const idsRanked = idRows.map((r) => r.id);
    if (idsRanked.length === 0) {
      return makePage([], 0, page, pageSize);
    }

    const idScope: Prisma.ProductWhereInput = { id: { in: idsRanked } };
    const finalWhere: Prisma.ProductWhereInput = { AND: [where, idScope] };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.product.count({ where: finalWhere }),
      this.prisma.product.findMany({
        where: finalWhere,
        include: cardInclude,
      }),
    ]);

    // Re-rank in JS to preserve FTS ordering.
    const order = new Map(idsRanked.map((id, idx) => [id, idx] as const));
    const sorted = [...data].sort(
      (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
    );
    const sliced = sorted.slice((page - 1) * pageSize, page * pageSize);
    return makePage(await this.shape(sliced), total, page, pageSize);
  }

  async getBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: cardInclude,
    });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }
    return this.shapeOne(product);
  }

  async related(slug: string, limit = 8) {
    const target = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        brandId: true,
        categoryId: true,
        price: true,
      },
    });
    if (!target) throw new NotFoundException('Product not found');

    const priceFloor = Number(target.price) * 0.6;
    const priceCeil = Number(target.price) * 1.5;

    // First pass: same category + price band, prefer same brand.
    const sameBrand = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        id: { not: target.id },
        brandId: target.brandId,
        categoryId: target.categoryId,
        price: { gte: priceFloor, lte: priceCeil },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: cardInclude,
    });

    if (sameBrand.length >= limit) return this.shape(sameBrand);

    const remaining = limit - sameBrand.length;
    const others = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        id: { not: target.id, notIn: sameBrand.map((p) => p.id) },
        categoryId: target.categoryId,
        price: { gte: priceFloor, lte: priceCeil },
      },
      orderBy: { createdAt: 'desc' },
      take: remaining,
      include: cardInclude,
    });
    return this.shape([...sameBrand, ...others]);
  }

  // ────────────────── Shape: hide noisy internal fields ──────────────────

  private shape(products: ProductWithIncludes[]) {
    return Promise.all(products.map((p) => this.shapeOne(p)));
  }

  private async shapeOne(p: ProductWithIncludes) {
    const aiImages = p.images.filter((i) => i.isAiGenerated);
    const retailerImages = p.images.filter((i) => !i.isAiGenerated);
    const primary = p.images.find((i) => i.isPrimary) ?? p.images[0] ?? null;
    const secondary =
      retailerImages.find((i) => !i.isPrimary) ?? retailerImages[0] ?? null;

    // Best price + best retailer (lowest active raw_price among IN_STOCK).
    const listings = p.retailerListings ?? [];
    const sortedListings = [...listings].sort((a, b) => {
      const aP = a.rawPrice ? Number(a.rawPrice) : Number(p.price);
      const bP = b.rawPrice ? Number(b.rawPrice) : Number(p.price);
      return aP - bP;
    });
    const bestListing = sortedListings[0] ?? null;
    const affiliate = bestListing?.affiliateLinks?.[0] ?? null;

    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      price: Number(p.price),
      mrp: p.mrp ? Number(p.mrp) : null,
      discountPct: p.discountPct ? Number(p.discountPct) : null,
      currency: p.currency,
      tags: p.tags,
      createdAt: p.createdAt,
      brand: p.brand,
      category: p.category,
      subcategory: p.subcategory,
      primaryImage: primary
        ? {
            url: primary.url,
            isAiGenerated: primary.isAiGenerated,
            altText: primary.altText,
          }
        : null,
      secondaryImage: secondary
        ? {
            url: secondary.url,
            isAiGenerated: secondary.isAiGenerated,
            altText: secondary.altText,
          }
        : null,
      gallery: p.images.map((i) => ({
        url: i.url,
        altText: i.altText,
        isAiGenerated: i.isAiGenerated,
        isPrimary: i.isPrimary,
        position: i.position,
      })),
      aiImageCount: aiImages.length,
      variants: p.variants.map((v) => ({
        id: v.id,
        color: v.color,
        size: v.size,
        attributes: v.attributes,
      })),
      sizes: Array.from(
        new Set(
          p.variants
            .map((v) => v.size)
            .filter((s): s is string => !!s),
        ),
      ),
      colors: Array.from(
        new Set(
          p.variants
            .map((v) => v.color)
            .filter((c): c is string => !!c),
        ),
      ),
      retailers: listings.map((l) => ({
        retailer: l.retailer,
        rawPrice: l.rawPrice ? Number(l.rawPrice) : null,
        availabilityStatus: l.availabilityStatus,
        affiliateUrl:
          l.affiliateLinks[0]?.convertedUrl ?? l.retailerProductUrl,
        affiliatePartner: l.affiliateLinks[0]?.partner ?? null,
        pending: l.affiliateLinks[0]?.pendingConversion ?? true,
      })),
      buyNow: bestListing
        ? {
            retailer: bestListing.retailer,
            url: affiliate?.convertedUrl ?? bestListing.retailerProductUrl,
            partner: affiliate?.partner ?? null,
            pending: affiliate?.pendingConversion ?? true,
            // Phase 5: short-lived click-tracking ID. Web prefixes with the API
            // host and renders <a href="{host}/go/{trackingId}">.
            trackingId: await this.clicks.mint({
              productId: p.id,
              retailer: bestListing.retailer,
              partner: affiliate?.partner ?? null,
              partnerUrl:
                affiliate?.convertedUrl ?? bestListing.retailerProductUrl,
            }),
          }
        : null,
    };
  }
}

type ProductWithIncludes = Prisma.ProductGetPayload<{
  include: typeof cardInclude;
}>;
