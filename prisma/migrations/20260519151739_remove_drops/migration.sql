/*
  Warnings:

  - You are about to drop the `drop_notify_signups` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `drop_products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `drops` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "drop_notify_signups" DROP CONSTRAINT "drop_notify_signups_dropId_fkey";

-- DropForeignKey
ALTER TABLE "drop_notify_signups" DROP CONSTRAINT "drop_notify_signups_userId_fkey";

-- DropForeignKey
ALTER TABLE "drop_products" DROP CONSTRAINT "drop_products_dropId_fkey";

-- DropForeignKey
ALTER TABLE "drop_products" DROP CONSTRAINT "drop_products_productId_fkey";

-- DropTable
DROP TABLE "drop_notify_signups";

-- DropTable
DROP TABLE "drop_products";

-- DropTable
DROP TABLE "drops";

-- DropEnum
DROP TYPE "DropStatus";
