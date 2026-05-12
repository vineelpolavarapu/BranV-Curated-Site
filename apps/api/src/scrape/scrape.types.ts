export type SupportedRetailer =
  | 'flipkart'
  | 'amazon'
  | 'myntra'
  | 'ajio'
  | 'meesho'
  | 'nykaa'
  | 'snitch'
  | 'bewakoof'
  | 'thesouledstore'
  | 'other';

export interface ScrapeResult {
  retailer: SupportedRetailer;
  rawUrl: string;
  /** Canonicalized URL with tracking/affiliate junk stripped (best-effort). */
  canonicalUrl: string;
  title: string | null;
  brandHint: string | null;
  price: number | null;
  mrp: number | null;
  primaryImageUrl: string | null;
  /** Where the data came from — useful for the admin to know whether to trust. */
  source: 'mock' | 'cuelinks-product-api' | 'opengraph' | 'retailer-parser';
}

export function detectRetailer(url: string): SupportedRetailer {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('flipkart')) return 'flipkart';
    if (host.includes('amazon')) return 'amazon';
    if (host.includes('myntra')) return 'myntra';
    if (host.includes('ajio')) return 'ajio';
    if (host.includes('meesho')) return 'meesho';
    if (host.includes('nykaa')) return 'nykaa';
    if (host.includes('snitch')) return 'snitch';
    if (host.includes('bewakoof')) return 'bewakoof';
    if (host.includes('thesouledstore')) return 'thesouledstore';
    return 'other';
  } catch {
    return 'other';
  }
}

export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip common tracking params; keep product-identifying ones.
    const drop = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'mc_eid', 'mc_cid', 'ref', 'ref_', 'tag',
      'cuelinkstrack', 'cltrack', 'pcampaignid',
    ];
    drop.forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}
