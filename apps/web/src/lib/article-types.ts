export type ArticleStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  heroUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  readingMinutes: number | null;
}

export interface EmbeddedProduct {
  slug: string;
  title: string;
  brand: { id: string; name: string; slug: string };
  price: number;
  mrp: number | null;
  discountPct: number | null;
  currency: string;
  primaryImage: {
    url: string;
    altText: string | null;
    isAiGenerated: boolean;
  } | null;
  buyNow: {
    retailer: string;
    retailerDisplayName: string | null;
    url: string;
    partner: string | null;
    pending: boolean;
    trackingId: string | null;
  } | null;
}

export interface ArticleDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  heroUrl: string | null;
  bodyMd: string;
  tags: string[];
  publishedAt: string | null;
  readingMinutes: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  embeddedProducts: EmbeddedProduct[];
}

export interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  heroUrl: string | null;
  excerpt: string | null;
  bodyMd: string;
  status: ArticleStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  readingMinutes: number | null;
  author?: { id: string; email: string } | null;
  articleProducts?: Array<{
    id: string;
    productId: string;
    position: number;
    product: { id: string; slug: string; title: string };
  }>;
  _count?: { articleProducts: number };
  createdAt: string;
  updatedAt: string;
}
