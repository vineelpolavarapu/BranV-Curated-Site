import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AvailabilityStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ScrapeService } from '../scrape/scrape.service';

export interface SyncStats {
  listingsChecked: number;
  pricesUpdated: number;
  outOfStockFlagged: number;
  restocked: number;
  priceDropNotificationsFired: number;
  failures: number;
}

const FAILURE_FLAG_THRESHOLD = 3;
const CONCURRENCY = 2;
const PER_RETAILER_DELAY_MS = 500;

@Injectable()
export class PriceSyncService {
  private readonly logger = new Logger(PriceSyncService.name);
  private readonly driftThresholdPct: number;
  private readonly mock: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly scrape: ScrapeService,
    config: ConfigService,
  ) {
    this.driftThresholdPct =
      Number(config.get('PRICE_SYNC_DRIFT_THRESHOLD_PCT') ?? 5);
    this.mock =
      (config.get<string>('USE_MOCK_INTEGRATIONS') ?? 'true') === 'true';
  }

  /**
   * Re-checks every IN_STOCK retailer listing on every ACTIVE product. Updates
   * the listing + product price + fires wishlist price-drop notifications when
   * the new price drifts beyond PRICE_SYNC_DRIFT_THRESHOLD_PCT below the old.
   *
   * Concurrency-limited so we don't hammer any one retailer (BUILD_GUIDE §9.1).
   */
  async syncAll(): Promise<SyncStats> {
    const stats: SyncStats = {
      listingsChecked: 0,
      pricesUpdated: 0,
      outOfStockFlagged: 0,
      restocked: 0,
      priceDropNotificationsFired: 0,
      failures: 0,
    };

    const listings = await this.prisma.productRetailerListing.findMany({
      where: { product: { status: 'ACTIVE' } },
      include: {
        product: {
          select: { id: true, slug: true, title: true, price: true, primaryRetailer: true },
        },
      },
      orderBy: { lastSyncedAt: 'asc' },
    });

    // Group by retailer so we can pace per-retailer requests independently.
    const byRetailer = new Map<string, typeof listings>();
    for (const l of listings) {
      const arr = byRetailer.get(l.retailer) ?? [];
      arr.push(l);
      byRetailer.set(l.retailer, arr);
    }

    await Promise.all(
      Array.from(byRetailer.entries()).map(async ([retailer, group]) => {
        for (let i = 0; i < group.length; i += CONCURRENCY) {
          const slice = group.slice(i, i + CONCURRENCY);
          await Promise.all(slice.map((l) => this.syncOne(l, stats)));
          // Pace per-retailer (~2 rps max).
          await new Promise((r) => setTimeout(r, PER_RETAILER_DELAY_MS));
        }
        this.logger.log(`Synced ${group.length} listings @ ${retailer}`);
      }),
    );

    await this.audit.record({
      action: 'price.sync.run',
      metadata: stats as unknown as Prisma.InputJsonValue,
    });
    return stats;
  }

  private async syncOne(
    listing: Awaited<ReturnType<PriceSyncService['fetchListings']>>[number],
    stats: SyncStats,
  ): Promise<void> {
    stats.listingsChecked += 1;
    try {
      const remote = await this.fetchRemote(listing);

      if (!remote.available) {
        // Mark as out of stock — hidden from listings until next restock.
        if (listing.availabilityStatus !== AvailabilityStatus.OUT_OF_STOCK_AT_RETAILER) {
          await this.prisma.productRetailerListing.update({
            where: { id: listing.id },
            data: {
              availabilityStatus: AvailabilityStatus.OUT_OF_STOCK_AT_RETAILER,
              lastSyncedAt: new Date(),
              syncFailedCount: 0,
              syncFailedSince: null,
            },
          });
          stats.outOfStockFlagged += 1;
        }
        return;
      }

      // Coming back from OOS → restock.
      if (listing.availabilityStatus !== AvailabilityStatus.IN_STOCK) {
        stats.restocked += 1;
      }

      const oldPrice = listing.rawPrice ? Number(listing.rawPrice) : Number(listing.product.price);
      const drift =
        oldPrice > 0 ? Math.abs(remote.price - oldPrice) / oldPrice : 1;

      const updates: Prisma.ProductRetailerListingUpdateInput = {
        lastSyncedAt: new Date(),
        availabilityStatus: AvailabilityStatus.IN_STOCK,
        syncFailedCount: 0,
        syncFailedSince: null,
      };
      let droppedSignificantly = false;
      if (drift * 100 >= this.driftThresholdPct) {
        updates.rawPrice = remote.price;
        stats.pricesUpdated += 1;
        droppedSignificantly = remote.price < oldPrice;

        // Update the product's headline price if this is the primary retailer.
        if (
          listing.product.primaryRetailer &&
          listing.product.primaryRetailer === listing.retailer
        ) {
          await this.prisma.product.update({
            where: { id: listing.product.id },
            data: { price: remote.price },
          });
        }
      }

      await this.prisma.productRetailerListing.update({
        where: { id: listing.id },
        data: updates,
      });

      if (droppedSignificantly) {
        const fired = await this.firePriceDropNotifications(
          listing.product.id,
          listing.product.title,
          listing.product.slug,
          oldPrice,
          remote.price,
        );
        stats.priceDropNotificationsFired += fired;
      }
    } catch (err) {
      stats.failures += 1;
      await this.recordFailure(listing.id, listing.syncFailedCount, err as Error);
    }
  }

  /**
   * In mock mode: most calls return the current price unchanged, with a small
   * % chance of a price drop or OOS event so the worker is observably "doing
   * something" in dev. Real mode would hit the Cuelinks product API or scrape.
   */
  private async fetchRemote(
    listing: Awaited<ReturnType<PriceSyncService['fetchListings']>>[number],
  ): Promise<{ price: number; available: boolean }> {
    if (this.mock) {
      const current = listing.rawPrice
        ? Number(listing.rawPrice)
        : Number(listing.product.price);
      const roll = Math.random();
      // 8% chance of a 5–20% price drop.
      if (roll < 0.08) {
        const dropPct = 5 + Math.random() * 15;
        return { price: roundTo2(current * (1 - dropPct / 100)), available: true };
      }
      // 3% chance of OOS.
      if (roll < 0.11) {
        return { price: current, available: false };
      }
      // Otherwise stable.
      return { price: current, available: true };
    }

    // Real mode: lightweight re-scrape via the existing scrape service. The
    // Cuelinks product API would be preferred here when we have a key.
    const result = await this.scrape.scrape(listing.retailerProductUrl);
    return {
      price: result.price ?? Number(listing.rawPrice ?? listing.product.price),
      available: result.price !== null,
    };
  }

  private async fetchListings() {
    // Helper for type inference of the listing payload.
    return this.prisma.productRetailerListing.findMany({
      include: {
        product: {
          select: { id: true, slug: true, title: true, price: true, primaryRetailer: true },
        },
      },
    });
  }

  private async recordFailure(
    listingId: string,
    currentCount: number,
    err: Error,
  ) {
    const next = currentCount + 1;
    const shouldFlag = next >= FAILURE_FLAG_THRESHOLD;
    await this.prisma.productRetailerListing.update({
      where: { id: listingId },
      data: {
        syncFailedCount: next,
        syncFailedSince: currentCount === 0 ? new Date() : undefined,
        lastSyncedAt: new Date(),
      },
    });
    if (shouldFlag) {
      this.logger.warn(
        `Listing ${listingId} failed ${next} consecutive syncs: ${err.message}`,
      );
      await this.audit.record({
        action: 'price.sync.flagged',
        targetType: 'product_retailer_listing',
        targetId: listingId,
        metadata: { consecutiveFailures: next, lastError: err.message },
      });
    }
  }

  /**
   * Enqueue a WISHLIST_PRICE_DROP notification for every member who has
   * this product wishlisted with notifyOnPriceDrop=true. Goes through the
   * outbox so it's restart-safe (Phase 8).
   */
  private async firePriceDropNotifications(
    productId: string,
    title: string,
    slug: string,
    oldPrice: number,
    newPrice: number,
  ): Promise<number> {
    const wishlisters = await this.prisma.wishlistItem.findMany({
      where: { productId, notifyOnPriceDrop: true },
      select: { userId: true },
    });
    if (wishlisters.length === 0) return 0;

    const dropPct = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
    for (const w of wishlisters) {
      await this.notifications.enqueueMultiChannel({
        userId: w.userId,
        type: NotificationType.WISHLIST_PRICE_DROP,
        payload: {
          title: `Price drop: ${title}`,
          body: `Down ${dropPct}% — now ₹${newPrice.toLocaleString('en-IN')}.`,
          link: `/products/${slug}`,
          productId,
          oldPrice,
          newPrice,
        },
      });
    }
    return wishlisters.length;
  }
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}
