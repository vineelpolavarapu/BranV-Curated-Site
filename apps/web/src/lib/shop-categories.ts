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
      { name: 'Graphic Tees', slug: 't-shirts-graphic-tees' },
      { name: 'Oversized Tees', slug: 't-shirts-oversized-tees' },
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
      { name: 'Straight Fit', slug: 'jeans-straight-fit' },
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
    name: 'Watches',
    slug: 'watches',
    subcategories: [
      { name: 'Digital', slug: 'watches-digital' },
      { name: 'Analog', slug: 'watches-analog' },
      { name: 'Classical', slug: 'watches-classical' },
      { name: 'Smartwatches', slug: 'watches-smartwatches' },
      { name: 'Luxury', slug: 'watches-luxury' },
      { name: 'Strap Watches', slug: 'watches-strap-watches' },
      { name: 'Chained Watches', slug: 'watches-chained-watches' },
      { name: 'Chronographs', slug: 'watches-chronographs' },
    ],
  },
  {
    name: 'Trousers',
    slug: 'trousers',
    subcategories: [
      { name: 'Chinos', slug: 'trousers-chinos' },
      { name: 'Formal Trousers', slug: 'trousers-formal-trousers' },
      { name: 'Cargo Trousers', slug: 'trousers-cargo-trousers' },
      { name: 'Cotton Trousers', slug: 'trousers-cotton-trousers' },
      { name: 'Slim Fit Trousers', slug: 'trousers-slim-fit-trousers' },
    ],
  },
  {
    name: 'Shorts',
    slug: 'shorts',
    subcategories: [
      { name: 'Denim Shorts', slug: 'shorts-denim-shorts' },
      { name: 'Cargo Shorts', slug: 'shorts-cargo-shorts' },
      { name: 'Sports Shorts', slug: 'shorts-sports-shorts' },
      { name: 'Cotton Shorts', slug: 'shorts-cotton-shorts' },
      { name: 'Casual Shorts', slug: 'shorts-casual-shorts' },
    ],
  },
  {
    name: 'Jackets',
    slug: 'jackets',
    subcategories: [
      { name: 'Denim Jackets', slug: 'jackets-denim-jackets' },
      { name: 'Leather Jackets', slug: 'jackets-leather-jackets' },
      { name: 'Bomber Jackets', slug: 'jackets-bomber-jackets' },
      { name: 'Puffer Jackets', slug: 'jackets-puffer-jackets' },
      { name: 'Windbreakers', slug: 'jackets-windbreakers' },
    ],
  },
  {
    name: 'Sweaters',
    slug: 'sweaters',
    subcategories: [
      { name: 'V-Neck Sweaters', slug: 'sweaters-v-neck-sweaters' },
      { name: 'Crew Neck Sweaters', slug: 'sweaters-crew-neck-sweaters' },
      { name: 'Cardigans', slug: 'sweaters-cardigans' },
      { name: 'Turtlenecks', slug: 'sweaters-turtlenecks' },
      { name: 'Cable Knit', slug: 'sweaters-cable-knit' },
    ],
  },
  {
    name: 'Sweatshirts',
    slug: 'sweatshirts',
    subcategories: [
      { name: 'Crew Neck Sweatshirts', slug: 'sweatshirts-crew-neck-sweatshirts' },
      { name: 'Oversized Sweatshirts', slug: 'sweatshirts-oversized-sweatshirts' },
      { name: 'Fleece Sweatshirts', slug: 'sweatshirts-fleece-sweatshirts' },
      { name: 'Printed Sweatshirts', slug: 'sweatshirts-printed-sweatshirts' },
    ],
  },
  {
    name: 'Hoodies',
    slug: 'hoodies',
    subcategories: [
      { name: 'Pullover Hoodies', slug: 'hoodies-pullover-hoodies' },
      { name: 'Zip-Up Hoodies', slug: 'hoodies-zip-up-hoodies' },
      { name: 'Oversized Hoodies', slug: 'hoodies-oversized-hoodies' },
      { name: 'Fleece Hoodies', slug: 'hoodies-fleece-hoodies' },
    ],
  },
];
