/**
 * Removes Eyewear and Grooming categories (plus their subcategories and
 * attribute schemas) from the database.
 *
 * Usage:
 *   pnpm remove:categories
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const SLUGS_TO_REMOVE = ['eyewear', 'grooming'];

async function main() {
  for (const slug of SLUGS_TO_REMOVE) {
    const cat = await prisma.category.findUnique({ where: { slug } });
    if (!cat) {
      console.log(`  "${slug}" not found — skipping`);
      continue;
    }

    // Delete attribute schemas on the L1 category
    await prisma.categoryAttributeSchema.deleteMany({
      where: { categoryId: cat.id },
    });

    // Find and delete subcategories (with their attribute schemas)
    const children = await prisma.category.findMany({
      where: { parentId: cat.id },
    });
    for (const child of children) {
      await prisma.categoryAttributeSchema.deleteMany({
        where: { categoryId: child.id },
      });
      await prisma.category.delete({ where: { id: child.id } });
    }

    // Delete the L1 category itself
    await prisma.category.delete({ where: { id: cat.id } });
    console.log(`  Removed "${slug}" (${children.length} subcategories)`);
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
