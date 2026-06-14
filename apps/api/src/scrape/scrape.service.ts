import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import {
  canonicalizeUrl,
  detectRetailer,
  ScrapeResult,
  SupportedRetailer,
} from './scrape.types';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour per PRD §3 Phase 3.
const CACHE_MAX_ENTRIES = 500; // Bound memory; admin scrape volume is low.

@Injectable()
export class ScrapeService {
  private readonly logger = new Logger(ScrapeService.name);
  private readonly mock: boolean;
  private readonly userAgent: string;
  // In-process cache. Admin-triggered endpoint, single instance, so we
  // don't need a shared store. Bounded with simple FIFO eviction.
  private readonly cache = new Map<
    string,
    { value: ScrapeResult; expiresAt: number }
  >();

  constructor(private readonly config: ConfigService) {
    this.mock =
      (this.config.get<string>('USE_MOCK_INTEGRATIONS') ?? 'true') === 'true';
    this.userAgent =
      this.config.get<string>('SCRAPER_USER_AGENT') ??
      'Mozilla/5.0 (compatible; BranVBot/1.0)';
  }

  async scrape(url: string): Promise<ScrapeResult> {
    const canonicalUrl = canonicalizeUrl(url);
    const retailer = detectRetailer(canonicalUrl);

    const hit = this.cache.get(canonicalUrl);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
    if (hit) this.cache.delete(canonicalUrl);

    const result = this.mock
      ? this.mockScrape(canonicalUrl, retailer)
      : await this.realScrape(canonicalUrl, retailer);

    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(canonicalUrl, {
      value: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return result;
  }

  // ────────── mock path (default in dev) ──────────

  private mockScrape(url: string, retailer: SupportedRetailer): ScrapeResult {
    const sampleByRetailer: Record<
      SupportedRetailer,
      { title: string; brand: string; price: number; mrp: number }
    > = {
      flipkart: { title: 'Slim Fit Cotton Casual Shirt', brand: 'Roadster', price: 899, mrp: 1799 },
      amazon: { title: "Men's Linen Blend Half Sleeve Shirt", brand: 'Allen Solly', price: 1249, mrp: 2499 },
      myntra: { title: 'Solid Pure Cotton Casual Shirt', brand: 'HRX by Hrithik Roshan', price: 1099, mrp: 1999 },
      ajio: { title: 'Tailored Fit Formal Trousers', brand: 'Tommy Hilfiger', price: 2199, mrp: 4499 },
      meesho: { title: 'Comfort Fit Polo T-Shirt', brand: 'Generic', price: 349, mrp: 999 },
      nykaa: { title: 'Aqua Aromatic EDP Fragrance 100ml', brand: 'Bombay Shaving Co.', price: 1499, mrp: 2199 },
      snitch: { title: 'Acid Wash Boxy Tee', brand: 'Snitch', price: 1099, mrp: 1499 },
      bewakoof: { title: 'Graphic Print Oversized T-Shirt', brand: 'Bewakoof', price: 599, mrp: 1099 },
      thesouledstore: { title: 'Marvel: Spider-Man Sweatshirt', brand: 'The Souled Store', price: 1399, mrp: 1999 },
      other: { title: 'Sample Menswear Product', brand: 'Sample Brand', price: 999, mrp: 1499 },
    };
    const s = sampleByRetailer[retailer];
    return {
      retailer,
      rawUrl: url,
      canonicalUrl: url,
      title: s.title,
      brandHint: s.brand,
      price: s.price,
      mrp: s.mrp,
      primaryImageUrl: `https://placehold.co/600x800/f3f4f6/737373?text=${encodeURIComponent(retailer)}+sample`,
      source: 'mock',
    };
  }

  // ────────── real path (when USE_MOCK_INTEGRATIONS=false) ──────────

  private async realScrape(
    url: string,
    retailer: SupportedRetailer,
  ): Promise<ScrapeResult> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-IN,en;q=0.9',
        },
        // Best-effort — many retailers block scrapers and require Cuelinks
        // product API in production. This is the fallback.
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();
      const $ = cheerio.load(html);
      return this.parseHtml($, url, retailer);
    } catch (err) {
      this.logger.warn(
        `scrape failed for ${url}: ${(err as Error).message} — returning empty result`,
      );
      return {
        retailer,
        rawUrl: url,
        canonicalUrl: url,
        title: null,
        brandHint: null,
        price: null,
        mrp: null,
        primaryImageUrl: null,
        source: 'opengraph',
      };
    }
  }

  private parseHtml(
    $: cheerio.CheerioAPI,
    url: string,
    retailer: SupportedRetailer,
  ): ScrapeResult {
    // Generic OpenGraph + JSON-LD extraction works for most modern retailers.
    const ogTitle =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').first().text().trim() ||
      null;
    const ogImage =
      $('meta[property="og:image"]').attr('content')?.trim() ||
      $('meta[name="twitter:image"]').attr('content')?.trim() ||
      null;
    const ogBrand =
      $('meta[property="product:brand"]').attr('content')?.trim() ||
      $('meta[property="og:brand"]').attr('content')?.trim() ||
      null;
    const ogPrice = Number(
      $('meta[property="product:price:amount"]').attr('content') ?? NaN,
    );

    let price: number | null = Number.isFinite(ogPrice) ? ogPrice : null;
    let mrp: number | null = null;
    let title = ogTitle;
    let brandHint = ogBrand;

    // Pull product JSON-LD where present.
    $('script[type="application/ld+json"]').each((_, el) => {
      const text = $(el).contents().text();
      if (!text) return;
      try {
        const parsed = JSON.parse(text);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const it of items) {
          if (it['@type'] !== 'Product') continue;
          title = title ?? it.name ?? null;
          brandHint = brandHint ?? it.brand?.name ?? it.brand ?? null;
          const offers = Array.isArray(it.offers) ? it.offers[0] : it.offers;
          if (offers?.price && !price) price = Number(offers.price);
          if (offers?.priceSpecification?.price && !price) {
            price = Number(offers.priceSpecification.price);
          }
        }
      } catch {
        /* skip malformed json-ld */
      }
    });

    // Retailer-specific overrides for the price-stricken sites.
    if (retailer === 'flipkart') {
      const fkPrice = $('._30jeq3, ._16Jk6d').first().text().replace(/[^\d.]/g, '');
      const fkMrp = $('._3I9_wc').first().text().replace(/[^\d.]/g, '');
      if (fkPrice) price = Number(fkPrice);
      if (fkMrp) mrp = Number(fkMrp);
    }

    return {
      retailer,
      rawUrl: url,
      canonicalUrl: url,
      title,
      brandHint,
      price,
      mrp,
      primaryImageUrl: ogImage,
      source: 'opengraph',
    };
  }
}
