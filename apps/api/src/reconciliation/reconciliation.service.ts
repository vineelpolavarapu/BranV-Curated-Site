import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  AffiliatePartner,
  AffiliatePayoutItemStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NormalizedRow, parseCsv } from './reconciliation.parsers';

const MATCH_WINDOW_HOURS = 48;
/// Amount band: ±20% so retailer rounding / shipping tweaks don't miss.
const MATCH_AMOUNT_BAND = 0.2;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ingest a CSV from one of the affiliate partners. Idempotent by csvHash —
   * if this exact file was uploaded before we return the existing payout
   * rather than double-counting (BUILD_GUIDE §9.1 step 3).
   */
  async ingest(
    file: { buffer: Buffer; originalname?: string },
    actorId: string,
    notes?: string,
  ) {
    const csvHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.affiliatePayout.findUnique({
      where: { csvHash },
    });
    if (existing) {
      throw new ConflictException({
        message: 'This CSV was already uploaded.',
        existingPayoutId: existing.id,
      });
    }

    const parsed = parseCsv(file.buffer);
    if (parsed.rows.length === 0) {
      throw new BadRequestException('CSV had no recognizable rows.');
    }

    // Roll up totals reported by the CSV for the variance dashboard.
    const totalCommission = parsed.rows.reduce(
      (a, r) => a + (r.commissionInr ?? 0),
      0,
    );
    const reportedPeriodStart = minDate(parsed.rows.map((r) => r.occurredAt));
    const reportedPeriodEnd = maxDate(parsed.rows.map((r) => r.occurredAt));

    const payout = await this.prisma.affiliatePayout.create({
      data: {
        partner: parsed.partner,
        csvHash,
        csvFilename: file.originalname,
        rowCount: parsed.rows.length,
        reportedCommissionInr: totalCommission > 0 ? totalCommission : null,
        reportedPeriodStart,
        reportedPeriodEnd,
        notes,
        uploadedById: actorId,
      },
    });

    let matched = 0;
    let unmatched = 0;
    let ambiguous = 0;

    // Process rows sequentially — matching wants its own query per row.
    for (const row of parsed.rows) {
      const result = await this.matchRow(parsed.partner, row);
      try {
        await this.prisma.affiliatePayoutItem.create({
          data: {
            payoutId: payout.id,
            matchedClickEventId: result.clickEventId,
            retailerOrderId: row.retailerOrderId,
            amountInr: row.amountInr ?? undefined,
            commissionInr: row.commissionInr ?? undefined,
            occurredAt: row.occurredAt ?? undefined,
            status: result.status,
            rowHash: row.rowHash,
            rawRow: row.raw as Prisma.InputJsonValue,
          },
        });
        if (result.status === AffiliatePayoutItemStatus.MATCHED) matched += 1;
        else if (result.status === AffiliatePayoutItemStatus.AMBIGUOUS) ambiguous += 1;
        else unmatched += 1;
      } catch (err) {
        // Within-file duplicate row (same hash). Skip silently — it's already counted.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }

    const finalized = await this.prisma.affiliatePayout.update({
      where: { id: payout.id },
      data: { matchedCount: matched, unmatchedCount: unmatched, ambiguousCount: ambiguous },
    });

    await this.audit.record({
      actorId,
      action: 'affiliate.reconciliation.upload',
      targetType: 'affiliate_payout',
      targetId: payout.id,
      metadata: {
        partner: parsed.partner,
        rows: parsed.rows.length,
        matched,
        ambiguous,
        unmatched,
        filename: file.originalname ?? null,
      },
    });

    return finalized;
  }

  private async matchRow(
    partner: AffiliatePartner,
    row: NormalizedRow,
  ): Promise<{
    status: AffiliatePayoutItemStatus;
    clickEventId: string | null;
  }> {
    const occurredAt = row.occurredAt;
    if (!occurredAt) {
      return { status: AffiliatePayoutItemStatus.UNMATCHED, clickEventId: null };
    }
    const windowMs = MATCH_WINDOW_HOURS * 60 * 60 * 1000;
    const from = new Date(occurredAt.getTime() - windowMs);
    const to = new Date(occurredAt.getTime() + windowMs);

    const candidates = await this.prisma.clickEvent.findMany({
      where: {
        partner,
        redirectedAt: { gte: from, lte: to },
      },
      orderBy: { redirectedAt: 'desc' },
      select: { id: true, redirectedAt: true },
      take: 10,
    });

    if (candidates.length === 0) {
      return { status: AffiliatePayoutItemStatus.UNMATCHED, clickEventId: null };
    }

    // If amount is known, prefer clicks whose product price is within the
    // band of the reported amount.
    if (row.amountInr !== null) {
      const refined = await this.refineByAmount(candidates.map((c) => c.id), row.amountInr);
      if (refined.length === 1) {
        return {
          status: AffiliatePayoutItemStatus.MATCHED,
          clickEventId: refined[0],
        };
      }
      if (refined.length > 1) {
        return {
          status: AffiliatePayoutItemStatus.AMBIGUOUS,
          clickEventId: refined[0],
        };
      }
    }

    if (candidates.length === 1) {
      return {
        status: AffiliatePayoutItemStatus.MATCHED,
        clickEventId: candidates[0].id,
      };
    }
    return {
      status: AffiliatePayoutItemStatus.AMBIGUOUS,
      clickEventId: candidates[0].id,
    };
  }

  private async refineByAmount(clickIds: string[], targetAmount: number) {
    const clicks = await this.prisma.clickEvent.findMany({
      where: { id: { in: clickIds } },
      include: { product: { select: { price: true } } },
    });
    return clicks
      .filter((c) => {
        const price = Number(c.product.price);
        if (!price) return true;
        const drift = Math.abs(price - targetAmount) / Math.max(price, 1);
        return drift <= MATCH_AMOUNT_BAND;
      })
      .map((c) => c.id);
  }

  // ────────────────────────── reads for admin UI ──────────────────────────

  async listPayouts() {
    const data = await this.prisma.affiliatePayout.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        uploadedBy: { select: { id: true, email: true } },
      },
    });
    return data;
  }

  async getPayout(id: string) {
    return this.prisma.affiliatePayout.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            matchedClickEvent: {
              select: {
                id: true,
                product: { select: { slug: true, title: true } },
              },
            },
          },
        },
        uploadedBy: { select: { id: true, email: true } },
      },
    });
  }

  /** Variance: tracked clicks + estimated commission vs reported numbers. */
  async variance(partner?: AffiliatePartner) {
    const where = partner ? { partner } : {};
    const [payouts, clicks] = await Promise.all([
      this.prisma.affiliatePayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          partner: true,
          reportedCommissionInr: true,
          reportedClicks: true,
          reportedOrders: true,
          matchedCount: true,
          unmatchedCount: true,
          ambiguousCount: true,
          createdAt: true,
        },
      }),
      this.prisma.clickEvent.groupBy({
        by: ['partner'],
        _count: { _all: true },
      }),
    ]);

    const trackedByPartner = new Map<string, number>();
    for (const row of clicks) {
      if (row.partner) trackedByPartner.set(row.partner, row._count._all);
    }
    return { payouts, trackedByPartner: Object.fromEntries(trackedByPartner) };
  }
}

function minDate(dates: Array<Date | null>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (d && (!best || d < best)) best = d;
  }
  return best;
}
function maxDate(dates: Array<Date | null>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (d && (!best || d > best)) best = d;
  }
  return best;
}
