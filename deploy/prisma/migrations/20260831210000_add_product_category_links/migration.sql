-- Product ⇄ Category many-to-many visibility links.
--
-- The Product model carries a single primary `categoryId` (+ optional
-- `subcategoryId`), which is not enough to express "this product should also
-- appear on these other category / collection landing pages". The admin
-- product form has a "Product Visibility - select categories this product
-- appears in" checkbox group, but there was no table to persist those
-- selections, so ticking the boxes did nothing.
--
-- This join table stores the extra category surfaces a product appears on.
-- The storefront category listing (`GET /products?category=<slug>`) unions
-- these links with the primary category/subcategory match.
--
-- Idempotent: IF NOT EXISTS, safe to re-run.

CREATE TABLE IF NOT EXISTS product_category_links (
  "productId"  TEXT NOT NULL REFERENCES products (id)   ON DELETE CASCADE,
  "categoryId" TEXT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("productId", "categoryId")
);

CREATE INDEX IF NOT EXISTS ix_product_category_links_categoryId
  ON product_category_links ("categoryId");
