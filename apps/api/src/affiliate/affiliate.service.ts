import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AffiliatePartner } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AffiliateConversionResult } from './affiliate.types';
import { detectRetailer } from '../scrape/scrape.types';

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);
  private readonly mock: boolean;
  private readonly cuelinksKey: string;
  private readonly cuelinksBase: string;
  private readonly amazonTag: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    this.mock =
      (this.config.get<string>('USE_MOCK_INTEGRATIONS') ?? 'true') === 'true';
    this.cuelinksKey = this.config.get<string>('CUELINKS_API_KEY') ?? '';
    this.cuelinksBase =
      this.config.get<string>('CUELINKS_API_BASE') ??
      'https://www.cuelinks.com/api/v2';
    this.amazonTag =
      this.config.get<string>('AMAZON_ASSOCIATES_TAG') ?? 'branv-21';
  }

  /**
   * Convert a raw retailer URL into an affiliate-tagged URL.
   * Amazon goes through Associates direct; everyone else through Cuelinks;
   * if Cuelinks fails, returns `pendingConversion: true` so the worker
   * retries later. Never throws — failure is part of the contract.
   */
  async convert(rawUrl: string): Promise<AffiliateConversionResult> {
    const retailer = detectRetailer(rawUrl);

    if (retailer === 'amazon') {
      return this.tagAmazon(rawUrl);
    }

    if (this.mock) {
      return this.mockConvert(rawUrl);
    }

    return this.realConvert(rawUrl);
  }

  private tagAmazon(rawUrl: string): AffiliateConversionResult {
    try {
      const u = new URL(rawUrl);
      u.searchParams.set('tag', this.amazonTag);
      return {
        partner: AffiliatePartner.AMAZON,
        convertedUrl: u.toString(),
        partnerLinkId: null,
        pendingConversion: false,
        source: 'amazon-direct',
      };
    } catch {
      return {
        partner: AffiliatePartner.AMAZON,
        convertedUrl: rawUrl,
        partnerLinkId: null,
        pendingConversion: true,
        source: 'amazon-direct',
        error: 'malformed url',
      };
    }
  }

  private mockConvert(rawUrl: string): AffiliateConversionResult {
    try {
      const u = new URL(rawUrl);
      u.searchParams.set('cuelinkstrack', 'branv-mock');
      return {
        partner: AffiliatePartner.CUELINKS,
        convertedUrl: u.toString(),
        partnerLinkId: `mock-${Date.now()}`,
        pendingConversion: false,
        source: 'cuelinks-mock',
      };
    } catch {
      return {
        partner: AffiliatePartner.CUELINKS,
        convertedUrl: rawUrl,
        partnerLinkId: null,
        pendingConversion: true,
        source: 'cuelinks-mock',
        error: 'malformed url',
      };
    }
  }

  private async realConvert(rawUrl: string): Promise<AffiliateConversionResult> {
    try {
      const res = await fetch(`${this.cuelinksBase}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cuelinksKey}`,
        },
        body: JSON.stringify({ url: rawUrl }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`Cuelinks responded ${res.status}`);
      const body = (await res.json()) as {
        converted_url?: string;
        cl_link_id?: string;
      };
      if (!body.converted_url) throw new Error('Missing converted_url in response');
      return {
        partner: AffiliatePartner.CUELINKS,
        convertedUrl: body.converted_url,
        partnerLinkId: body.cl_link_id ?? null,
        pendingConversion: false,
        source: 'cuelinks',
      };
    } catch (err) {
      this.logger.warn(
        `Cuelinks convert failed for ${rawUrl}: ${(err as Error).message} — marking pending`,
      );
      return {
        partner: AffiliatePartner.CUELINKS,
        convertedUrl: rawUrl,
        partnerLinkId: null,
        pendingConversion: true,
        source: 'fallback',
        error: (err as Error).message,
      };
    }
  }

  /**
   * Persist the converted result for a given retailer listing. Called from
   * Quick Add's transaction and from the pending-conversion worker.
   */
  async persist(
    productRetailerListingId: string,
    rawUrl: string,
    result: AffiliateConversionResult,
  ) {
    return this.prisma.affiliateLink.create({
      data: {
        productRetailerListingId,
        partner: result.partner,
        rawUrl,
        convertedUrl: result.convertedUrl,
        partnerLinkId: result.partnerLinkId,
        pendingConversion: result.pendingConversion,
        lastError: result.error,
        lastValidatedAt: result.pendingConversion ? null : new Date(),
      },
    });
  }

  /** Pending-conversion retry. Returns count of links resolved. */
  async resolvePending(limit = 20): Promise<number> {
    const pending = await this.prisma.affiliateLink.findMany({
      where: { pendingConversion: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    let resolved = 0;
    for (const link of pending) {
      const result = await this.convert(link.rawUrl);
      if (!result.pendingConversion) {
        await this.prisma.affiliateLink.update({
          where: { id: link.id },
          data: {
            convertedUrl: result.convertedUrl,
            partnerLinkId: result.partnerLinkId,
            partner: result.partner,
            pendingConversion: false,
            lastError: null,
            lastValidatedAt: new Date(),
          },
        });
        await this.audit.record({
          action: 'affiliate.link.resolved',
          targetType: 'affiliate_link',
          targetId: link.id,
        });
        resolved += 1;
      } else {
        await this.prisma.affiliateLink.update({
          where: { id: link.id },
          data: { lastError: result.error, updatedAt: new Date() },
        });
      }
    }
    return resolved;
  }
}
