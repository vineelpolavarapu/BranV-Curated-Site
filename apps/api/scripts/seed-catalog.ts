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
    name: 'Shirts',
    subcategories: [
      'Half Sleeves', 'Full Sleeves', 'Checks', 'Printed', 'Formals',
    ],
  },
  {
    name: 'T-Shirts',
    subcategories: [
      'Polo T-Shirts', 'Full Neck T-Shirts', 'Collar T-Shirts',
    ],
  },
  {
    name: 'Jeans',
    subcategories: [
      'Baggy Jeans', 'Formal Jeans', 'Cotton Jeans', 'Slim Fit',
    ],
  },
  {
    name: 'Tracks',
    subcategories: [
      'Joggers', 'Slim Fit Tracks', 'Zipper Tracks', 'Cotton Tracks',
      'Sports Tracks', 'Printed Tracks', 'Lounge Tracks',
    ],
  },
  {
    name: 'Footwear',
    subcategories: [
      'Sneakers', 'Loafers', 'Formal Shoes', 'Boots',
      'Sandals & Slippers', 'Sports Shoes', 'Chappals',
    ],
  },
  {
    name: 'Watches',
    subcategories: [
      'Digital', 'Analog', 'Classical', 'Strap Watches', 'Chained Watches',
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
  Shirts: [
    { attributeKey: 'size', displayName: 'Size', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
    { attributeKey: 'fit', displayName: 'Fit', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Slim', 'Regular', 'Relaxed', 'Oversized'] },
    { attributeKey: 'material', displayName: 'Material', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Cotton', 'Linen', 'Polyester', 'Blend'] },
    { attributeKey: 'sleeve', displayName: 'Sleeve', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Half', 'Full', '3/4'] },
    { attributeKey: 'pattern', displayName: 'Pattern', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Solid', 'Striped', 'Checked', 'Printed', 'Graphic'] },
    { attributeKey: 'occasion', displayName: 'Occasion', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Casual', 'Work', 'Party', 'Wedding', 'Festive'] },
  ],
  'T-Shirts': [
    { attributeKey: 'size', displayName: 'Size', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
    { attributeKey: 'fit', displayName: 'Fit', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Regular', 'Slim', 'Oversized'] },
    { attributeKey: 'material', displayName: 'Material', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Cotton', 'Polyester', 'Blend', 'Jersey'] },
    { attributeKey: 'neckType', displayName: 'Neck Type', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Round Neck', 'Polo', 'Collar', 'Henley', 'V-Neck'] },
    { attributeKey: 'pattern', displayName: 'Pattern', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Solid', 'Graphic', 'Printed', 'Striped'] },
  ],
  Jeans: [
    { attributeKey: 'waistSize', displayName: 'Waist Size', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['28', '30', '32', '34', '36', '38', '40'] },
    { attributeKey: 'length', displayName: 'Length', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['30', '32', '34', '36'] },
    { attributeKey: 'fit', displayName: 'Fit', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Baggy', 'Slim', 'Regular', 'Skinny', 'Straight'] },
    { attributeKey: 'rise', displayName: 'Rise', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['High Rise', 'Mid Rise', 'Low Rise'] },
    { attributeKey: 'wash', displayName: 'Wash', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Raw', 'Light', 'Medium', 'Dark', 'Distressed'] },
  ],
  Tracks: [
    { attributeKey: 'size', displayName: 'Size', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
    { attributeKey: 'fit', displayName: 'Fit', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Slim', 'Regular', 'Relaxed', 'Baggy'] },
    { attributeKey: 'material', displayName: 'Material', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Cotton', 'Polyester', 'Blend', 'Terry', 'Fleece'] },
    { attributeKey: 'closure', displayName: 'Closure', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Elastic', 'Drawstring', 'Zipper'] },
    { attributeKey: 'pattern', displayName: 'Pattern', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Solid', 'Printed', 'Striped', 'Colour Block'] },
    { attributeKey: 'occasion', displayName: 'Occasion', filterType: FilterType.MULTI_SELECT,
      optionsJson: ['Sports', 'Casual', 'Lounge', 'Gym'] },
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
