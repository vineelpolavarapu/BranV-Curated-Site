-- AlterEnum: Cuelinks is no longer the affiliate-conversion provider (admins
-- now paste an already-affiliate-wrapped URL directly). Add MEESHO so pasted
-- retailer links can be labeled by network for payout reconciliation.
-- `ALTER TYPE ... ADD VALUE` cannot run inside the same transaction that
-- later uses the new value, so this migration only adds it — no other
-- statements in this file.
ALTER TYPE "AffiliatePartner" ADD VALUE 'MEESHO';
