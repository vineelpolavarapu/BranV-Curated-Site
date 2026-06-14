-- CreateTable
CREATE TABLE "click_intents" (
    "trackingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "partner" "AffiliatePartner",
    "partnerUrl" TEXT NOT NULL,
    "sourcePageUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_intents_pkey" PRIMARY KEY ("trackingId")
);

-- CreateIndex
CREATE INDEX "click_intents_expiresAt_idx" ON "click_intents"("expiresAt");
