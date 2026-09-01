-- Remove the "Suits & Formal" category and its 9 subcategories entirely.
-- The site owner no longer wants this category. Any products still filed
-- under it (or one of its subcategories) are deleted along with it, not
-- reassigned, per explicit instruction. Cascading FKs (product_images,
-- product_variants, product_retailer_listings -> affiliate_links,
-- reviews, wishlist_items, click_events -> self_reported_conversions,
-- edit_products, article_products, lookbook_tags) clean up automatically.
-- wardrobe_items.productId is ON DELETE RESTRICT, but no wardrobe entries
-- reference these products at time of writing (verified against local dev).
--
-- Written slug-based (not id-based) so it runs correctly regardless of
-- environment-specific row ids (local dev vs. the deterministic
-- deploy/seed-categories.sql ids used elsewhere).

DELETE FROM products
WHERE "categoryId" IN (SELECT id FROM categories WHERE slug = 'suits-and-formal')
   OR "subcategoryId" IN (
     SELECT id FROM categories WHERE slug = 'suits-and-formal' OR slug LIKE 'suits-and-formal-%'
   );

-- Subcategories first (categories.parentId is ON DELETE RESTRICT).
DELETE FROM categories
WHERE "parentId" IN (SELECT id FROM categories WHERE slug = 'suits-and-formal');

-- Then the top-level category itself.
DELETE FROM categories
WHERE slug = 'suits-and-formal';
