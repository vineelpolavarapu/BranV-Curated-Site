-- CreateEnum
CREATE TYPE "ClickReportOutcome" AS ENUM ('PURCHASED', 'BROWSING', 'NEEDS_HELP');

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "partner" "AffiliatePartner",
    "partnerUrl" TEXT NOT NULL,
    "sourcePageUrl" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "ipCountry" TEXT,
    "utm" JSONB,
    "redirectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_reported_conversions" (
    "id" TEXT NOT NULL,
    "clickEventId" TEXT NOT NULL,
    "userId" TEXT,
    "outcome" "ClickReportOutcome" NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_reported_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "click_events_trackingId_key" ON "click_events"("trackingId");

-- CreateIndex
CREATE INDEX "click_events_productId_idx" ON "click_events"("productId");

-- CreateIndex
CREATE INDEX "click_events_userId_idx" ON "click_events"("userId");

-- CreateIndex
CREATE INDEX "click_events_redirectedAt_idx" ON "click_events"("redirectedAt");

-- CreateIndex
CREATE INDEX "self_reported_conversions_clickEventId_idx" ON "self_reported_conversions"("clickEventId");

-- CreateIndex
CREATE INDEX "self_reported_conversions_userId_idx" ON "self_reported_conversions"("userId");

-- CreateIndex
CREATE INDEX "self_reported_conversions_outcome_idx" ON "self_reported_conversions"("outcome");

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_reported_conversions" ADD CONSTRAINT "self_reported_conversions_clickEventId_fkey" FOREIGN KEY ("clickEventId") REFERENCES "click_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_reported_conversions" ADD CONSTRAINT "self_reported_conversions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
