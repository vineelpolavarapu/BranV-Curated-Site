// Single source of truth for the admin "Product Visibility" checkboxes.
//
// Each entry is an extra category / collection landing page a product can be
// surfaced on (in addition to its primary category). The `slug` MUST match a
// row in the `categories` table so the backend can resolve it to an id and
// write a `product_category_links` row (see _sync_visibility_links). Ticking a
// box whose slug has no category row is silently ignored by the backend.
//
// Used by: QuickAddModal, /admin/products/new, and /admin/products/[id].
export interface VisibilityCategory {
  name: string;
  slug: string;
}

export const VISIBILITY_CATEGORIES: VisibilityCategory[] = [
  { name: 'Trendy Wear', slug: 'trendy-wear' },
  { name: 'Sports Wear', slug: 'sports-wear' },
  { name: 'Classic Essentials', slug: 'classic-essentials' },
  { name: 'Easy Casuals', slug: 'easy-casuals' },
  { name: 'Fashion Forward', slug: 'fashion-forward' },
  { name: 'Sharp Formals', slug: 'sharp-formals' },
  { name: 'Shirts', slug: 'shirts' },
  { name: 'T-Shirts', slug: 't-shirts' },
  { name: 'Jeans', slug: 'jeans' },
  { name: 'Tracks', slug: 'tracks' },
  { name: 'Footwear', slug: 'footwear' },
  { name: 'Watches', slug: 'watches' },
  { name: 'Trousers', slug: 'trousers' },
  { name: 'Shorts', slug: 'shorts' },
  { name: 'Jackets', slug: 'jackets' },
  { name: 'Inners', slug: 'inners' },
  { name: 'Sweatshirts', slug: 'sweatshirts' },
  { name: 'Hoodies', slug: 'hoodies' },
];
