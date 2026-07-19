-- One-off seed for production's empty `categories` table.
-- Root cause of the shirts/jeans/etc. 404s: the pipeline only ever applied
-- schema migrations to production, never the category *data* that exists in
-- local dev (created there via the admin panel or an earlier manual step).
-- Values below are pulled directly from the local dev database so slugs,
-- names, paths, and ordering match what the frontend already links to.
-- Idempotent — ON CONFLICT (slug) DO NOTHING, safe to re-run.

BEGIN;

-- Phase 1: top-level categories (no parent)
INSERT INTO categories (id, "parentId", slug, name, path, "displayOrder", "createdAt", "updatedAt") VALUES
  ('cat_shirts',            NULL, 'shirts',            'Shirts',            'shirts',            0, now(), now()),
  ('cat_t-shirts',          NULL, 't-shirts',          'T-Shirts',          't-shirts',          1, now(), now()),
  ('cat_jeans',             NULL, 'jeans',             'Jeans',             'jeans',             2, now(), now()),
  ('cat_tracks',            NULL, 'tracks',            'Tracks',            'tracks',            3, now(), now()),
  ('cat_footwear',          NULL, 'footwear',          'Footwear',          'footwear',          4, now(), now()),
  ('cat_watches',           NULL, 'watches',           'Watches',           'watches',           5, now(), now()),
  ('cat_trousers',                NULL, 'trousers',                'Trousers',              'trousers',                6,  now(), now()),
  ('cat_shorts',                  NULL, 'shorts',                  'Shorts',                'shorts',                  7,  now(), now()),
  ('cat_jackets',                 NULL, 'jackets',                 'Jackets',               'jackets',                 8,  now(), now()),
  ('cat_sweaters',                NULL, 'sweaters',                'Sweaters',              'sweaters',                9,  now(), now()),
  ('cat_sweatshirts-and-hoodies', NULL, 'sweatshirts-and-hoodies', 'Sweatshirts & Hoodies', 'sweatshirts-and-hoodies', 10, now(), now()),
  ('cat_ethnic-wear',             NULL, 'ethnic-wear',             'Ethnic Wear',           'ethnic-wear',             11, now(), now()),
  -- Collection categories (banner landing pages). Real categories so products
  -- can be assigned to them, but hidden from the Shop grid / nav in the
  -- frontend and reached only via the homepage banner CTAs at bare URLs.
  ('cat_sharp-formals',      NULL, 'sharp-formals',      'Sharp Formals',      'sharp-formals',      50, now(), now()),
  ('cat_classic-essentials', NULL, 'classic-essentials', 'Classic Essentials', 'classic-essentials', 51, now(), now()),
  ('cat_trendy-wear',        NULL, 'trendy-wear',        'Trendy Wear',        'trendy-wear',        52, now(), now()),
  ('cat_sports-wear',        NULL, 'sports-wear',        'Sports Wear',        'sports-wear',        53, now(), now()),
  ('cat_fashion-forward',    NULL, 'fashion-forward',    'Fashion Forward',    'fashion-forward',    54, now(), now()),
  ('cat_easy-casuals',       NULL, 'easy-casuals',       'Easy Casuals',       'easy-casuals',       55, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- Phase 2: subcategories — parent resolved by slug lookup, so this only
-- needs to run after phase 1 (or any prior run) has created the parents.
INSERT INTO categories (id, "parentId", slug, name, path, "displayOrder", "createdAt", "updatedAt")
SELECT 'cat_' || v.slug, p.id, v.slug, v.name, v.path, v.display_order, now(), now()
FROM (VALUES
  ('footwear', 'footwear-sneakers',                     'Sneakers',             'footwear/sneakers',                 0),
  ('footwear', 'footwear-loafers',                      'Loafers',              'footwear/loafers',                  1),
  ('footwear', 'footwear-formal-shoes',                 'Formal Shoes',         'footwear/formal-shoes',             2),
  ('footwear', 'footwear-boots',                        'Boots',                'footwear/boots',                    3),
  ('footwear', 'footwear-sandals-and-slippers',         'Sandals & Slippers',   'footwear/sandals-and-slippers',     4),
  ('footwear', 'footwear-sports-shoes',                 'Sports Shoes',         'footwear/sports-shoes',             5),
  ('footwear', 'footwear-chappals',                     'Chappals',             'footwear/chappals',                 6),

  ('jeans', 'jeans-baggy-jeans',                        'Baggy Jeans',          'jeans/baggy-jeans',                 0),
  ('jeans', 'jeans-formal-jeans',                       'Formal Jeans',         'jeans/formal-jeans',                1),
  ('jeans', 'jeans-cotton-jeans',                       'Cotton Jeans',         'jeans/cotton-jeans',                2),
  ('jeans', 'jeans-slim-fit',                           'Slim Fit',             'jeans/slim-fit',                    3),

  ('shirts', 'shirts-half-sleeves',                     'Half Sleeves',         'shirts/half-sleeves',               0),
  ('shirts', 'shirts-full-sleeves',                     'Full Sleeves',         'shirts/full-sleeves',                1),
  ('shirts', 'shirts-checks',                           'Checks',               'shirts/checks',                     2),
  ('shirts', 'shirts-printed',                          'Printed',              'shirts/printed',                    3),
  ('shirts', 'shirts-formals',                          'Formals',              'shirts/formals',                    4),

  ('t-shirts', 't-shirts-polo-t-shirts',                 'Polo T-Shirts',        't-shirts/polo-t-shirts',            0),
  ('t-shirts', 't-shirts-full-neck-t-shirts',             'Full Neck T-Shirts',  't-shirts/full-neck-t-shirts',        1),
  ('t-shirts', 't-shirts-collar-t-shirts',                'Collar T-Shirts',     't-shirts/collar-t-shirts',           2),

  ('tracks', 'tracks-joggers',                           'Joggers',              'tracks/joggers',                    0),
  ('tracks', 'tracks-slim-fit-tracks',                    'Slim Fit Tracks',     'tracks/slim-fit-tracks',             1),
  ('tracks', 'tracks-zipper-tracks',                      'Zipper Tracks',       'tracks/zipper-tracks',               2),
  ('tracks', 'tracks-cotton-tracks',                       'Cotton Tracks',      'tracks/cotton-tracks',                3),
  ('tracks', 'tracks-sports-tracks',                       'Sports Tracks',      'tracks/sports-tracks',                4),
  ('tracks', 'tracks-printed-tracks',                      'Printed Tracks',     'tracks/printed-tracks',               5),
  ('tracks', 'tracks-lounge-tracks',                       'Lounge Tracks',      'tracks/lounge-tracks',                6),

  ('watches', 'watches-digital',                          'Digital',             'watches/digital',                    0),
  ('watches', 'watches-analog',                            'Analog',             'watches/analog',                     1),
  ('watches', 'watches-classical',                         'Classical',          'watches/classical',                  2),
  ('watches', 'watches-smartwatches',                      'Smartwatches',       'watches/smartwatches',                2),
  ('watches', 'watches-luxury',                            'Luxury',             'watches/luxury',                     3),
  ('watches', 'watches-strap-watches',                     'Strap Watches',      'watches/strap-watches',               3),
  ('watches', 'watches-chained-watches',                   'Chained Watches',    'watches/chained-watches',             4),
  ('watches', 'watches-chronographs',                      'Chronographs',       'watches/chronographs',                4)
) AS v(parent_slug, slug, name, path, display_order)
JOIN categories p ON p.slug = v.parent_slug
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- Verify:
--   SELECT count(*) FROM categories;   -- should be 70
