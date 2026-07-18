export type BrandStatus = 'ACTIVE' | 'HIDDEN' | 'ARCHIVED';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type AffiliatePartner = 'AMAZON' | 'EARNKARO' | 'MEESHO' | 'DIRECT';
export type FilterType = 'SELECT' | 'MULTI_SELECT' | 'RANGE' | 'TOGGLE';
export type AvailabilityStatus =
  | 'IN_STOCK'
  | 'OUT_OF_STOCK_AT_RETAILER'
  | 'DELISTED';

export interface Brand {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  heroUrl: string | null;
  description: string | null;
  isFeatured: boolean;
  status: BrandStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  path: string;
  displayOrder: number;
  _count?: {
    productsAsCategory: number;
    productsAsSubcategory: number;
    attributeSchemas: number;
  };
}

export interface AttributeSchema {
  id: string;
  categoryId: string;
  attributeKey: string;
  displayName: string;
  filterType: FilterType;
  optionsJson: unknown;
  displayOrder: number;
}

export interface ProductRow {
  id: string;
  slug: string;
  title: string;
  status: ProductStatus;
  price: string;
  mrp: string | null;
  currency: string;
  tags: string[];
  createdAt: string;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  images: Array<{ url: string; isAiGenerated: boolean }>;
  _count: { retailerListings: number; variants: number };
}

export interface Avatar {
  id: string;
  name: string;
  referenceImageUrl: string;
  promptTemplate: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
