-- AlterTable: nullable column so existing rows are unaffected.
ALTER TABLE "products" ADD COLUMN "featuredUntil" TIMESTAMP(3);

-- Index used by /home category sections to sort featured-first.
CREATE INDEX "products_featuredUntil_idx" ON "products"("featuredUntil");
