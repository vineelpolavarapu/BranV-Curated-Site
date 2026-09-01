import type { MetadataRoute } from 'next';
import { apiServer } from '@/lib/api-server';
import { ArticleSummary } from '@/lib/article-types';
import { BrandCard } from '@/lib/storefront-types';
import { EditSummary } from '@/lib/phase7-types';
import { categoryHrefL1 } from '@/lib/category-href';

/**
 * Dynamic sitemap. Articles get refreshed every time the scheduler publishes
 * one; brands + categories + edits track the catalog.
 * Phase 11 will add per-product URLs (large set, needs an index) and ISR-style
 * caching.
 */
export const revalidate = 300; // 5 min

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.WEB_ORIGIN ??
  'http://localhost:3000';

const CATEGORY_SLUGS = [
  'shirts',
  't-shirts',
  'jeans',
  'tracks',
  'footwear',
  'watches',
  'trousers',
  'shorts',
  'jackets',
  'inners',
  'sweatshirts',
  'hoodies',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, brands, edits] = await Promise.all([
    apiServer<{ data: ArticleSummary[] }>('/articles?pageSize=60'),
    apiServer<BrandCard[]>('/brands'),
    apiServer<EditSummary[]>('/edits'),
  ]);

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/articles`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/brands`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/new`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
  ];

  const categoryEntries: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((slug) => ({
    url: `${BASE}${categoryHrefL1(slug)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const brandEntries: MetadataRoute.Sitemap = (brands ?? []).map((b) => ({
    url: `${BASE}/brands/${b.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  const articleEntries: MetadataRoute.Sitemap = (articles?.data ?? []).map((a) => ({
    url: `${BASE}/articles/${a.slug}`,
    lastModified: a.publishedAt ? new Date(a.publishedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const editEntries: MetadataRoute.Sitemap = (edits ?? []).map((e) => ({
    url: `${BASE}/edits/${e.slug}`,
    lastModified: e.publishedAt ? new Date(e.publishedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...categoryEntries,
    ...brandEntries,
    ...articleEntries,
    ...editEntries,
  ];
}
