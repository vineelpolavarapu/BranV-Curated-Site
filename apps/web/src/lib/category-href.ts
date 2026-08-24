import { isCollectionSlug } from '@/lib/collections';

// The canonical URL for an L1 category: collection slugs have a dedicated
// bare-URL landing page (e.g. /inners), everything else uses /category/<slug>.
export function categoryHrefL1(slug: string): string {
  return isCollectionSlug(slug) ? `/${slug}` : `/category/${slug}`;
}

// L2 slugs follow the convention `{parentSlug}-{suffix}` (e.g. shirts-checks).
// The L2 destination is always the L1 page with the suffix as a hash fragment,
// which CategoryHashFilter reads and uses to filter the L1's product grid.
// The base is the L1's canonical URL (categoryHrefL1) so the hash survives —
// collection slugs live at /<slug>, not /category/<slug> (which redirects).
export function categoryHrefL2(parentSlug: string, l2Slug: string): string {
  const suffix = l2Slug.startsWith(`${parentSlug}-`)
    ? l2Slug.slice(parentSlug.length + 1)
    : l2Slug;
  return `${categoryHrefL1(parentSlug)}#${suffix}`;
}

export function categoryHref(args: {
  slug: string;
  parentSlug?: string | null;
}): string {
  if (args.parentSlug) return categoryHrefL2(args.parentSlug, args.slug);
  return categoryHrefL1(args.slug);
}
