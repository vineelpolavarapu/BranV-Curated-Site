-- AlterTable
ALTER TABLE "product_retailer_listings" ADD COLUMN     "syncFailedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncFailedSince" TIMESTAMP(3);
