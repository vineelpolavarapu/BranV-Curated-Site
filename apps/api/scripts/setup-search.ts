/**
 * One-time post-migration setup for full-text + trigram search on products.
 *
 * Idempotent: re-running is safe. Run after every `pnpm db:migrate` that
 * touches `products`, `brands`, or related tables, since the trigger needs
 * the columns to exist.
 *
 * Usage:
 *   pnpm setup:search
 *
 * Per PRD §19.2 / §4 (Phase 4 spec):
 *   - `pg_trgm` extension for fuzzy search ("shrit" → "shirt")
 *   - `tsvector` column on products covering title + brand name + tags + description
 *   - GIN index on the tsvector for FTS
 *   - GIN index on `products.tags` for tag filtering
 *   - Trigger that refreshes search_vector on insert/update
 *   - Backfill for existing rows
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function exec(label: string, sql: string) {
  process.stdout.write(`• ${label} … `);
  await prisma.$executeRawUnsafe(sql);
  console.log('ok');
}

async function main() {
  console.log('Setting up product search infrastructure…\n');

  await exec('enable pg_trgm extension', `CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  await exec(
    'add products.search_vector column',
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;`,
  );

  await exec(
    'GIN index on search_vector',
    `CREATE INDEX IF NOT EXISTS products_search_vector_idx
       ON products USING GIN (search_vector);`,
  );

  await exec(
    'GIN trigram index on title',
    `CREATE INDEX IF NOT EXISTS products_title_trgm_idx
       ON products USING GIN (title gin_trgm_ops);`,
  );

  await exec(
    'GIN trigram index on brand name',
    `CREATE INDEX IF NOT EXISTS brands_name_trgm_idx
       ON brands USING GIN (name gin_trgm_ops);`,
  );

  await exec(
    'GIN index on tags array',
    `CREATE INDEX IF NOT EXISTS products_tags_gin_idx
       ON products USING GIN (tags);`,
  );

  await exec(
    'search_vector trigger function',
    `
    CREATE OR REPLACE FUNCTION products_search_vector_refresh()
    RETURNS trigger AS $$
    DECLARE
      brand_name TEXT := '';
    BEGIN
      SELECT b.name INTO brand_name
      FROM brands b
      WHERE b.id = NEW."brandId";

      NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(brand_name, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    `,
  );

  await exec(
    'drop existing trigger (if any)',
    `DROP TRIGGER IF EXISTS products_search_vector_update ON products;`,
  );

  await exec(
    'create insert/update trigger',
    `
    CREATE TRIGGER products_search_vector_update
    BEFORE INSERT OR UPDATE OF title, description, tags, "brandId" ON products
    FOR EACH ROW EXECUTE FUNCTION products_search_vector_refresh();
    `,
  );

  // Backfill — bump updatedAt so the trigger refreshes search_vector for
  // every existing row. This will pass through the trigger.
  await exec(
    'backfill search_vector for existing rows',
    `UPDATE products SET title = title;`,
  );

  console.log('\nDone. FTS + trigram search ready.');
}

main()
  .catch((err) => {
    console.error('setup-search failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
