export type DropStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'ARCHIVED';
export type LookbookStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type EditStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type HomeBannerStatus = 'ACTIVE' | 'HIDDEN';
export type BrandStoryStatus = 'DRAFT' | 'PUBLISHED';

export interface ProductLite {
  id: string;
  slug: string;
  title: string;
}

export interface ProductPickerOption {
  id: string;
  slug: string;
  title: string;
  brand: { id: string; name: string };
  thumbnail: string | null;
}

// ── Drops ───────────────────────────────────────────────────────────────

export interface DropAdmin {
  id: string;
  slug: string;
  name: string;
  heroUrl: string | null;
  description: string | null;
  launchAt: string;
  endsAt: string | null;
  status: DropStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  dropProducts?: Array<{ id: string; productId: string; position: number; product: ProductLite }>;
  _count?: { dropProducts: number; notifySignups: number };
}

export interface DropSummary {
  id: string;
  slug: string;
  name: string;
  heroUrl: string | null;
  description: string | null;
  launchAt: string;
  endsAt: string | null;
  status: DropStatus;
  publishedAt: string | null;
}

export interface DropDetailProduct {
  slug: string;
  title: string;
  brand: { id: string; name: string; slug: string };
  price: number;
  mrp: number | null;
  discountPct: number | null;
  currency: string;
  primaryImage: { url: string; altText: string | null; isAiGenerated: boolean } | null;
  buyNow: {
    retailer: string;
    url: string;
    partner: string | null;
    pending: boolean;
    trackingId: string | null;
  } | null;
}

export interface DropDetail extends DropSummary {
  products: DropDetailProduct[];
}

export interface DropCalendar {
  live: DropSummary[];
  scheduled: DropSummary[];
  ended: DropSummary[];
}

// ── Lookbooks ───────────────────────────────────────────────────────────

export interface LookbookTagAdmin {
  id: string;
  productId: string;
  xPercent: string | number;
  yPercent: string | number;
  product: ProductLite;
}

export interface LookbookImageAdmin {
  id: string;
  imageUrl: string;
  position: number;
  tags: LookbookTagAdmin[];
}

export interface LookbookAdmin {
  id: string;
  slug: string;
  title: string;
  heroUrl: string | null;
  description: string | null;
  status: LookbookStatus;
  publishedAt: string | null;
  images?: LookbookImageAdmin[];
  _count?: { images: number };
}

export interface LookbookPublicTag {
  id: string;
  xPercent: number;
  yPercent: number;
  product: DropDetailProduct;
}

export interface LookbookPublicImage {
  id: string;
  imageUrl: string;
  position: number;
  tags: LookbookPublicTag[];
}

export interface LookbookPublic {
  id: string;
  slug: string;
  title: string;
  heroUrl: string | null;
  description: string | null;
  publishedAt: string | null;
  images: LookbookPublicImage[];
}

// ── Edits ───────────────────────────────────────────────────────────────

export interface EditAdmin {
  id: string;
  slug: string;
  title: string;
  heroUrl: string | null;
  description: string | null;
  status: EditStatus;
  isFeaturedOnHome: boolean;
  publishedAt: string | null;
  editProducts?: Array<{ id: string; productId: string; position: number; product: ProductLite }>;
  _count?: { editProducts: number };
}

export interface EditSummary {
  id: string;
  slug: string;
  title: string;
  heroUrl: string | null;
  description: string | null;
  publishedAt: string | null;
  isFeaturedOnHome: boolean;
  _count?: { editProducts: number };
}

export interface EditDetail extends EditSummary {
  products: DropDetailProduct[];
}

// ── Banners ─────────────────────────────────────────────────────────────

export interface Banner {
  id: string;
  imageUrl: string;
  headline: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  displayOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  status: HomeBannerStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Brand story ─────────────────────────────────────────────────────────

export interface BrandStory {
  id: string;
  brandId: string;
  heroUrl: string | null;
  bodyMd: string;
  status: BrandStoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BrandStoryPublic {
  heroUrl: string | null;
  bodyMd: string;
}
