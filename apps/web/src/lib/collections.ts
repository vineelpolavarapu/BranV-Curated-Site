/**
 * Banner "collection" categories. These are real top-level categories in the
 * DB (so products can be assigned to them exactly like Footwear/Watches), but
 * they are deliberately hidden from the Shop grid and nav menus and reached
 * only via the homepage banner "Explore Collection" CTAs at bare URLs
 * (e.g. /sharp-formals). Keep this list in sync with the migration/seed that
 * creates the matching category rows.
 */
export const COLLECTION_SLUGS = [
  'sharp-formals',
  'classic-essentials',
  'trendy-wear',
  'sports-wear',
  'fashion-forward',
  'easy-casuals',
] as const;

export type CollectionSlug = (typeof COLLECTION_SLUGS)[number];

export function isCollectionSlug(slug: string): slug is CollectionSlug {
  return (COLLECTION_SLUGS as readonly string[]).includes(slug);
}
