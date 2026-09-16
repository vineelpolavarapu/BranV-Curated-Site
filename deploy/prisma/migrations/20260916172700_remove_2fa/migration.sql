/*
  Warnings:

  - You are about to drop the columns `totpSecret` and `totpEnabled` on the
    `users` table. All data in these columns will be lost.

  Removes the abandoned 2FA/TOTP feature completely: the authenticator secret
  and enrollment flag. The feature was functionally dead (login never
  validated TOTP codes) but `enforce_two_factor` still 403-blocked admin
  actions for admins without an enrollment. No data worth preserving.
*/
-- AlterTable
-- Idempotent: IF EXISTS makes the drop a no-op when a column is already
-- gone (e.g. removed out-of-band), so the migration applies cleanly
-- regardless of the DB's current state (see remove_raw_price precedent).
ALTER TABLE "users" DROP COLUMN IF EXISTS "totpSecret";
ALTER TABLE "users" DROP COLUMN IF EXISTS "totpEnabled";