// L2 slugs follow the convention `{parentSlug}-{suffix}` (e.g. shirts-checks).
// The L2 destination is always the L1 page with the suffix as a hash fragment,
// which CategoryHashFilter reads and uses to filter the L1's product grid.
export function categoryHrefL2(parentSlug: string, l2Slug: string): string {
  const suffix = l2Slug.startsWith(`${parentSlug}-`)
    ? l2Slug.slice(parentSlug.length + 1)
    : l2Slug;
  return `/category/${parentSlug}#${suffix}`;
}

export function categoryHref(args: {
  slug: string;
  parentSlug?: string | null;
}): string {
  if (args.parentSlug) return categoryHrefL2(args.parentSlug, args.slug);
  return `/category/${args.slug}`;
}
