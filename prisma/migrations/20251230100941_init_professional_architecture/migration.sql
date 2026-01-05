-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "discountType" TEXT,
    "discountValue" REAL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "shopDomain" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "originalTotalPrice" REAL,
    "bundlePrice" REAL,
    "bundleProductGid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "icon" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "bgColor" TEXT NOT NULL DEFAULT '#000000',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "position" TEXT NOT NULL DEFAULT 'top-left',
    "shape" TEXT NOT NULL DEFAULT 'rounded',
    "showOnPDP" BOOLEAN NOT NULL DEFAULT true,
    "showOnCollection" BOOLEAN NOT NULL DEFAULT true,
    "shopDomain" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BundleLabel" (
    "bundleId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    PRIMARY KEY ("bundleId", "labelId"),
    CONSTRAINT "BundleLabel_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundleLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "productTitle" TEXT,
    "variantTitle" TEXT,
    "price" REAL,
    "imageUrl" TEXT,
    "available" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Bundle_shopDomain_idx" ON "Bundle"("shopDomain");

-- CreateIndex
CREATE INDEX "Bundle_active_idx" ON "Bundle"("active");

-- CreateIndex
CREATE INDEX "Label_shopDomain_idx" ON "Label"("shopDomain");

-- CreateIndex
CREATE INDEX "BundleLabel_bundleId_idx" ON "BundleLabel"("bundleId");

-- CreateIndex
CREATE INDEX "BundleLabel_labelId_idx" ON "BundleLabel"("labelId");

-- CreateIndex
CREATE INDEX "BundleItem_bundleId_idx" ON "BundleItem"("bundleId");

-- CreateIndex
CREATE INDEX "BundleItem_productId_idx" ON "BundleItem"("productId");
