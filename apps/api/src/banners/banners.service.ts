import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HomeBannerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listAdmin() {
    return this.prisma.homeBanner.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: string) {
    const banner = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  async create(dto: CreateBannerDto, actorId: string) {
    this.validateWindow(dto);
    const banner = await this.prisma.homeBanner.create({
      data: {
        imageUrl: dto.imageUrl,
        headline: dto.headline,
        ctaLabel: dto.ctaLabel,
        ctaLink: dto.ctaLink,
        displayOrder: dto.displayOrder ?? 0,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: dto.status ?? HomeBannerStatus.ACTIVE,
      },
    });
    await this.audit.record({
      actorId,
      action: 'banner.create',
      targetType: 'home_banner',
      targetId: banner.id,
    });
    return banner;
  }

  async update(id: string, dto: UpdateBannerDto, actorId: string) {
    const existing = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    this.validateWindow(dto);
    const banner = await this.prisma.homeBanner.update({
      where: { id },
      data: {
        imageUrl: dto.imageUrl ?? undefined,
        headline: dto.headline ?? undefined,
        ctaLabel: dto.ctaLabel ?? undefined,
        ctaLink: dto.ctaLink ?? undefined,
        displayOrder: dto.displayOrder ?? undefined,
        startsAt: dto.startsAt === undefined
          ? undefined
          : dto.startsAt
            ? new Date(dto.startsAt)
            : null,
        endsAt: dto.endsAt === undefined
          ? undefined
          : dto.endsAt
            ? new Date(dto.endsAt)
            : null,
        status: dto.status ?? undefined,
      },
    });
    await this.audit.record({
      actorId,
      action: 'banner.update',
      targetType: 'home_banner',
      targetId: id,
    });
    return banner;
  }

  async delete(id: string, actorId: string) {
    const existing = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    await this.prisma.homeBanner.delete({ where: { id } });
    await this.audit.record({
      actorId,
      action: 'banner.delete',
      targetType: 'home_banner',
      targetId: id,
    });
  }

  /** Active banners for the storefront — filtered to the current window. */
  async listActiveForHome() {
    const now = new Date();
    return this.prisma.homeBanner.findMany({
      where: {
        status: HomeBannerStatus.ACTIVE,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private validateWindow(dto: { startsAt?: string | null; endsAt?: string | null }) {
    if (dto.startsAt && dto.endsAt) {
      const start = new Date(dto.startsAt);
      const end = new Date(dto.endsAt);
      if (end <= start) {
        throw new BadRequestException('endsAt must be after startsAt');
      }
    }
  }
}
