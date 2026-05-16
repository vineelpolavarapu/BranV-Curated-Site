import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BrandStatus, Prisma, Product, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { ensureUniqueSlug, slugify } from '../common/utils/slug';
import { makePage, PageResult } from '../common/dto/pagination.dto';
import {
  CreateProductDto,
  ImageInput,
  ProductListQueryDto,
  RetailerListingInput,
  UpdateProductDto,
  VariantInput,
} from './dto/product.dto';
import { QuickAddDto } from './dto/quick-add.dto';

export const productInclude = {
  brand: true,
  category: true,
  subcategory: true,
  variants: { orderBy: { createdAt: 'asc' as const } },
  images: { orderBy: { position: 'asc' as const } },
  retailerListings: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly affiliate: AffiliateService,
  ) {}

  // ─────────────────────────────── QUICK ADD ───────────────────────────────

  /**
   * Atomic Quick Add: create (or reuse) brand, create product with one variant
   * per requested size, attach avatar + retailer images, create retailer
   * listing, and convert + store the affiliate link. Whole thing is a single
   * Prisma transaction; affiliate conversion is the only step allowed to soft-
   * fail (its result records `pendingConversion: true` for the worker).
   */
  async quickAdd(dto: QuickAddDto, actorId: string) {
    if (!dto.brandId && !dto.newBrandName) {
      throw new BadRequestException(
        'Provide either brandId or newBrandName',
      );
    }

    // 1. Pre-compute everything that doesn't need to be inside the tx.
    const conversion = await this.affiliate.convert(dto.rawUrl);

    const baseSlug = slugify(dto.title);
    const slug = await ensureUniqueSlug(baseSlug, async (cand) => {
      const exists = await this.prisma.product.findUnique({
        where: { slug: cand },
      });
      return !!exists;
    });

    const tags = [
      ...(dto.tags ?? []),
      ...(dto.material ? [dto.material.toLowerCase()] : []),
    ];

    const discountPct = this.computeDiscount(dto.price, dto.mrp ?? null);

    // Build variant matrix (one per size; sizeless → single variant).
    const sizes = (dto.sizes ?? []).filter(Boolean);
    const variantData: Prisma.ProductVariantCreateWithoutProductInput[] =
      sizes.length > 0
        ? sizes.map((size, idx) => ({
            color: dto.color,
            size,
            isDefault: idx === 0,
            attributes: dto.material
              ? ({ material: dto.material } as Prisma.InputJsonValue)
              : ({} as Prisma.InputJsonValue),
          }))
        : [
            {
              color: dto.color,
              isDefault: true,
              attributes: dto.material
                ? ({ material: dto.material } as Prisma.InputJsonValue)
                : ({} as Prisma.InputJsonValue),
            },
          ];

    // Build image set (avatar marked AI, retailer image as secondary).
    const images: Prisma.ProductImageCreateWithoutProductInput[] = [];
    if (dto.avatarImageUrl) {
      images.push({
        url: dto.avatarImageUrl,
        isPrimary: true,
        isAiGenerated: true,
        position: 0,
        altText: `${dto.title} — AI-rendered on Vineel`,
      });
    }
    if (dto.retailerImageUrl) {
      images.push({
        url: dto.retailerImageUrl,
        isPrimary: !dto.avatarImageUrl,
        isAiGenerated: false,
        position: dto.avatarImageUrl ? 1 : 0,
        altText: `${dto.title} — ${dto.retailer}`,
      });
    }

    // 2. Run the atomic write.
    const result = await this.prisma.$transaction(async (tx) => {
      // Resolve or create brand.
      let brandId = dto.brandId;
      if (!brandId && dto.newBrandName) {
        const brandSlug = await ensureUniqueSlug(
          slugify(dto.newBrandName),
          async (cand) => {
            const exists = await tx.brand.findUnique({
              where: { slug: cand },
            });
            return !!exists;
          },
        );
        const newBrand = await tx.brand.create({
          data: {
            name: dto.newBrandName,
            slug: brandSlug,
            status: BrandStatus.ACTIVE,
          },
        });
        brandId = newBrand.id;
      }

      const product = await tx.product.create({
        data: {
          slug,
          title: dto.title,
          description: dto.description,
          brandId: brandId!,
          categoryId: dto.categoryId,
          subcategoryId: dto.subcategoryId,
          price: dto.price,
          mrp: dto.mrp,
          discountPct,
          primaryRetailer: dto.retailer,
          status: dto.status ?? ProductStatus.DRAFT,
          tags,
          createdByAdminId: actorId,
          variants: { create: variantData },
          images: images.length ? { create: images } : undefined,
          retailerListings: {
            create: {
              retailer: dto.retailer,
              retailerProductUrl: dto.rawUrl,
              retailerImageUrl: dto.retailerImageUrl,
              rawPrice: dto.price,
            },
          },
        },
        include: {
          variants: true,
          images: true,
          retailerListings: true,
          brand: true,
          category: true,
        },
      });

      const listing = product.retailerListings[0];
      await tx.affiliateLink.create({
        data: {
          productRetailerListingId: listing.id,
          partner: conversion.partner,
          rawUrl: dto.rawUrl,
          convertedUrl: conversion.convertedUrl,
          partnerLinkId: conversion.partnerLinkId,
          pendingConversion: conversion.pendingConversion,
          lastError: conversion.error,
          lastValidatedAt: conversion.pendingConversion ? null : new Date(),
        },
      });

      return product;
    });

    await this.audit.record({
      actorId,
      action: 'product.quick_add',
      targetType: 'product',
      targetId: result.id,
      metadata: {
        retailer: dto.retailer,
        affiliatePending: conversion.pendingConversion,
        affiliatePartner: conversion.partner,
        sizes: sizes.length,
      },
    });

    return {
      product: result,
      affiliate: {
        partner: conversion.partner,
        pendingConversion: conversion.pendingConversion,
        source: conversion.source,
      },
    };
  }


  async list(q: ProductListQueryDto): Promise<PageResult<Product>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.ProductWhereInput = {};
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { slug: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.brandId) where.brandId = q.brandId;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.status) where.status = q.status;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          brand: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true, isAiGenerated: true },
          },
          _count: { select: { retailerListings: true, variants: true } },
        },
      }),
    ]);
    return makePage(data, total, page, pageSize);
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto, actorId: string) {
    const baseSlug = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    const slug = await ensureUniqueSlug(baseSlug, async (cand) => {
      const exists = await this.prisma.product.findUnique({
        where: { slug: cand },
      });
      return !!exists;
    });

    const discountPct = this.computeDiscount(dto.price, dto.mrp);
    const variants = this.normalizeVariants(dto.variants);
    const images = this.normalizeImages(dto.images);
    const listings = this.normalizeListings(dto.retailerListings);
    const featuredUntil = this.computeFeaturedUntil(dto.featureDays);

    const product = await this.prisma.product.create({
      data: {
        title: dto.title,
        slug,
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        description: dto.description,
        price: dto.price,
        mrp: dto.mrp,
        discountPct,
        primaryRetailer: dto.primaryRetailer,
        status: dto.status ?? ProductStatus.DRAFT,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        tags: dto.tags ?? [],
        featuredUntil,
        createdByAdminId: actorId,
        variants: variants.length ? { create: variants } : undefined,
        images: images.length ? { create: images } : undefined,
        retailerListings: listings.length
          ? { create: listings }
          : undefined,
      },
      include: productInclude,
    });

    await this.audit.record({
      actorId,
      action: 'product.create',
      targetType: 'product',
      targetId: product.id,
      metadata: { slug: product.slug, status: product.status },
    });
    return product;
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    let nextSlug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      nextSlug = await ensureUniqueSlug(slugify(dto.slug), async (cand) => {
        const conflict = await this.prisma.product.findUnique({
          where: { slug: cand },
        });
        return !!conflict && conflict.id !== id;
      });
    }

    const price = dto.price ?? Number(existing.price);
    const mrp = dto.mrp === undefined ? existing.mrp : dto.mrp;
    const discountPct = this.computeDiscount(price, mrp ? Number(mrp) : null);

    // Only touch featuredUntil when admin sent featureDays in this payload.
    // `undefined` = no change; null or 0 = clear; >0 = set N days ahead.
    const featuredUntilData =
      dto.featureDays === undefined
        ? undefined
        : this.computeFeaturedUntil(dto.featureDays);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        slug: nextSlug,
        brandId: dto.brandId ?? undefined,
        categoryId: dto.categoryId ?? undefined,
        subcategoryId: dto.subcategoryId ?? undefined,
        description: dto.description ?? undefined,
        price: dto.price ?? undefined,
        mrp: dto.mrp ?? undefined,
        discountPct,
        primaryRetailer: dto.primaryRetailer ?? undefined,
        status: dto.status ?? undefined,
        metaTitle: dto.metaTitle ?? undefined,
        metaDescription: dto.metaDescription ?? undefined,
        tags: dto.tags ?? undefined,
        featuredUntil: featuredUntilData,
      },
      include: productInclude,
    });
    await this.audit.record({
      actorId,
      action: 'product.update',
      targetType: 'product',
      targetId: id,
    });
    return product;
  }

  /**
   * Soft delete: archive instead of removing rows so click history references
   * stay intact (PRD §21 Key Constraints).
   */
  async delete(id: string, actorId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED, archivedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      action: 'product.archive',
      targetType: 'product',
      targetId: id,
    });
  }

  // ──────────── Sub-resources: images, variants, listings ────────────

  async addImage(productId: string, dto: ImageInput, actorId: string) {
    await this.ensureProductExists(productId);
    // If this is being set as primary, demote others first.
    if (dto.isPrimary) {
      await this.prisma.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    const image = await this.prisma.productImage.create({
      data: {
        productId,
        url: dto.url,
        altText: dto.altText,
        isPrimary: dto.isPrimary ?? false,
        isAiGenerated: dto.isAiGenerated ?? false,
        position: dto.position ?? 0,
      },
    });
    await this.audit.record({
      actorId,
      action: 'product.image.add',
      targetType: 'product',
      targetId: productId,
      metadata: { imageId: image.id, isAiGenerated: image.isAiGenerated },
    });
    return image;
  }

  async removeImage(productId: string, imageId: string, actorId: string) {
    await this.ensureProductExists(productId);
    await this.prisma.productImage.delete({ where: { id: imageId } });
    await this.audit.record({
      actorId,
      action: 'product.image.remove',
      targetType: 'product',
      targetId: productId,
      metadata: { imageId },
    });
  }

  async reorderImages(productId: string, ids: string[], actorId: string) {
    await this.ensureProductExists(productId);
    await this.prisma.$transaction(
      ids.map((id, idx) =>
        this.prisma.productImage.update({
          where: { id },
          data: { position: idx },
        }),
      ),
    );
    await this.audit.record({
      actorId,
      action: 'product.image.reorder',
      targetType: 'product',
      targetId: productId,
    });
  }

  async addVariant(productId: string, dto: VariantInput, actorId: string) {
    await this.ensureProductExists(productId);
    if (dto.isDefault) {
      await this.prisma.productVariant.updateMany({
        where: { productId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
        color: dto.color,
        size: dto.size,
        isDefault: dto.isDefault ?? false,
      },
    });
    await this.audit.record({
      actorId,
      action: 'product.variant.add',
      targetType: 'product',
      targetId: productId,
    });
    return variant;
  }

  async removeVariant(
    productId: string,
    variantId: string,
    actorId: string,
  ) {
    await this.ensureProductExists(productId);
    await this.prisma.productVariant.delete({ where: { id: variantId } });
    await this.audit.record({
      actorId,
      action: 'product.variant.remove',
      targetType: 'product',
      targetId: productId,
      metadata: { variantId },
    });
  }

  async addRetailerListing(
    productId: string,
    dto: RetailerListingInput,
    actorId: string,
  ) {
    await this.ensureProductExists(productId);
    const listing = await this.prisma.productRetailerListing.upsert({
      where: {
        productId_retailer: { productId, retailer: dto.retailer },
      },
      create: {
        productId,
        retailer: dto.retailer,
        retailerProductUrl: dto.retailerProductUrl,
        retailerImageUrl: dto.retailerImageUrl,
        rawPrice: dto.rawPrice,
        availabilityStatus: dto.availabilityStatus,
      },
      update: {
        retailerProductUrl: dto.retailerProductUrl,
        retailerImageUrl: dto.retailerImageUrl,
        rawPrice: dto.rawPrice,
        availabilityStatus: dto.availabilityStatus,
      },
    });
    await this.audit.record({
      actorId,
      action: 'product.listing.upsert',
      targetType: 'product',
      targetId: productId,
      metadata: { retailer: dto.retailer },
    });
    return listing;
  }

  async removeRetailerListing(
    productId: string,
    listingId: string,
    actorId: string,
  ) {
    await this.ensureProductExists(productId);
    await this.prisma.productRetailerListing.delete({
      where: { id: listingId },
    });
    await this.audit.record({
      actorId,
      action: 'product.listing.remove',
      targetType: 'product',
      targetId: productId,
      metadata: { listingId },
    });
  }

  // ──────────── helpers ────────────

  private async ensureProductExists(id: string): Promise<void> {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Product not found');
  }

  private computeDiscount(
    price: number,
    mrp: number | null | undefined,
  ): number | null {
    if (!mrp || mrp <= 0 || price >= mrp) return null;
    return Number(((1 - price / mrp) * 100).toFixed(2));
  }

  private computeFeaturedUntil(
    days: number | null | undefined,
  ): Date | null {
    if (!days || days <= 0) return null;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private normalizeVariants(input?: VariantInput[]) {
    if (!input) return [] as Array<Prisma.ProductVariantCreateWithoutProductInput>;
    let defaultSeen = false;
    return input.map((v) => {
      const isDefault = v.isDefault && !defaultSeen;
      if (isDefault) defaultSeen = true;
      return {
        sku: v.sku,
        attributes: (v.attributes ?? {}) as Prisma.InputJsonValue,
        color: v.color,
        size: v.size,
        isDefault,
      };
    });
  }

  private normalizeImages(input?: ImageInput[]) {
    if (!input) return [] as Array<Prisma.ProductImageCreateWithoutProductInput>;
    let primarySeen = false;
    return input.map((img, idx) => {
      const isPrimary = img.isPrimary && !primarySeen;
      if (isPrimary) primarySeen = true;
      return {
        url: img.url,
        altText: img.altText,
        isPrimary,
        isAiGenerated: img.isAiGenerated ?? false,
        position: img.position ?? idx,
      };
    });
  }

  private normalizeListings(input?: RetailerListingInput[]) {
    if (!input)
      return [] as Array<Prisma.ProductRetailerListingCreateWithoutProductInput>;
    return input.map((l) => ({
      retailer: l.retailer,
      retailerProductUrl: l.retailerProductUrl,
      retailerImageUrl: l.retailerImageUrl,
      rawPrice: l.rawPrice,
      availabilityStatus: l.availabilityStatus,
    }));
  }
}
