/**
 * Categories served by a dedicated bare-URL landing page (e.g. /sharp-formals)
 * rather than the generic /category/[slug] route. isCollectionSlug drives two
 * behaviours: the /category/<slug> route 301-redirects to the bare URL (single
 * canonical slug), and CategoryCatalog renders the collection-style header
 * (no category icon).
 *
 * The first six are banner "collection" categories — real top-level DB
 * categories, deliberately hidden from the Shop grid/nav and reached only via
 * the homepage banner "Explore Collection" CTAs.
 *
 * Inners, Sweatshirts and Hoodies are regular Shop-menu L1 categories that
 * ALSO get a dedicated bare-URL landing page; they stay in the Shop menu
 * (SHOP_CATEGORIES) and the nav links point straight at /inners etc.
 */
export const COLLECTION_SLUGS = [
  'sharp-formals',
  'classic-essentials',
  'trendy-wear',
  'sports-wear',
  'fashion-forward',
  'easy-casuals',
  'inners',
  'sweatshirts',
  'hoodies',
] as const;

export type CollectionSlug = (typeof COLLECTION_SLUGS)[number];

export function isCollectionSlug(slug: string): slug is CollectionSlug {
  return (COLLECTION_SLUGS as readonly string[]).includes(slug);
}
