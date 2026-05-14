import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DropStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { ClicksService } from '../clicks/clicks.service';
import { ensureUniqueSlug, slugify } from '../common/utils/slug';
import { makePage, PageResult } from '../common/dto/pagination.dto';
import {
  CreateDropDto,
  DropListQueryDto,
  UpdateDropDto,
} from './dto/drop.dto';

@Injectable()
export class DropsService {
  private readonly logger = new Logger(DropsService.name);
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly clicks: ClicksService,
    config: ConfigService,
  ) {
    this.webOrigin =
      config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  }

  // ────────────────────────── ADMIN ──────────────────────────

  async listAdmin(q: DropListQueryDto): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 24;
    const where: Prisma.DropWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { slug: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.drop.count({ where }),
      this.prisma.drop.findMany({
        where,
        orderBy: [{ launchAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { dropProducts: true, notifySignups: true } },
        },
      }),
    ]);
    return makePage(data, total, page, pageSize);
  }

  async getAdminById(id: string) {
    const drop = await this.prisma.drop.findUnique({
      where: { id },
      include: {
        dropProducts: {
          orderBy: { position: 'asc' },
          include: {
            product: { select: { id: true, slug: true, title: true } },
          },
        },
        _count: { select: { notifySignups: true } },
      },
    });
    if (!drop) throw new NotFoundException('Drop not found');
    return drop;
  }

  async create(dto: CreateDropDto, actorId: string) {
    const base = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const slug = await ensureUniqueSlug(base, async (cand) => {
      const exists = await this.prisma.drop.findUnique({ where: { slug: cand } });
      return !!exists;
    });

    const launchAt = new Date(dto.launchAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.validateWindow(launchAt, endsAt);

    const status = this.deriveStatusForWrite(dto.status, launchAt, endsAt);
    const productIds = dto.productIds ?? [];
    await this.validateProductIds(productIds);

    const drop = await this.prisma.drop.create({
      data: {
        slug,
        name: dto.name,
        heroUrl: dto.heroUrl,
        description: dto.description,
        launchAt,
        endsAt,
        status,
        publishedAt: status === DropStatus.LIVE ? new Date() : null,
        dropProducts: {
          create: productIds.map((productId, idx) => ({ productId, position: idx })),
        },
      },
    });
    await this.audit.record({
      actorId,
      action: 'drop.create',
      targetType: 'drop',
      targetId: drop.id,
      metadata: { slug: drop.slug, status: drop.status },
    });
    return drop;
  }

  async update(id: string, dto: UpdateDropDto, actorId: string) {
    const existing = await this.prisma.drop.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Drop not found');

    let nextSlug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      nextSlug = await ensureUniqueSlug(slugify(dto.slug), async (cand) => {
        const conflict = await this.prisma.drop.findUnique({ where: { slug: cand } });
        return !!conflict && conflict.id !== id;
      });
    }

    const launchAt = dto.launchAt ? new Date(dto.launchAt) : existing.launchAt;
    const endsAt = dto.endsAt === undefined
      ? existing.endsAt
      : dto.endsAt
        ? new Date(dto.endsAt)
        : null;
    this.validateWindow(launchAt, endsAt);

    const status = this.deriveStatusForWrite(
      dto.status ?? existing.status,
      launchAt,
      endsAt,
      existing.status,
    );
    const publishedAt =
      status === DropStatus.LIVE && existing.status !== DropStatus.LIVE
        ? new Date()
        : existing.publishedAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.productIds) {
        await this.validateProductIds(dto.productIds);
        await tx.dropProduct.deleteMany({ where: { dropId: id } });
        if (dto.productIds.length > 0) {
          await tx.dropProduct.createMany({
            data: dto.productIds.map((productId, idx) => ({
              dropId: id,
              productId,
              position: idx,
            })),
          });
        }
      }
      return tx.drop.update({
        where: { id },
        data: {
          slug: nextSlug,
          name: dto.name ?? undefined,
          heroUrl: dto.heroUrl ?? undefined,
          description: dto.description ?? undefined,
          launchAt,
          endsAt,
          status,
          publishedAt,
        },
      });
    });

    await this.audit.record({
      actorId,
      action: 'drop.update',
      targetType: 'drop',
      targetId: id,
      metadata: { slug: updated.slug, status: updated.status },
    });
    return updated;
  }

  async archive(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.drop.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Drop not found');
    await this.prisma.drop.update({
      where: { id },
      data: { status: DropStatus.ARCHIVED },
    });
    await this.audit.record({
      actorId,
      action: 'drop.archive',
      targetType: 'drop',
      targetId: id,
    });
  }

  // ────────────────────────── SCHEDULER ──────────────────────────

  /** Flip SCHEDULED→LIVE at launchAt and LIVE→ENDED at endsAt. Returns counts. */
  async tickStatuses(): Promise<{ launched: number; ended: number }> {
    const now = new Date();
    const toLaunch = await this.prisma.drop.findMany({
      where: {
        status: DropStatus.SCHEDULED,
        launchAt: { lte: now },
      },
      select: { id: true, slug: true, name: true },
    });
    let launched = 0;
    if (toLaunch.length > 0) {
      await this.prisma.drop.updateMany({
        where: { id: { in: toLaunch.map((d) => d.id) } },
        data: { status: DropStatus.LIVE, publishedAt: now },
      });
      launched = toLaunch.length;
      // Fire pre-launch signup notifications for each freshly LIVE drop.
      for (const d of toLaunch) {
        await this.notifyPreLaunchSignups(d.id, d.slug, d.name);
        await this.audit.record({
          action: 'drop.auto_launch',
          targetType: 'drop',
          targetId: d.id,
          metadata: { slug: d.slug },
        });
      }
    }

    const toEnd = await this.prisma.drop.findMany({
      where: {
        status: DropStatus.LIVE,
        endsAt: { not: null, lte: now },
      },
      select: { id: true, slug: true },
    });
    let ended = 0;
    if (toEnd.length > 0) {
      await this.prisma.drop.updateMany({
        where: { id: { in: toEnd.map((d) => d.id) } },
        data: { status: DropStatus.ENDED },
      });
      ended = toEnd.length;
      for (const d of toEnd) {
        await this.audit.record({
          action: 'drop.auto_end',
          targetType: 'drop',
          targetId: d.id,
          metadata: { slug: d.slug },
        });
      }
    }
    return { launched, ended };
  }

  private async notifyPreLaunchSignups(
    dropId: string,
    slug: string,
    name: string,
  ) {
    const signups = await this.prisma.dropNotifySignup.findMany({
      where: { dropId, notifiedAt: null },
      select: { id: true, email: true },
    });
    if (signups.length === 0) return;
    const link = `${this.webOrigin}/drops/${slug}`;
    for (const s of signups) {
      try {
        await this.mail.send({
          to: s.email,
          subject: `“${name}” is live on BranV`,
          text: `The drop you signed up for is now live.\n\nShop here:\n${link}`,
        });
        await this.prisma.dropNotifySignup.update({
          where: { id: s.id },
          data: { notifiedAt: new Date() },
        });
      } catch (err) {
        this.logger.warn(
          `notify-me email failed for ${s.email}: ${(err as Error).message}`,
        );
      }
    }
  }

  // ────────────────────────── PUBLIC ──────────────────────────

  async listPublic() {
    const now = new Date();
    const [live, scheduled, ended] = await Promise.all([
      this.prisma.drop.findMany({
        where: { status: DropStatus.LIVE },
        orderBy: { launchAt: 'desc' },
        select: this.publicListSelect,
      }),
      this.prisma.drop.findMany({
        where: { status: DropStatus.SCHEDULED, launchAt: { gt: now } },
        orderBy: { launchAt: 'asc' },
        select: this.publicListSelect,
      }),
      this.prisma.drop.findMany({
        where: { status: DropStatus.ENDED },
        orderBy: { launchAt: 'desc' },
        take: 8,
        select: this.publicListSelect,
      }),
    ]);
    return { live, scheduled, ended };
  }

  async getPublicBySlug(slug: string) {
    const drop = await this.prisma.drop.findUnique({
      where: { slug },
      include: {
        dropProducts: {
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
    if (!drop || drop.status === DropStatus.ARCHIVED) {
      throw new NotFoundException('Drop not found');
    }

    const products = await Promise.all(
      drop.dropProducts.map(async (dp) => {
        const p = dp.product;
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
              sourcePageUrl: `/drops/${drop.slug}`,
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
            ? {
                url: img.url,
                altText: img.altText,
                isAiGenerated: img.isAiGenerated,
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
        };
      }),
    );

    return {
      id: drop.id,
      slug: drop.slug,
      name: drop.name,
      heroUrl: drop.heroUrl,
      description: drop.description,
      launchAt: drop.launchAt,
      endsAt: drop.endsAt,
      status: drop.status,
      publishedAt: drop.publishedAt,
      products,
    };
  }

  async addNotifySignup(slug: string, email: string, userId: string | null) {
    const drop = await this.prisma.drop.findUnique({ where: { slug } });
    if (!drop) throw new NotFoundException('Drop not found');
    if (drop.status !== DropStatus.SCHEDULED) {
      throw new BadRequestException(
        'Notify-me is only open while a drop is scheduled.',
      );
    }
    return this.prisma.dropNotifySignup.upsert({
      where: { dropId_email: { dropId: drop.id, email: email.toLowerCase().trim() } },
      update: { userId: userId ?? undefined },
      create: {
        dropId: drop.id,
        email: email.toLowerCase().trim(),
        userId: userId ?? null,
      },
    });
  }

  // ────────────────────────── helpers ──────────────────────────

  private readonly publicListSelect = {
    id: true,
    slug: true,
    name: true,
    heroUrl: true,
    description: true,
    launchAt: true,
    endsAt: true,
    status: true,
    publishedAt: true,
  } as const;

  private validateWindow(launchAt: Date, endsAt: Date | null) {
    if (endsAt && endsAt <= launchAt) {
      throw new BadRequestException('endsAt must be after launchAt');
    }
  }

  /**
   * Don't let admin save LIVE for a drop whose launchAt is in the future —
   * the scheduler will flip it at the right time. Conversely, an admin who
   * sets status=SCHEDULED on something whose launchAt has already passed
   * should be auto-promoted to LIVE on the next tick (no override here).
   */
  private deriveStatusForWrite(
    requested: DropStatus | undefined,
    launchAt: Date,
    endsAt: Date | null,
    fallback?: DropStatus,
  ): DropStatus {
    const status = requested ?? fallback ?? DropStatus.SCHEDULED;
    if (status === DropStatus.ARCHIVED) return status;
    const now = new Date();
    if (status === DropStatus.LIVE && launchAt > now) {
      return DropStatus.SCHEDULED;
    }
    if (endsAt && endsAt <= now) {
      // status is already narrowed to non-ARCHIVED above.
      return DropStatus.ENDED;
    }
    return status;
  }

  private async validateProductIds(ids: string[]): Promise<void> {
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
