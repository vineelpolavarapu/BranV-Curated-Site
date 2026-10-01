-- Migration: Remove inners completely and add missing subcategories (Graphic Tees, Oversized Tees, Straight Fit)
-- Idempotent and safe to run in any environment.

BEGIN;

-- 1. Cleanly remove Inners and its subcategories from all tables
DELETE FROM product_category_links
WHERE "categoryId" IN (SELECT id FROM categories WHERE slug = 'inners' OR slug LIKE 'inners-%');

DELETE FROM products
WHERE "categoryId" IN (SELECT id FROM categories WHERE slug = 'inners')
   OR "subcategoryId" IN (SELECT id FROM categories WHERE slug = 'inners' OR slug LIKE 'inners-%');

DELETE FROM category_attribute_schemas
WHERE "categoryId" IN (SELECT id FROM categories WHERE slug = 'inners' OR slug LIKE 'inners-%');

DELETE FROM categories
WHERE "parentId" IN (SELECT id FROM categories WHERE slug = 'inners');

DELETE FROM categories
WHERE slug = 'inners' OR slug LIKE 'inners-%';

-- 2. Add missing subcategories for T-Shirts and Jeans (and ensure all SHOP_CATEGORIES subcategories exist)
INSERT INTO categories (id, "parentId", slug, name, path, "displayOrder", "createdAt", "updatedAt")
SELECT 'cat_' || v.slug, p.id, v.slug, v.name, v.path, v.display_order, now(), now()
FROM (VALUES
  ('t-shirts', 't-shirts-graphic-tees',   'Graphic Tees',   't-shirts/graphic-tees',   3),
  ('t-shirts', 't-shirts-oversized-tees', 'Oversized Tees', 't-shirts/oversized-tees', 4),
  ('jeans',    'jeans-straight-fit',      'Straight Fit',   'jeans/straight-fit',      4)
) AS v(parent_slug, slug, name, path, display_order)
JOIN categories p ON p.slug = v.parent_slug
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    path = EXCLUDED.path,
    "displayOrder" = EXCLUDED."displayOrder",
    "updatedAt" = now();

COMMIT;
