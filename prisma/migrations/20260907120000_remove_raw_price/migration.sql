/*
  Warnings:

  - You are about to drop the column `rawPrice` on the `product_retailer_listings` table. All the data in the column will be lost.

  Removes the last stored price column reachable by the AI agent's read path
  (see apps/ChatBot/DB-PRD-Gap-Report.md, Finding A). With `rawPrice` gone,
  the catalog physically cannot surface a price to the recommendation agent.
*/
-- AlterTable
ALTER TABLE "product_retailer_listings" DROP COLUMN "rawPrice";
