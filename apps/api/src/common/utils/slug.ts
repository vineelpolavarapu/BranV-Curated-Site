/**
 * Slugify any string into a URL-safe form.
 *   "Tommy Hilfiger" → "tommy-hilfiger"
 *   "Levi's 501® Original" → "levis-501-original"
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ensure a slug is unique against a check function. Appends `-2`, `-3`, etc.
 * until the check returns false (i.e. "not taken").
 */
export async function ensureUniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  let i = 1;
  while (await isTaken(candidate)) {
    i += 1;
    candidate = `${base}-${i}`;
  }
  return candidate;
}
