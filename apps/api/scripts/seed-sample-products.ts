/**
 * Seeds 5 dummy products per top-level (L1) category so the home page
 * CategoryShowcase rows have something to render before real products exist.
 *
 * Idempotent: products use deterministic slugs (`sample-<categorySlug>-<n>`);
 * re-runs upsert by slug. Creates a "BranV Samples" brand if one is needed.
 *
 * Usage:
 *   pnpm seed:samples
 *
 * To remove all sample products later:
 *   - Delete via /admin/products UI (Archive sets status=ARCHIVED, which the
 *     home query filters out), OR
 *   - DELETE FROM products WHERE slug LIKE 'sample-%';
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { BrandStatus, PrismaClient, ProductStatus } from '@prisma/client';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const SAMPLE_BRAND = {
  name: 'BranV Samples',
  slug: 'branv-samples',
};

// Per-category placeholder product titles + a representative image URL.
// Unsplash photo IDs are stable; replace with your own assets later.
const SAMPLES: Record<
  string,
  Array<{ title: string; price: number; mrp: number; imageUrl: string }>
> = {
  clothing: [
    { title: 'Classic Cotton Crew Tee', price: 1290, mrp: 1690, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Linen Camp-Collar Shirt', price: 2490, mrp: 2990, imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Slim Fit Chino Trousers', price: 2790, mrp: 3290, imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Lightweight Bomber Jacket', price: 4490, mrp: 5490, imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Heavyweight Hoodie', price: 2990, mrp: 3490, imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1000&q=80' },
  ],
  'suits-and-formal': [
    { title: 'Two-Piece Wool Suit', price: 12990, mrp: 15990, imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Tailored Navy Blazer', price: 6990, mrp: 8490, imageUrl: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Formal Cotton Shirt', price: 1790, mrp: 2290, imageUrl: 'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Silk Necktie — Solid', price: 1290, mrp: 1690, imageUrl: 'https://images.unsplash.com/photo-1589363460779-cd717a8e26a8?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Pleated Formal Trousers', price: 2490, mrp: 2990, imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1000&q=80' },
  ],
  footwear: [
    { title: 'Leather Derby Shoes', price: 4990, mrp: 5990, imageUrl: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Minimal White Sneakers', price: 3490, mrp: 4290, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Suede Penny Loafers', price: 4290, mrp: 4990, imageUrl: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Performance Running Shoes', price: 5490, mrp: 6490, imageUrl: 'https://images.unsplash.com/photo-1542219550-37153d387c27?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Chelsea Boots — Black', price: 5990, mrp: 6990, imageUrl: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=1000&q=80' },
  ],
  watches: [
    { title: 'Automatic Skeleton Watch', price: 12490, mrp: 14990, imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Minimalist Quartz', price: 4990, mrp: 5990, imageUrl: 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Chronograph Sport', price: 8990, mrp: 10990, imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Smartwatch Series 7', price: 18990, mrp: 22990, imageUrl: 'https://images.unsplash.com/photo-1551816230-ef5deaed4a26?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Luxury Gold Dial', price: 24990, mrp: 28990, imageUrl: 'https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Leather Bifold Wallet', price: 1990, mrp: 2490, imageUrl: 'https://images.unsplash.com/photo-1517254797898-04edd251bfb3?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Reversible Leather Belt', price: 1690, mrp: 1990, imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Canvas Backpack', price: 3490, mrp: 3990, imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Silver Cufflinks Set', price: 1290, mrp: 1690, imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=1000&q=80' },
    { title: 'Wool Beanie', price: 890, mrp: 1190, imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1000&q=80' },
  ],
};

async function main() {
  // 1. Ensure a brand exists for sample products.
  const brand = await prisma.brand.upsert({
    where: { slug: SAMPLE_BRAND.slug },
    create: {
      slug: SAMPLE_BRAND.slug,
      name: SAMPLE_BRAND.name,
      status: BrandStatus.ACTIVE,
    },
    update: {},
  });

  // 2. Walk all L1 categories that we have sample data for.
  const l1Categories = await prisma.category.findMany({
    where: { parentId: null },
    select: { id: true, slug: true, name: true },
  });

  if (l1Categories.length === 0) {
    console.error(
      'No L1 categories found. Run `pnpm seed:catalog` first to seed the taxonomy.',
    );
    process.exit(1);
  }

  let created = 0;
  let updated = 0;

  for (const cat of l1Categories) {
    const samples = SAMPLES[cat.slug];
    if (!samples) continue;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const slug = `sample-${cat.slug}-${i + 1}`;
      const discountPct =
        s.mrp > s.price ? Number(((1 - s.price / s.mrp) * 100).toFixed(2)) : null;

      const existing = await prisma.product.findUnique({ where: { slug } });
      if (existing) {
        await prisma.product.update({
          where: { slug },
          data: {
            title: s.title,
            price: s.price,
            mrp: s.mrp,
            discountPct,
          },
        });
        updated += 1;
      } else {
        await prisma.product.create({
          data: {
            slug,
            title: s.title,
            brandId: brand.id,
            categoryId: cat.id,
            price: s.price,
            mrp: s.mrp,
            discountPct,
            status: ProductStatus.ACTIVE,
            tags: ['sample'],
            variants: {
              create: [{ isDefault: true, attributes: {} }],
            },
            images: {
              create: [
                {
                  url: s.imageUrl,
                  isPrimary: true,
                  isAiGenerated: false,
                  position: 0,
                  altText: s.title,
                },
              ],
            },
          },
        });
        created += 1;
      }
    }
  }

  console.log('');
  console.log('Sample product seed complete:');
  console.log(`  Brand               : ${brand.name} (${brand.slug})`);
  console.log(`  Created             : ${created}`);
  console.log(`  Updated             : ${updated}`);
  console.log('');
  console.log('Delete from /admin/products (Archive) or:');
  console.log(`  DELETE FROM products WHERE slug LIKE 'sample-%';`);
}

main()
  .catch((err) => {
    console.error('Sample product seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
