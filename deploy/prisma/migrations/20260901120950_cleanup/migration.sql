/*
  Warnings:

  - You are about to drop the column `dispatchedAt` on the `notification_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledFor` on the `notification_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `notification_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `notification_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `syncFailedSince` on the `product_retailer_listings` table. All the data in the column will be lost.
  - You are about to drop the column `avgRating` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `discountPct` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `mrp` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `reviewCount` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `affiliate_payout_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `affiliate_payouts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `analytics_content_perf` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `analytics_daily_clicks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `analytics_daily_conversions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `article_products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `avatars` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `home_banners` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lookbook_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lookbook_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lookbooks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `newsletter_subscribers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reviews` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "affiliate_payout_items" DROP CONSTRAINT "affiliate_payout_items_matchedClickEventId_fkey";

-- DropForeignKey
ALTER TABLE "affiliate_payout_items" DROP CONSTRAINT "affiliate_payout_items_payoutId_fkey";

-- DropForeignKey
ALTER TABLE "affiliate_payouts" DROP CONSTRAINT "affiliate_payouts_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "article_products" DROP CONSTRAINT "article_products_articleId_fkey";

-- DropForeignKey
ALTER TABLE "article_products" DROP CONSTRAINT "article_products_productId_fkey";

-- DropForeignKey
ALTER TABLE "lookbook_images" DROP CONSTRAINT "lookbook_images_lookbookId_fkey";

-- DropForeignKey
ALTER TABLE "lookbook_tags" DROP CONSTRAINT "lookbook_tags_lookbookImageId_fkey";

-- DropForeignKey
ALTER TABLE "lookbook_tags" DROP CONSTRAINT "lookbook_tags_productId_fkey";

-- DropForeignKey
ALTER TABLE "newsletter_subscribers" DROP CONSTRAINT "newsletter_subscribers_userId_fkey";

-- DropForeignKey
ALTER TABLE "product_category_links" DROP CONSTRAINT "product_category_links_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "product_category_links" DROP CONSTRAINT "product_category_links_productId_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_productId_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_userId_fkey";

-- DropIndex
DROP INDEX "notification_outbox_status_scheduledFor_idx";

-- DropIndex
DROP INDEX "users_email_idx";

-- AlterTable
ALTER TABLE "notification_outbox" DROP COLUMN "dispatchedAt",
DROP COLUMN "scheduledFor",
DROP COLUMN "type",
DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "product_retailer_listings" DROP COLUMN "syncFailedSince";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "avgRating",
DROP COLUMN "currency",
DROP COLUMN "discountPct",
DROP COLUMN "mrp",
DROP COLUMN "price",
DROP COLUMN "reviewCount";

-- DropTable
DROP TABLE "affiliate_payout_items";

-- DropTable
DROP TABLE "affiliate_payouts";

-- DropTable
DROP TABLE "analytics_content_perf";

-- DropTable
DROP TABLE "analytics_daily_clicks";

-- DropTable
DROP TABLE "analytics_daily_conversions";

-- DropTable
DROP TABLE "article_products";

-- DropTable
DROP TABLE "avatars";

-- DropTable
DROP TABLE "home_banners";

-- DropTable
DROP TABLE "lookbook_images";

-- DropTable
DROP TABLE "lookbook_tags";

-- DropTable
DROP TABLE "lookbooks";

-- DropTable
DROP TABLE "newsletter_subscribers";

-- DropTable
DROP TABLE "reviews";

-- DropEnum
DROP TYPE "AffiliatePayoutItemStatus";

-- DropEnum
DROP TYPE "HomeBannerStatus";

-- DropEnum
DROP TYPE "LookbookStatus";

-- DropEnum
DROP TYPE "NewsletterStatus";

-- DropEnum
DROP TYPE "ReviewStatus";

-- CreateIndex
CREATE INDEX "notification_outbox_status_idx" ON "notification_outbox"("status");

-- CreateIndex
CREATE INDEX "product_images_productId_isPrimary_idx" ON "product_images"("productId", "isPrimary");

-- CreateIndex
CREATE INDEX "product_retailer_listings_productId_availabilityStatus_idx" ON "product_retailer_listings"("productId", "availabilityStatus");

-- CreateIndex
CREATE INDEX "products_subcategoryId_idx" ON "products"("subcategoryId");

-- CreateIndex
CREATE INDEX "products_status_categoryId_createdAt_idx" ON "products"("status", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "products_status_brandId_createdAt_idx" ON "products"("status", "brandId", "createdAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- AddForeignKey
ALTER TABLE "product_category_links" ADD CONSTRAINT "product_category_links_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category_links" ADD CONSTRAINT "product_category_links_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ix_product_category_links_categoryid" RENAME TO "product_category_links_categoryId_idx";
