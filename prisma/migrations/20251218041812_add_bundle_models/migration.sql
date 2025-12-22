-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT,
    "discountValue" REAL,
    "shopDomain" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "shopDomain" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Bundle_shopDomain_idx" ON "Bundle"("shopDomain");

-- CreateIndex
CREATE INDEX "Bundle_active_idx" ON "Bundle"("active");

-- CreateIndex
CREATE INDEX "BundleItem_bundleId_idx" ON "BundleItem"("bundleId");

-- CreateIndex
CREATE INDEX "BundleItem_productId_idx" ON "BundleItem"("productId");

-- CreateIndex
CREATE INDEX "Campaign_bundleId_idx" ON "Campaign"("bundleId");

-- CreateIndex
CREATE INDEX "Campaign_shopDomain_idx" ON "Campaign"("shopDomain");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
