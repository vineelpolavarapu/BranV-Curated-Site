import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Article, ArticleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClicksService } from '../clicks/clicks.service';
import { ensureUniqueSlug, slugify } from '../common/utils/slug';
import { makePage, PageResult } from '../common/dto/pagination.dto';
import {
  ArticleListQueryDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/article.dto';

// Extracts the product slug from `<div data-product="some-slug"></div>` markers
// that the markdown editor inserts. Tolerant of single/double quotes and
// optional self-closing.
const EMBED_REGEX = /<div[^>]*\sdata-product=["']([^"']+)["'][^>]*>(?:\s*<\/div>)?/gi;

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clicks: ClicksService,
  ) {}

  // ────────────────────────── ADMIN ──────────────────────────

  async listAdmin(q: ArticleListQueryDto): Promise<PageResult<Article>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.ArticleWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.tag) where.tags = { has: q.tag };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { slug: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          author: { select: { id: true, email: true } },
          _count: { select: { articleProducts: true } },
        },
      }),
    ]);
    return makePage(data, total, page, pageSize);
  }

  async getAdminById(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        articleProducts: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              select: { id: true, slug: true, title: true },
            },
          },
        },
        author: { select: { id: true, email: true } },
      },
    });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async create(dto: CreateArticleDto, authorId: string) {
    const base = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    const slug = await ensureUniqueSlug(base, async (cand) => {
      const exists = await this.prisma.article.findUnique({
        where: { slug: cand },
      });
      return !!exists;
    });

    const status = this.normalizeStatusForWrite(dto);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const publishedAt = status === ArticleStatus.PUBLISHED
      ? (dto.publishedAt ? new Date(dto.publishedAt) : new Date())
      : null;
    const bodyMd = dto.bodyMd ?? '';
    const readingMinutes = this.computeReadingMinutes(bodyMd);
    const embedSlugs = this.extractEmbedSlugs(bodyMd);

    const productIds = await this.resolveEmbedProductIds(embedSlugs);

    const article = await this.prisma.article.create({
      data: {
        slug,
        title: dto.title,
        heroUrl: dto.heroUrl,
        excerpt: dto.excerpt,
        bodyMd,
        status,
        scheduledAt,
        publishedAt,
        authorId,
        tags: dto.tags ?? [],
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        ogImage: dto.ogImage,
        readingMinutes,
        articleProducts: {
          create: productIds.map((productId, idx) => ({
            productId,
            position: idx,
          })),
        },
      },
    });
    await this.audit.record({
      actorId: authorId,
      action: 'article.create',
      targetType: 'article',
      targetId: article.id,
      metadata: { slug: article.slug, status: article.status },
    });
    return article;
  }

  async update(id: string, dto: UpdateArticleDto, actorId: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Article not found');

    let nextSlug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      nextSlug = await ensureUniqueSlug(slugify(dto.slug), async (cand) => {
        const conflict = await this.prisma.article.findUnique({
          where: { slug: cand },
        });
        return !!conflict && conflict.id !== id;
      });
    }

    const status = this.normalizeStatusForWrite(dto, existing.status);
    const scheduledAt = dto.scheduledAt === undefined
      ? existing.scheduledAt
      : dto.scheduledAt
        ? new Date(dto.scheduledAt)
        : null;
    const publishedAt = this.derivePublishedAt(
      status,
      existing.status,
      existing.publishedAt,
      dto.publishedAt,
    );
    const bodyMd = dto.bodyMd ?? existing.bodyMd;
    const readingMinutes = this.computeReadingMinutes(bodyMd);

    // Rebuild article_products to mirror the current embed set.
    const embedSlugs = this.extractEmbedSlugs(bodyMd);
    const productIds = await this.resolveEmbedProductIds(embedSlugs);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.articleProduct.deleteMany({ where: { articleId: id } });
      if (productIds.length > 0) {
        await tx.articleProduct.createMany({
          data: productIds.map((productId, idx) => ({
            articleId: id,
            productId,
            position: idx,
          })),
        });
      }
      return tx.article.update({
        where: { id },
        data: {
          slug: nextSlug,
          title: dto.title ?? undefined,
          heroUrl: dto.heroUrl ?? undefined,
          excerpt: dto.excerpt ?? undefined,
          bodyMd,
          status,
          scheduledAt,
          publishedAt,
          tags: dto.tags ?? undefined,
          metaTitle: dto.metaTitle ?? undefined,
          metaDescription: dto.metaDescription ?? undefined,
          ogImage: dto.ogImage ?? undefined,
          readingMinutes,
        },
      });
    });

    await this.audit.record({
      actorId,
      action: 'article.update',
      targetType: 'article',
      targetId: id,
      metadata: { slug: updated.slug, status: updated.status },
    });
    return updated;
  }

  async archive(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Article not found');
    await this.prisma.article.update({
      where: { id },
      data: { status: ArticleStatus.ARCHIVED },
    });
    await this.audit.record({
      actorId,
      action: 'article.archive',
      targetType: 'article',
      targetId: id,
    });
  }

  // ────────────────────────── SCHEDULER ──────────────────────────

  /** Flips SCHEDULED → PUBLISHED for any articles whose scheduledAt has passed. */
  async publishDueScheduled(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.article.findMany({
      where: {
        status: ArticleStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
      select: { id: true, slug: true },
    });
    if (due.length === 0) return 0;
    await this.prisma.article.updateMany({
      where: { id: { in: due.map((a) => a.id) } },
      data: { status: ArticleStatus.PUBLISHED, publishedAt: now },
    });
    for (const a of due) {
      await this.audit.record({
        action: 'article.auto_publish',
        targetType: 'article',
        targetId: a.id,
        metadata: { slug: a.slug },
      });
    }
    this.logger.log(`Auto-published ${due.length} scheduled article(s)`);
    return due.length;
  }

  // ────────────────────────── PUBLIC ──────────────────────────

  async listPublic(q: ArticleListQueryDto): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 12;
    const where: Prisma.ArticleWhereInput = {
      status: ArticleStatus.PUBLISHED,
    };
    if (q.tag) where.tags = { has: q.tag };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { excerpt: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroUrl: true,
          tags: true,
          publishedAt: true,
          readingMinutes: true,
        },
      }),
    ]);
    return makePage(data, total, page, pageSize);
  }

  async getPublicBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        articleProducts: {
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
    if (!article || article.status !== ArticleStatus.PUBLISHED) {
      throw new NotFoundException('Article not found');
    }

    // Build the embedded-products payload keyed by slug so the renderer can
    // replace each `<div data-product="...">` marker with a card.
    const embeddedProducts = await Promise.all(
      article.articleProducts.map(async (ap) => {
        const p = ap.product;
        const bestListing = p.retailerListings[0] ?? null;
        const affiliate = bestListing?.affiliateLinks[0] ?? null;
        const partnerUrl =
          affiliate?.convertedUrl ?? bestListing?.retailerProductUrl ?? null;
        const trackingId = bestListing && partnerUrl
          ? await this.clicks.mint({
              productId: p.id,
              retailer: bestListing.retailer,
              partner: affiliate?.partner ?? null,
              partnerUrl,
              sourcePageUrl: `/articles/${article.slug}`,
            })
          : null;
        const primary = p.images[0] ?? null;
        return {
          slug: p.slug,
          title: p.title,
          brand: p.brand,
          price: Number(p.price),
          mrp: p.mrp ? Number(p.mrp) : null,
          discountPct: p.discountPct ? Number(p.discountPct) : null,
          currency: p.currency,
          primaryImage: primary
            ? {
                url: primary.url,
                altText: primary.altText,
                isAiGenerated: primary.isAiGenerated,
              }
            : null,
          buyNow: bestListing
            ? {
                retailer: bestListing.retailer,
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
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      heroUrl: article.heroUrl,
      bodyMd: article.bodyMd,
      tags: article.tags,
      publishedAt: article.publishedAt,
      readingMinutes: article.readingMinutes,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      ogImage: article.ogImage,
      embeddedProducts,
    };
  }

  async listRelated(slug: string, limit = 3) {
    const target = await this.prisma.article.findUnique({
      where: { slug },
      select: { id: true, tags: true },
    });
    if (!target) return [];
    if (target.tags.length === 0) {
      return this.prisma.article.findMany({
        where: { status: ArticleStatus.PUBLISHED, slug: { not: slug } },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        select: this.publicListSelect,
      });
    }
    return this.prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        slug: { not: slug },
        tags: { hasSome: target.tags },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: this.publicListSelect,
    });
  }

  private readonly publicListSelect = {
    id: true,
    slug: true,
    title: true,
    excerpt: true,
    heroUrl: true,
    tags: true,
    publishedAt: true,
    readingMinutes: true,
  } as const;

  // ──────────────────────── helpers ────────────────────────

  /**
   * If admin set status=PUBLISHED but provided scheduledAt in the future,
   * downgrade to SCHEDULED — protects against accidental immediate publishes
   * when the editor leaves both fields set.
   */
  private normalizeStatusForWrite(
    dto: CreateArticleDto | UpdateArticleDto,
    fallback?: ArticleStatus,
  ): ArticleStatus {
    const requested = dto.status ?? fallback ?? ArticleStatus.DRAFT;
    if (
      requested === ArticleStatus.PUBLISHED &&
      dto.scheduledAt &&
      new Date(dto.scheduledAt) > new Date()
    ) {
      return ArticleStatus.SCHEDULED;
    }
    return requested;
  }

  private derivePublishedAt(
    nextStatus: ArticleStatus,
    prevStatus: ArticleStatus,
    prevPublishedAt: Date | null,
    overrideIso: string | undefined,
  ): Date | null {
    if (nextStatus !== ArticleStatus.PUBLISHED) {
      return prevStatus === ArticleStatus.PUBLISHED && nextStatus === ArticleStatus.ARCHIVED
        ? prevPublishedAt
        : null;
    }
    if (overrideIso) return new Date(overrideIso);
    if (prevStatus === ArticleStatus.PUBLISHED && prevPublishedAt) {
      return prevPublishedAt;
    }
    return new Date();
  }

  /** Crude word count → minutes at the 225 wpm standard, floored to 1. */
  private computeReadingMinutes(bodyMd: string): number {
    if (!bodyMd.trim()) return 1;
    const text = bodyMd
      .replace(/<[^>]+>/g, ' ') // strip embed markers + raw HTML
      .replace(/[#*_>`~\-+]/g, ' ') // strip basic markdown syntax
      .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' '); // strip links / images
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 225));
  }

  private extractEmbedSlugs(bodyMd: string): string[] {
    const slugs = new Set<string>();
    EMBED_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EMBED_REGEX.exec(bodyMd)) !== null) {
      if (match[1]) slugs.add(match[1]);
    }
    return [...slugs];
  }

  private async resolveEmbedProductIds(slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    const bySlug = new Map(products.map((p) => [p.slug, p.id]));
    const missing = slugs.filter((s) => !bySlug.has(s));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown product slug(s) in embeds: ${missing.join(', ')}`,
      );
    }
    // Preserve the order of first appearance in the body.
    return slugs.map((s) => bySlug.get(s)!);
  }
}
