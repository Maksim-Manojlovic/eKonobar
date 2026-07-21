-- Remove the waiter paid-subscription product (PassportTier: FREE | PRO | PRO_PLUS).
--
-- Data loss is intended and irreversible: the four WaiterPassport subscription
-- columns are dropped. PassportPayment rows are KEPT for accounting history, so
-- its `tier` column is converted from the enum to plain text before the enum type
-- is dropped (existing values 'FREE' / 'PRO' / 'PRO_PLUS' are preserved as strings).

-- DropIndex
DROP INDEX "WaiterPassport_passportTier_idx";

-- DropIndex
DROP INDEX "WaiterPassport_tierRank_score_idx";

-- AlterTable
ALTER TABLE "WaiterPassport"
  DROP COLUMN "passportTier",
  DROP COLUMN "subscriptionExpiresAt",
  DROP COLUMN "monriPanToken",
  DROP COLUMN "tierRank";

-- CreateIndex
CREATE INDEX "WaiterPassport_score_idx" ON "WaiterPassport"("score");

-- AlterTable: keep historical payment rows, drop the enum dependency
ALTER TABLE "PassportPayment" ALTER COLUMN "tier" TYPE TEXT USING "tier"::TEXT;

-- DropEnum
DROP TYPE "PassportTier";
