import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { nanoid } from 'nanoid';
import { ClickReportOutcome, AffiliatePartner } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WardrobeService } from '../wardrobe/wardrobe.service';

interface TrackPayload {
  productId: string;
  retailer: string;
  partner: AffiliatePartner | null;
  partnerUrl: string;
  sourcePageUrl?: string;
}

interface RedirectContext {
  userId?: string | null;
  sessionId?: string | null;
  userAgent?: string | null;
  ipCountry?: string | null;
  utm?: Record<string, string> | null;
}

const TRACK_TTL_SECONDS = 60 * 60; // 1 hour — long enough for slow page reads.

@Injectable()
export class ClicksService {
  private readonly logger = new Logger(ClicksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wardrobe: WardrobeService,
  ) {}

  /**
   * Resolve the affiliate URL for a (productId, retailer) pair and stash a
   * short-lived intent under a fresh trackingId. The /go endpoint later
   * consumes the intent and writes the ClickEvent.
   */
  async mintFromProduct(
    productId: string,
    retailer: string,
    sourcePageUrl?: string,
  ): Promise<string | null> {
    const listing = await this.prisma.productRetailerListing.findFirst({
      where: { productId, retailer, availabilityStatus: 'IN_STOCK' },
      include: {
        affiliateLinks: {
          where: { pendingConversion: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!listing) return null;
    const affiliate = listing.affiliateLinks[0] ?? null;
    const partnerUrl = affiliate?.convertedUrl ?? listing.retailerProductUrl;
    return this.mint({
      productId,
      retailer,
      partner: affiliate?.partner ?? null,
      partnerUrl,
      sourcePageUrl,
    });
  }

  async mint(payload: TrackPayload): Promise<string> {
    const trackingId = nanoid(16);
    await this.prisma.clickIntent.create({
      data: {
        trackingId,
        productId: payload.productId,
        retailer: payload.retailer,
        partner: payload.partner,
        partnerUrl: payload.partnerUrl,
        sourcePageUrl: payload.sourcePageUrl ?? null,
        expiresAt: new Date(Date.now() + TRACK_TTL_SECONDS * 1000),
      },
    });
    return trackingId;
  }

  /**
   * Consume a tracking intent: insert the ClickEvent row and return the
   * affiliate URL to 302 to. Tracking ID is single-use; we delete it to keep
   * the intent table small.
   */
  async redirect(
    trackingId: string,
    ctx: RedirectContext,
  ): Promise<string> {
    const intent = await this.prisma.clickIntent.findUnique({
      where: { trackingId },
    });
    if (!intent || intent.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Tracking link expired or invalid');
    }

    try {
      await this.prisma.clickEvent.create({
        data: {
          trackingId,
          productId: intent.productId,
          retailer: intent.retailer,
          partner: intent.partner,
          partnerUrl: intent.partnerUrl,
          sourcePageUrl: intent.sourcePageUrl,
          userId: ctx.userId ?? null,
          sessionId: ctx.sessionId ?? null,
          userAgent: ctx.userAgent ?? null,
          ipCountry: ctx.ipCountry ?? null,
          utm: ctx.utm ?? undefined,
        },
      });
    } catch (err) {
      // Logging only — never block the redirect on an analytics write.
      this.logger.error(`ClickEvent insert failed for ${trackingId}`, err);
    }

    await this.prisma.clickIntent
      .delete({ where: { trackingId } })
      .catch(() => undefined);
    return intent.partnerUrl;
  }

  async report(
    trackingId: string,
    outcome: ClickReportOutcome,
    userId?: string | null,
  ) {
    const event = await this.prisma.clickEvent.findUnique({
      where: { trackingId },
      select: { id: true, productId: true, retailer: true },
    });
    if (!event) {
      throw new NotFoundException('Click event not found');
    }
    const conversion = await this.prisma.selfReportedConversion.create({
      data: {
        clickEventId: event.id,
        userId: userId ?? null,
        outcome,
      },
    });
    if (outcome === 'PURCHASED' && userId) {
      // Auto-save to the user's wardrobe (BUILD_GUIDE §5.2 step 4).
      await this.wardrobe.addFromClick({
        userId,
        productId: event.productId,
        retailer: event.retailer,
        clickEventId: event.id,
      });
    }
    return conversion;
  }

  // Sweep stale intents so the table doesn't grow unbounded. Lazy expiry
  // check in redirect() is the source of truth; this is just housekeeping.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredIntents() {
    const result = await this.prisma.clickIntent.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.debug(`Pruned ${result.count} expired click intents`);
    }
  }
}
