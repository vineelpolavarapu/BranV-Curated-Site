/**
 * Seeds the BranV catalog taxonomy:
 *   - L1 + L2 categories per PRD §6.1
 *   - category_attribute_schemas per PRD §10.2 (attached to L1 categories;
 *     subcategories inherit when an L2 has no explicit schema)
 *
 * Idempotent: re-running upserts categories by slug and attribute schemas
 * by (categoryId, attributeKey).
 *
 * Usage:
 *   pnpm seed:catalog
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { FilterType, PrismaClient } from '@prisma/client';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── PRD §6.1 Catalog Taxonomy ────────────────────────────────────────────

const TAXONOMY: Array<{ name: string; subcategories: string[] }> = [
  {
    name: 'Clothing',
    subcategories: [
      'T-Shirts', 'Shirts', 'Polos', 'Jeans', 'Trousers', 'Shorts',
      'Jackets', 'Sweaters', 'Sweatshirts & Hoodies', 'Ethnic Wear',
    ],
  },
  {
    name: 'Suits & Formal',
    subcategories: [
      '2-Piece Suits', '3-Piece Suits', 'Blazers', 'Formal Trousers',
      'Formal Shirts', 'Ties', 'Bow Ties', 'Pocket Squares', 'Suspenders',
    ],
  },
  {
    name: 'Footwear',
    subcategories: [
      'Sneakers', 'Loafers', 'Formal Shoes', 'Boots',
      'Sandals & Slippers', 'Sports Shoes',
    ],
  },
  {
    name: 'Watches',
    subcategories: ['Analog', 'Digital', 'Smartwatches', 'Luxury', 'Chronographs'],
  },
  {
    name: 'Eyewear',
    subcategories: ['Sunglasses', 'Optical Frames', 'Blue-Light Glasses'],
  },
  {
    name: 'Accessories',
    subcategories: [
      'Belts', 'Wallets', 'Bags & Backpacks', 'Cufflinks', 'Caps & Hats',
      'Scarves & Stoles', 'Jewelry', 'Keychains',
    ],
  },
  {
    name: 'Grooming',
    subcategories: [
      'Fragrances', 'Beard Care', 'Hair Care', 'Skincare', 'Shaving', 'Gift Sets',
    ],
  },
];

// ── PRD §10.2 Category-Specific Filters ──────────────────────────────────

type AttrSchema = {
  attributeKey: string;
  displayName: string;
  filterType: FilterType;
  optionsJson?: string[];
};

const ATTRIBUTES: Record<string, AttrSchema[]> = {
  Clothing: [
    { attributeKey: 'size', displayName: 'Size', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
    { attributeKey: 'fit', displayName: 'Fit', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Slim', 'Regular', 'Relaxed', 'Oversized'] },
    { attributeKey: 'material', displayName: 'Material', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Cotton', 'Linen', 'Polyester', 'Wool', 'Denim', 'Blend'] },
    { attributeKey: 'sleeve', displayName: 'Sleeve', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Half', 'Full', 'Sleeveless', '3/4'] },
    { attributeKey: 'pattern', displayName: 'Pattern', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Solid', 'Striped', 'Checked', 'Printed', 'Graphic'] },
    { attributeKey: 'occasion', displayName: 'Occasion', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Casual', 'Work', 'Party', 'Beach', 'Wedding', 'Festive'] },
  ],
  'Suits & Formal': [
    { attributeKey: 'size', displayName: 'Size', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['36', '38', '40', '42', '44', '46', '48'] },
    { attributeKey: 'fit', displayName: 'Fit', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Slim', 'Tailored', 'Regular'] },
    { attributeKey: 'fabric', displayName: 'Fabric', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Wool', 'Linen', 'Cotton', 'Polyester', 'Tweed'] },
    { attributeKey: 'pattern', displayName: 'Pattern', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Solid', 'Pinstripe', 'Checked', 'Glen Plaid', 'Houndstooth'] },
    { attributeKey: 'pieceCount', displayName: 'Piece count', filterType: FilterType.SELECT,
      optionsJson: ['2-piece', '3-piece'] },
    { attributeKey: 'occasion', displayName: 'Occasion', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Business', 'Wedding', 'Black tie', 'Cocktail'] },
  ],
  Footwear: [
    { attributeKey: 'sizeUk', displayName: 'Size (UK)', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['6', '7', '8', '9', '10', '11', '12'] },
    { attributeKey: 'sizeUs', displayName: 'Size (US)', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['7', '8', '9', '10', '11', '12', '13'] },
    { attributeKey: 'sizeEu', displayName: 'Size (EU)', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['40', '41', '42', '43', '44', '45', '46'] },
    { attributeKey: 'shoeType', displayName: 'Type', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Sneakers', 'Loafers', 'Boots', 'Formal', 'Sandals'] },
    { attributeKey: 'material', displayName: 'Material', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Leather', 'Suede', 'Canvas', 'Synthetic', 'Mesh'] },
    { attributeKey: 'sole', displayName: 'Sole', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Rubber', 'TPR', 'PU', 'Leather'] },
    { attributeKey: 'closure', displayName: 'Closure', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Laces', 'Slip-on', 'Velcro', 'Buckle', 'Zip'] },
  ],
  Watches: [
    { attributeKey: 'movement', displayName: 'Movement', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Automatic', 'Quartz', 'Mechanical', 'Smart'] },
    { attributeKey: 'caseMaterial', displayName: 'Case material', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Stainless steel', 'Titanium', 'Gold', 'Ceramic', 'Plastic'] },
    { attributeKey: 'strap', displayName: 'Strap', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Leather', 'Metal', 'Silicone', 'NATO', 'Resin'] },
    { attributeKey: 'dialColor', displayName: 'Dial color', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Black', 'White', 'Blue', 'Green', 'Silver', 'Gold'] },
    { attributeKey: 'waterResistance', displayName: 'Water resistance', filterType: FilterType.SELECT,
      optionsJson: ['30m', '50m', '100m', '200m', '300m+'] },
    { attributeKey: 'caseSize', displayName: 'Case size (mm)', filterType: FilterType.RANGE },
  ],
  Eyewear: [
    { attributeKey: 'frameShape', displayName: 'Frame shape', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Round', 'Square', 'Rectangle', 'Aviator', 'Cat-eye', 'Wayfarer'] },
    { attributeKey: 'frameMaterial', displayName: 'Frame material', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Metal', 'Acetate', 'TR90', 'Titanium', 'Wood'] },
    { attributeKey: 'lensType', displayName: 'Lens type', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Polarized', 'UV400', 'Photochromic', 'Mirrored', 'Gradient'] },
    { attributeKey: 'frameColor', displayName: 'Frame color', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Black', 'Tortoise', 'Gold', 'Silver', 'Brown', 'Clear'] },
  ],
  Accessories: [
    { attributeKey: 'material', displayName: 'Material', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Leather', 'Fabric', 'Metal', 'Synthetic'] },
    { attributeKey: 'color', displayName: 'Color', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Black', 'Brown', 'Tan', 'White', 'Navy', 'Grey'] },
  ],
  Grooming: [
    { attributeKey: 'scentFamily', displayName: 'Scent family', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Woody', 'Citrus', 'Aromatic', 'Oriental', 'Fresh', 'Floral'] },
    { attributeKey: 'concentration', displayName: 'Concentration', filterType: FilterType.SELECT,
      optionsJson: ['EDP', 'EDT', 'Parfum', 'Cologne'] },
    { attributeKey: 'volumeMl', displayName: 'Volume (ml)', filterType: FilterType.RANGE },
    { attributeKey: 'productType', displayName: 'Product type', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Beard oil', 'Shampoo', 'Moisturizer', 'Razor', 'Aftershave'] },
    { attributeKey: 'skinHairType', displayName: 'Skin/hair type', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Oily', 'Dry', 'Combination', 'Sensitive', 'Coarse', 'Fine'] },
  ],
};

async function main() {
  let l1Count = 0;
  let l2Count = 0;
  let schemaCount = 0;

  for (let i = 0; i < TAXONOMY.length; i++) {
    const l1 = TAXONOMY[i];
    const l1Slug = slug(l1.name);
    const l1Cat = await prisma.category.upsert({
      where: { slug: l1Slug },
      create: {
        slug: l1Slug,
        name: l1.name,
        path: l1Slug,
        displayOrder: i,
      },
      update: {
        name: l1.name,
        path: l1Slug,
        displayOrder: i,
      },
    });
    l1Count += 1;

    // Subcategories
    for (let j = 0; j < l1.subcategories.length; j++) {
      const subName = l1.subcategories[j];
      const subSlug = `${l1Slug}-${slug(subName)}`;
      await prisma.category.upsert({
        where: { slug: subSlug },
        create: {
          slug: subSlug,
          name: subName,
          parentId: l1Cat.id,
          path: `${l1Slug}/${slug(subName)}`,
          displayOrder: j,
        },
        update: {
          name: subName,
          parentId: l1Cat.id,
          path: `${l1Slug}/${slug(subName)}`,
          displayOrder: j,
        },
      });
      l2Count += 1;
    }

    // Attribute schemas (attached to L1)
    const schemas = ATTRIBUTES[l1.name] ?? [];
    for (let k = 0; k < schemas.length; k++) {
      const a = schemas[k];
      await prisma.categoryAttributeSchema.upsert({
        where: {
          categoryId_attributeKey: {
            categoryId: l1Cat.id,
            attributeKey: a.attributeKey,
          },
        },
        create: {
          categoryId: l1Cat.id,
          attributeKey: a.attributeKey,
          displayName: a.displayName,
          filterType: a.filterType,
          optionsJson: a.optionsJson ?? undefined,
          displayOrder: k,
        },
        update: {
          displayName: a.displayName,
          filterType: a.filterType,
          optionsJson: a.optionsJson ?? undefined,
          displayOrder: k,
        },
      });
      schemaCount += 1;
    }
  }

  console.log('');
  console.log('Catalog seed complete:');
  console.log(`  L1 categories       : ${l1Count}`);
  console.log(`  L2 subcategories    : ${l2Count}`);
  console.log(`  Attribute schemas   : ${schemaCount}`);
}

main()
  .catch((err) => {
    console.error('Catalog seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
