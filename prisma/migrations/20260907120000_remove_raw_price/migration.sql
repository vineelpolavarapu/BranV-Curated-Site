/*
  Warnings:

  - You are about to drop the column `rawPrice` on the `product_retailer_listings` table. All the data in the column will be lost.

  Removes the last stored price column reachable by the AI agent's read path
  (see apps/ChatBot/DB-PRD-Gap-Report.md, Finding A). With `rawPrice` gone,
  the catalog physically cannot surface a price to the recommendation agent.
*/
-- AlterTable
-- Idempotent: prod had `rawPrice` removed out-of-band before this migration
-- ran, so a bare `DROP COLUMN` errored ("column ... does not exist") and failed
-- the deploy. `IF EXISTS` makes the drop a no-op when the column is already
-- gone, so the migration applies cleanly regardless of the DB's current state.
ALTER TABLE "product_retailer_listings" DROP COLUMN IF EXISTS "rawPrice";
