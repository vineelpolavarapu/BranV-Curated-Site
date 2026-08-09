-- AlterTable: custom display label for a retailer listing, used when
-- `retailer` is 'other' (or otherwise unmapped by the frontend's known-retailer
-- list) so "Buy on {}" can show an admin-chosen name instead of falling back
-- to the raw retailer key.
ALTER TABLE "product_retailer_listings" ADD COLUMN "retailerDisplayName" TEXT;

-- Seed a fallback Brand so "brandId" can stay a required, non-null FK while
-- the New Product admin form allows leaving Brand blank. Idempotent - safe
-- to re-run across environments.
INSERT INTO "brands" ("id", "slug", "name", "status", "isFeatured", "createdAt", "updatedAt")
VALUES ('brand_unbranded_fallback', 'unbranded', 'Unbranded', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
