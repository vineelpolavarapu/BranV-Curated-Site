-- Two related catalog changes, per the site owner.
--
-- (1) Remove the "Accessories" category and its 8 subcategories entirely.
--     No products reference them (verified against local dev); any that did
--     would be deleted along with them via the same cascade the
--     suits-and-formal removal relied on.
--
-- (2) Add 6 top-level "collection" categories that back the homepage banner
--     landing pages (Sharp Formals, Classic Essentials, Trendy Wear, Sports
--     Wear, Fashion Forward, Easy Casuals). These are real categories so
--     products can be assigned to them exactly like Footwear/Watches, but they
--     are deliberately given a high displayOrder and are hidden from the Shop
--     grid / nav in the frontend — they are reached only via the banner CTAs at
--     bare URLs (e.g. /sharp-formals). Idempotent via ON CONFLICT (slug).
--
-- Slug-based so it runs correctly regardless of environment-specific row ids.

-- ── (1) Remove Accessories ──────────────────────────────────────────────────
DELETE FROM products
WHERE "categoryId" IN (SELECT id FROM categories WHERE slug = 'accessories')
   OR "subcategoryId" IN (
     SELECT id FROM categories WHERE slug = 'accessories' OR slug LIKE 'accessories-%'
   );

DELETE FROM categories
WHERE "parentId" IN (SELECT id FROM categories WHERE slug = 'accessories');

DELETE FROM categories
WHERE slug = 'accessories';

-- ── (2) Add collection categories ───────────────────────────────────────────
INSERT INTO categories (id, "parentId", slug, name, path, "displayOrder", "createdAt", "updatedAt") VALUES
  ('cat_sharp-formals',      NULL, 'sharp-formals',      'Sharp Formals',      'sharp-formals',      50, now(), now()),
  ('cat_classic-essentials', NULL, 'classic-essentials', 'Classic Essentials', 'classic-essentials', 51, now(), now()),
  ('cat_trendy-wear',        NULL, 'trendy-wear',        'Trendy Wear',        'trendy-wear',        52, now(), now()),
  ('cat_sports-wear',        NULL, 'sports-wear',        'Sports Wear',        'sports-wear',        53, now(), now()),
  ('cat_fashion-forward',    NULL, 'fashion-forward',    'Fashion Forward',    'fashion-forward',    54, now(), now()),
  ('cat_easy-casuals',       NULL, 'easy-casuals',       'Easy Casuals',       'easy-casuals',       55, now(), now())
ON CONFLICT (slug) DO NOTHING;
