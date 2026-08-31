-- Ensure the Inners, Sweatshirts and Hoodies categories (and their
-- subcategories) exist in every environment.
--
-- Root cause of the /inners, /sweatshirts, /hoodies 404s: the frontend
-- landing pages and SHOP_CATEGORIES already reference these three
-- categories, but the category *rows* were only ever seeded for the
-- earlier categories (shirts/jeans/...). The public API resolves the
-- landing page by slug (`GET /categories/{slug}`) and returns 404 when the
-- row is missing, which the Next.js page surfaces via notFound().
--
-- This migration carries the data forward automatically through the normal
-- `prisma migrate deploy` pipeline so production no longer depends on the
-- one-off deploy/seed-categories.sql being run by hand.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING, safe to re-run.

-- Phase 1: top-level categories (no parent)
INSERT INTO categories (id, "parentId", slug, name, path, "displayOrder", "createdAt", "updatedAt") VALUES
  ('cat_inners',      NULL, 'inners',      'Inners',      'inners',      9,  now(), now()),
  ('cat_sweatshirts', NULL, 'sweatshirts', 'Sweatshirts', 'sweatshirts', 10, now(), now()),
  ('cat_hoodies',     NULL, 'hoodies',     'Hoodies',     'hoodies',     11, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- Phase 2: subcategories - parent resolved by slug lookup.
INSERT INTO categories (id, "parentId", slug, name, path, "displayOrder", "createdAt", "updatedAt")
SELECT 'cat_' || v.slug, p.id, v.slug, v.name, v.path, v.display_order, now(), now()
FROM (VALUES
  ('inners', 'inners-banniens', 'Banniens / Vests', 'inners/banniens', 0),
  ('inners', 'inners-briefs',   'Briefs',           'inners/briefs',   1),
  ('inners', 'inners-trunks',   'Trunks',           'inners/trunks',   2),
  ('inners', 'inners-boxers',   'Boxers',           'inners/boxers',   3),
  ('inners', 'inners-thermals', 'Thermals',         'inners/thermals', 4),

  ('sweatshirts', 'sweatshirts-crew-neck-sweatshirts', 'Crew Neck Sweatshirts', 'sweatshirts/crew-neck-sweatshirts', 0),
  ('sweatshirts', 'sweatshirts-oversized-sweatshirts', 'Oversized Sweatshirts', 'sweatshirts/oversized-sweatshirts', 1),
  ('sweatshirts', 'sweatshirts-fleece-sweatshirts',    'Fleece Sweatshirts',    'sweatshirts/fleece-sweatshirts',    2),
  ('sweatshirts', 'sweatshirts-printed-sweatshirts',   'Printed Sweatshirts',   'sweatshirts/printed-sweatshirts',   3),

  ('hoodies', 'hoodies-pullover-hoodies',  'Pullover Hoodies',  'hoodies/pullover-hoodies',  0),
  ('hoodies', 'hoodies-zip-up-hoodies',    'Zip-Up Hoodies',    'hoodies/zip-up-hoodies',    1),
  ('hoodies', 'hoodies-oversized-hoodies', 'Oversized Hoodies', 'hoodies/oversized-hoodies', 2),
  ('hoodies', 'hoodies-fleece-hoodies',    'Fleece Hoodies',    'hoodies/fleece-hoodies',    3)
) AS v(parent_slug, slug, name, path, display_order)
JOIN categories p ON p.slug = v.parent_slug
ON CONFLICT (slug) DO NOTHING;
