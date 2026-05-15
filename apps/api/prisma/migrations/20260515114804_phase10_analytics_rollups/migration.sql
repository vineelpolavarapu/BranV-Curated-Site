-- CreateTable
CREATE TABLE "analytics_daily_clicks" (
    "day" DATE NOT NULL,
    "productId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "partner" "AffiliatePartner",
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_clicks_pkey" PRIMARY KEY ("day","productId","retailer")
);

-- CreateTable
CREATE TABLE "analytics_daily_conversions" (
    "day" DATE NOT NULL,
    "productId" TEXT NOT NULL,
    "selfReportedPurchases" INTEGER NOT NULL DEFAULT 0,
    "selfReportedBrowsing" INTEGER NOT NULL DEFAULT 0,
    "selfReportedNeedsHelp" INTEGER NOT NULL DEFAULT 0,
    "estimatedCommissionInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reconciledCommissionInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_conversions_pkey" PRIMARY KEY ("day","productId")
);

-- CreateTable
CREATE TABLE "analytics_content_perf" (
    "day" DATE NOT NULL,
    "surfaceType" TEXT NOT NULL,
    "surfaceSlug" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "selfReportedConversions" INTEGER NOT NULL DEFAULT 0,
    "reconciledCommissionInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_content_perf_pkey" PRIMARY KEY ("day","surfaceType","surfaceSlug")
);

-- CreateIndex
CREATE INDEX "analytics_daily_clicks_day_idx" ON "analytics_daily_clicks"("day");

-- CreateIndex
CREATE INDEX "analytics_daily_clicks_productId_idx" ON "analytics_daily_clicks"("productId");

-- CreateIndex
CREATE INDEX "analytics_daily_conversions_day_idx" ON "analytics_daily_conversions"("day");

-- CreateIndex
CREATE INDEX "analytics_content_perf_day_idx" ON "analytics_content_perf"("day");

-- CreateIndex
CREATE INDEX "analytics_content_perf_surfaceType_day_idx" ON "analytics_content_perf"("surfaceType", "day");
