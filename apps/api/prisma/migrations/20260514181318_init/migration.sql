-- CreateEnum
CREATE TYPE "DropStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LookbookStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EditStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HomeBannerStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "BrandStoryStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "drops" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "heroUrl" TEXT,
    "description" TEXT,
    "launchAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "DropStatus" NOT NULL DEFAULT 'SCHEDULED',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drop_products" (
    "id" TEXT NOT NULL,
    "dropId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drop_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drop_notify_signups" (
    "id" TEXT NOT NULL,
    "dropId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drop_notify_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookbooks" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "heroUrl" TEXT,
    "description" TEXT,
    "status" "LookbookStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookbook_images" (
    "id" TEXT NOT NULL,
    "lookbookId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookbook_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookbook_tags" (
    "id" TEXT NOT NULL,
    "lookbookImageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "xPercent" DECIMAL(5,2) NOT NULL,
    "yPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookbook_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edits" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "heroUrl" TEXT,
    "description" TEXT,
    "status" "EditStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeaturedOnHome" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edit_products" (
    "id" TEXT NOT NULL,
    "editId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edit_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_banners" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "headline" TEXT,
    "ctaLabel" TEXT,
    "ctaLink" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "HomeBannerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_stories" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "heroUrl" TEXT,
    "bodyMd" TEXT NOT NULL DEFAULT '',
    "status" "BrandStoryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drops_slug_key" ON "drops"("slug");

-- CreateIndex
CREATE INDEX "drops_status_launchAt_idx" ON "drops"("status", "launchAt");

-- CreateIndex
CREATE INDEX "drops_launchAt_idx" ON "drops"("launchAt");

-- CreateIndex
CREATE INDEX "drop_products_dropId_idx" ON "drop_products"("dropId");

-- CreateIndex
CREATE UNIQUE INDEX "drop_products_dropId_productId_key" ON "drop_products"("dropId", "productId");

-- CreateIndex
CREATE INDEX "drop_notify_signups_dropId_notifiedAt_idx" ON "drop_notify_signups"("dropId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "drop_notify_signups_dropId_email_key" ON "drop_notify_signups"("dropId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "lookbooks_slug_key" ON "lookbooks"("slug");

-- CreateIndex
CREATE INDEX "lookbooks_status_idx" ON "lookbooks"("status");

-- CreateIndex
CREATE INDEX "lookbook_images_lookbookId_idx" ON "lookbook_images"("lookbookId");

-- CreateIndex
CREATE INDEX "lookbook_tags_lookbookImageId_idx" ON "lookbook_tags"("lookbookImageId");

-- CreateIndex
CREATE UNIQUE INDEX "edits_slug_key" ON "edits"("slug");

-- CreateIndex
CREATE INDEX "edits_status_idx" ON "edits"("status");

-- CreateIndex
CREATE INDEX "edits_isFeaturedOnHome_idx" ON "edits"("isFeaturedOnHome");

-- CreateIndex
CREATE INDEX "edit_products_editId_idx" ON "edit_products"("editId");

-- CreateIndex
CREATE UNIQUE INDEX "edit_products_editId_productId_key" ON "edit_products"("editId", "productId");

-- CreateIndex
CREATE INDEX "home_banners_status_displayOrder_idx" ON "home_banners"("status", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "brand_stories_brandId_key" ON "brand_stories"("brandId");

-- AddForeignKey
ALTER TABLE "drop_products" ADD CONSTRAINT "drop_products_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "drops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_products" ADD CONSTRAINT "drop_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_notify_signups" ADD CONSTRAINT "drop_notify_signups_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "drops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_notify_signups" ADD CONSTRAINT "drop_notify_signups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookbook_images" ADD CONSTRAINT "lookbook_images_lookbookId_fkey" FOREIGN KEY ("lookbookId") REFERENCES "lookbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookbook_tags" ADD CONSTRAINT "lookbook_tags_lookbookImageId_fkey" FOREIGN KEY ("lookbookImageId") REFERENCES "lookbook_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookbook_tags" ADD CONSTRAINT "lookbook_tags_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_products" ADD CONSTRAINT "edit_products_editId_fkey" FOREIGN KEY ("editId") REFERENCES "edits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_products" ADD CONSTRAINT "edit_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_stories" ADD CONSTRAINT "brand_stories_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
