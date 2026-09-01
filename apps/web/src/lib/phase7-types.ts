export type EditStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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

export interface ProductDetail {
  slug: string;
  title: string;
  brand: { id: string; name: string; slug: string };
  primaryImage: { url: string; altText: string | null; isAiGenerated: boolean } | null;
  buyNow: {
    retailer: string;
    retailerDisplayName: string | null;
    url: string;
    partner: string | null;
    pending: boolean;
    trackingId: string | null;
  } | null;
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
  products: ProductDetail[];
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
