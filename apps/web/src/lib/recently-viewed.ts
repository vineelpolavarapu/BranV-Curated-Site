export interface RecentlyViewedItem {
  slug: string;
  title: string;
  brandName: string;
  imageUrl: string | null;
  viewedAt: number;
}

const KEY = 'branv:recently-viewed';
const MAX_ITEMS = 12;

export function recordRecentlyViewed(item: Omit<RecentlyViewedItem, 'viewedAt'>): void {
  try {
    const existing = getRecentlyViewed();
    const next = [
      { ...item, viewedAt: Date.now() },
      ...existing.filter((i) => i.slug !== item.slug),
    ].slice(0, MAX_ITEMS);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable (SSR, private mode); recently-viewed is best-effort */
  }
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
