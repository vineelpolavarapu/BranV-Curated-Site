export interface ImageRef {
  url: string;
  isAiGenerated: boolean;
  altText: string | null;
}

export interface GalleryImage extends ImageRef {
  isPrimary: boolean;
  position: number;
}

export interface RetailerOffer {
  retailer: string;
  rawPrice: number | null;
  availabilityStatus: 'IN_STOCK' | 'OUT_OF_STOCK_AT_RETAILER' | 'DELISTED';
  affiliateUrl: string;
  affiliatePartner: 'CUELINKS' | 'AMAZON' | 'EARNKARO' | 'DIRECT' | null;
  pending: boolean;
}

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  mrp: number | null;
  discountPct: number | null;
  currency: string;
  tags: string[];
  avgRating: number | null;
  reviewCount: number;
  createdAt: string;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  subcategory: { id: string; name: string; slug: string } | null;
  primaryImage: ImageRef | null;
  secondaryImage: ImageRef | null;
  gallery: GalleryImage[];
  aiImageCount: number;
  variants: Array<{
    id: string;
    color: string | null;
    size: string | null;
    attributes: unknown;
  }>;
  sizes: string[];
  colors: string[];
  retailers: RetailerOffer[];
  buyNow: {
    retailer: string;
    url: string;
    partner: string | null;
    pending: boolean;
    trackingId: string | null;
  } | null;
}

export interface ProductPage {
  data: ProductCardData[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface BrandCard {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  heroUrl: string | null;
  isFeatured: boolean;
  _count: { products: number };
}

export interface AutocompleteResult {
  products: Array<{ slug: string; title: string; brand: string }>;
  brands: Array<{ slug: string; name: string }>;
  categories: Array<{ slug: string; name: string; path: string }>;
}

export interface HomePayload {
  banners: Array<{
    id: string;
    imageUrl: string;
    headline: string | null;
    ctaLabel: string | null;
    ctaLink: string | null;
    displayOrder: number;
  }>;
  featuredBrands: Array<{
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    heroUrl: string | null;
  }>;
  newArrivals: ProductCardData[];
  newArrivalsCount: number;
  featuredEdit: {
    id: string;
    slug: string;
    title: string;
    heroUrl: string | null;
    description: string | null;
    productCount: number;
  } | null;
  activeDrops: Array<{
    id: string;
    slug: string;
    name: string;
    heroUrl: string | null;
    launchAt: string;
    endsAt: string | null;
  }>;
  latestArticles: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    heroUrl: string | null;
    publishedAt: string | null;
    readingMinutes: number | null;
  }>;
}
