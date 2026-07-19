-- Remove the "Clothing" category and its subcategories entirely, and promote
-- six of its former subcategories to standalone top-level categories, per the
-- site owner.
--
-- (1) The 7 products filed directly under Clothing are deleted along with it
--     (owner's choice), same cascade the suits-and-formal / accessories
--     removals relied on.
-- (2) Add Trousers, Shorts, Jackets, Sweaters, Sweatshirts & Hoodies, and
--     Ethnic Wear as new top-level categories (clean slugs, no parent). These
--     previously existed only as clothing-* subcategories, which are removed
--     with Clothing in step 1.
--
-- Slug-based so it runs correctly regardless of environment-specific row ids.

-- ── (1) Remove Clothing (products first, then subcategories, then parent) ────
DELETE FROM products
WHERE "categoryId" IN (SELECT id FROM categories WHERE slug = 'clothing')
   OR "subcategoryId" IN (
     SELECT id FROM categories WHERE slug = 'clothing' OR slug LIKE 'clothing-%'
   );

DELETE FROM categories
WHERE "parentId" IN (SELECT id FROM categories WHERE slug = 'clothing');

DELETE FROM categories
WHERE slug = 'clothing';

-- ── (2) Add the promoted top-level categories ───────────────────────────────
INSERT INTO categories (id, "parentId", slug, name, path, "displayOrder", "createdAt", "updatedAt") VALUES
  ('cat_trousers',                NULL, 'trousers',                'Trousers',              'trousers',                6,  now(), now()),
  ('cat_shorts',                  NULL, 'shorts',                  'Shorts',                'shorts',                  7,  now(), now()),
  ('cat_jackets',                 NULL, 'jackets',                 'Jackets',               'jackets',                 8,  now(), now()),
  ('cat_sweaters',                NULL, 'sweaters',                'Sweaters',              'sweaters',                9,  now(), now()),
  ('cat_sweatshirts-and-hoodies', NULL, 'sweatshirts-and-hoodies', 'Sweatshirts & Hoodies', 'sweatshirts-and-hoodies', 10, now(), now()),
  ('cat_ethnic-wear',             NULL, 'ethnic-wear',             'Ethnic Wear',           'ethnic-wear',             11, now(), now())
ON CONFLICT (slug) DO NOTHING;
