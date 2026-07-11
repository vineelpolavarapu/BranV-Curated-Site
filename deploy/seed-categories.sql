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
  ('cat_clothing',          NULL, 'clothing',          'Clothing',          'clothing',          0, now(), now()),
  ('cat_shirts',            NULL, 'shirts',            'Shirts',            'shirts',            0, now(), now()),
  ('cat_suits-and-formal',  NULL, 'suits-and-formal',  'Suits & Formal',    'suits-and-formal',  1, now(), now()),
  ('cat_t-shirts',          NULL, 't-shirts',          'T-Shirts',          't-shirts',          1, now(), now()),
  ('cat_jeans',             NULL, 'jeans',             'Jeans',             'jeans',             2, now(), now()),
  ('cat_tracks',            NULL, 'tracks',            'Tracks',            'tracks',            3, now(), now()),
  ('cat_footwear',          NULL, 'footwear',          'Footwear',          'footwear',          4, now(), now()),
  ('cat_accessories',       NULL, 'accessories',       'Accessories',       'accessories',       5, now(), now()),
  ('cat_watches',           NULL, 'watches',           'Watches',           'watches',           5, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- Phase 2: subcategories — parent resolved by slug lookup, so this only
-- needs to run after phase 1 (or any prior run) has created the parents.
INSERT INTO categories (id, "parentId", slug, name, path, "displayOrder", "createdAt", "updatedAt")
SELECT 'cat_' || v.slug, p.id, v.slug, v.name, v.path, v.display_order, now(), now()
FROM (VALUES
  ('accessories', 'accessories-belts',                'Belts',                 'accessories/belts',                0),
  ('accessories', 'accessories-wallets',               'Wallets',               'accessories/wallets',               1),
  ('accessories', 'accessories-bags-and-backpacks',    'Bags & Backpacks',      'accessories/bags-and-backpacks',    2),
  ('accessories', 'accessories-cufflinks',             'Cufflinks',             'accessories/cufflinks',             3),
  ('accessories', 'accessories-caps-and-hats',         'Caps & Hats',           'accessories/caps-and-hats',         4),
  ('accessories', 'accessories-scarves-and-stoles',    'Scarves & Stoles',      'accessories/scarves-and-stoles',    5),
  ('accessories', 'accessories-jewelry',               'Jewelry',               'accessories/jewelry',               6),
  ('accessories', 'accessories-keychains',             'Keychains',             'accessories/keychains',             7),

  ('clothing', 'clothing-t-shirts',                    'T-Shirts',              'clothing/t-shirts',                 0),
  ('clothing', 'clothing-shirts',                       'Shirts',               'clothing/shirts',                   1),
  ('clothing', 'clothing-polos',                        'Polos',                'clothing/polos',                    2),
  ('clothing', 'clothing-jeans',                        'Jeans',                'clothing/jeans',                    3),
  ('clothing', 'clothing-trousers',                     'Trousers',             'clothing/trousers',                 4),
  ('clothing', 'clothing-shorts',                        'Shorts',              'clothing/shorts',                   5),
  ('clothing', 'clothing-jackets',                       'Jackets',             'clothing/jackets',                  6),
  ('clothing', 'clothing-sweaters',                      'Sweaters',            'clothing/sweaters',                 7),
  ('clothing', 'clothing-sweatshirts-and-hoodies',       'Sweatshirts & Hoodies','clothing/sweatshirts-and-hoodies',  8),
  ('clothing', 'clothing-ethnic-wear',                   'Ethnic Wear',         'clothing/ethnic-wear',              9),

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

  ('suits-and-formal', 'suits-and-formal-2-piece-suits',      '2-Piece Suits',    'suits-and-formal/2-piece-suits',      0),
  ('suits-and-formal', 'suits-and-formal-3-piece-suits',      '3-Piece Suits',    'suits-and-formal/3-piece-suits',      1),
  ('suits-and-formal', 'suits-and-formal-blazers',            'Blazers',          'suits-and-formal/blazers',            2),
  ('suits-and-formal', 'suits-and-formal-formal-trousers',    'Formal Trousers',  'suits-and-formal/formal-trousers',    3),
  ('suits-and-formal', 'suits-and-formal-formal-shirts',      'Formal Shirts',    'suits-and-formal/formal-shirts',      4),
  ('suits-and-formal', 'suits-and-formal-ties',               'Ties',             'suits-and-formal/ties',               5),
  ('suits-and-formal', 'suits-and-formal-bow-ties',           'Bow Ties',         'suits-and-formal/bow-ties',           6),
  ('suits-and-formal', 'suits-and-formal-pocket-squares',     'Pocket Squares',   'suits-and-formal/pocket-squares',     7),
  ('suits-and-formal', 'suits-and-formal-suspenders',         'Suspenders',       'suits-and-formal/suspenders',         8),

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
