export type ShopSubCategory = { name: string; slug: string };
export type ShopCategory = {
  name: string;
  slug: string;
  subcategories: ShopSubCategory[];
};

export const SHOP_CATEGORIES: ShopCategory[] = [
  {
    name: 'Shirts',
    slug: 'shirts',
    subcategories: [
      { name: 'Half Sleeves', slug: 'shirts-half-sleeves' },
      { name: 'Full Sleeves', slug: 'shirts-full-sleeves' },
      { name: 'Checks', slug: 'shirts-checks' },
      { name: 'Printed', slug: 'shirts-printed' },
      { name: 'Formals', slug: 'shirts-formals' },
    ],
  },
  {
    name: 'T-Shirts',
    slug: 't-shirts',
    subcategories: [
      { name: 'Polo T-Shirts', slug: 't-shirts-polo-t-shirts' },
      { name: 'Full Neck T-Shirts', slug: 't-shirts-full-neck-t-shirts' },
      { name: 'Collar T-Shirts', slug: 't-shirts-collar-t-shirts' },
    ],
  },
  {
    name: 'Jeans',
    slug: 'jeans',
    subcategories: [
      { name: 'Baggy Jeans', slug: 'jeans-baggy-jeans' },
      { name: 'Formal Jeans', slug: 'jeans-formal-jeans' },
      { name: 'Cotton Jeans', slug: 'jeans-cotton-jeans' },
      { name: 'Slim Fit', slug: 'jeans-slim-fit' },
    ],
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    subcategories: [
      { name: 'Sneakers', slug: 'footwear-sneakers' },
      { name: 'Loafers', slug: 'footwear-loafers' },
      { name: 'Formal Shoes', slug: 'footwear-formal-shoes' },
      { name: 'Boots', slug: 'footwear-boots' },
      { name: 'Sandals & Slippers', slug: 'footwear-sandals-and-slippers' },
      { name: 'Sports Shoes', slug: 'footwear-sports-shoes' },
      { name: 'Chappals', slug: 'footwear-chappals' },
    ],
  },
  {
    name: 'Tracks',
    slug: 'tracks',
    subcategories: [
      { name: 'Joggers', slug: 'tracks-joggers' },
      { name: 'Slim Fit Tracks', slug: 'tracks-slim-fit-tracks' },
      { name: 'Zipper Tracks', slug: 'tracks-zipper-tracks' },
      { name: 'Cotton Tracks', slug: 'tracks-cotton-tracks' },
      { name: 'Sports Tracks', slug: 'tracks-sports-tracks' },
      { name: 'Printed Tracks', slug: 'tracks-printed-tracks' },
      { name: 'Lounge Tracks', slug: 'tracks-lounge-tracks' },
    ],
  },
  {
    name: 'Watches',
    slug: 'watches',
    subcategories: [
      { name: 'Digital', slug: 'watches-digital' },
      { name: 'Analog', slug: 'watches-analog' },
      { name: 'Classical', slug: 'watches-classical' },
      { name: 'Strap Watches', slug: 'watches-strap-watches' },
      { name: 'Chained Watches', slug: 'watches-chained-watches' },
    ],
  },
];
