import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { makePage, PageResult } from '../common/dto/pagination.dto';
import {
  AdminReviewsListQueryDto,
  CreateReviewDto,
  ModerateReviewDto,
  ReviewsListQueryDto,
} from './dto/review.dto';

const memberReviewSelect = {
  id: true,
  productId: true,
  userId: true,
  rating: true,
  title: true,
  body: true,
  imagesJson: true,
  status: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ReviewSelect;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ────────────────────────── PUBLIC ──────────────────────────

  async listForProduct(
    productId: string,
    q: ReviewsListQueryDto,
  ): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 12;
    const where: Prisma.ReviewWhereInput = {
      productId,
      status: ReviewStatus.PUBLISHED,
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: memberReviewSelect,
      }),
    ]);
    return makePage(data.map(this.shape), total, page, pageSize);
  }

  /**
   * Is the requesting member allowed to review this product? Returns the
   * shape the frontend needs to render the right UI: own review, eligibility,
   * etc.
   */
  async getReviewability(productId: string, userId: string) {
    const [wardrobe, ownReview] = await Promise.all([
      this.prisma.wardrobeItem.findUnique({
        where: { userId_productId: { userId, productId } },
      }),
      this.prisma.review.findUnique({
        where: { productId_userId: { productId, userId } },
        select: memberReviewSelect,
      }),
    ]);
    return {
      canReview: !!wardrobe && !wardrobe.removedAt && !ownReview,
      hasWardrobeItem: !!wardrobe && !wardrobe.removedAt,
      ownReview: ownReview ? this.shape(ownReview) : null,
    };
  }

  // ────────────────────────── MEMBER ──────────────────────────

  /**
   * BUILD_GUIDE §8.1 step 1: refuse a review unless the member has a
   * wardrobe_items row (i.e. self-reported having bought this product).
   */
  async create(productId: string, userId: string, dto: CreateReviewDto) {
    const wardrobe = await this.prisma.wardrobeItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!wardrobe || wardrobe.removedAt) {
      throw new ForbiddenException(
        'Only members who own this product can leave a review.',
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    try {
      const review = await this.prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: {
            productId,
            userId,
            rating: dto.rating,
            title: dto.title,
            body: dto.body,
            imagesJson: dto.imageUrls
              ? (dto.imageUrls as Prisma.InputJsonValue)
              : undefined,
          },
          select: memberReviewSelect,
        });
        await this.recomputeAggregate(productId, tx);
        return created;
      });
      await this.audit.record({
        actorId: userId,
        action: 'review.create',
        targetType: 'review',
        targetId: review.id,
        metadata: { productId, rating: review.rating },
      });
      return this.shape(review);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('You already reviewed this product.');
      }
      throw err;
    }
  }

  // ────────────────────────── ADMIN ──────────────────────────

  async listAdmin(q: AdminReviewsListQueryDto): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.ReviewWhereInput = {};
    if (q.status) where.status = q.status;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ...memberReviewSelect,
          moderationReason: true,
          moderatedAt: true,
          product: {
            select: { id: true, slug: true, title: true },
          },
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);
    return makePage(data, total, page, pageSize);
  }

  async moderate(id: string, dto: ModerateReviewDto, actorId: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    if (dto.status === ReviewStatus.HIDDEN && !dto.reason) {
      throw new BadRequestException('Hiding a review requires a reason.');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id },
        data: {
          status: dto.status,
          moderationReason: dto.reason ?? null,
          moderatedById: actorId,
          moderatedAt: new Date(),
        },
      });
      await this.recomputeAggregate(updated.productId, tx);
      return updated;
    });
    await this.audit.record({
      actorId,
      action:
        dto.status === ReviewStatus.HIDDEN ? 'review.hide' : 'review.restore',
      targetType: 'review',
      targetId: id,
      metadata: {
        productId: review.productId,
        reason: dto.reason ?? null,
      },
    });
    return review;
  }

  // ────────────────────────── helpers ──────────────────────────

  private async recomputeAggregate(
    productId: string,
    tx: Prisma.TransactionClient,
  ) {
    const agg = await tx.review.aggregate({
      where: { productId, status: ReviewStatus.PUBLISHED },
      _count: { _all: true },
      _avg: { rating: true },
    });
    const reviewCount = agg._count._all;
    const avgRating = agg._avg.rating ?? null;
    await tx.product.update({
      where: { id: productId },
      data: {
        reviewCount,
        avgRating: avgRating !== null
          ? new Prisma.Decimal(avgRating).toDecimalPlaces(2)
          : null,
      },
    });
  }

  private shape(r: Prisma.ReviewGetPayload<{ select: typeof memberReviewSelect }>) {
    const name =
      [r.user?.profile?.firstName, r.user?.profile?.lastName]
        .filter(Boolean)
        .join(' ') || 'Member';
    return {
      id: r.id,
      productId: r.productId,
      rating: r.rating,
      title: r.title,
      body: r.body,
      images: Array.isArray(r.imagesJson) ? (r.imagesJson as string[]) : [],
      status: r.status,
      createdAt: r.createdAt,
      author: { id: r.userId, displayName: name },
    };
  }
}
