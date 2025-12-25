/*
  Warnings:

  - You are about to drop the column `bundleProductHandle` on the `Bundle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BundleItem" ADD COLUMN "available" BOOLEAN;
ALTER TABLE "BundleItem" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "BundleItem" ADD COLUMN "price" REAL;
ALTER TABLE "BundleItem" ADD COLUMN "productTitle" TEXT;
ALTER TABLE "BundleItem" ADD COLUMN "variantTitle" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bundle" (
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
    "originalTotalPrice" REAL,
    "bundlePrice" REAL,
    "bundleProductGid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Bundle" ("active", "bundleProductGid", "createdAt", "description", "discountType", "discountValue", "endDate", "id", "imageUrl", "name", "shopDomain", "startDate", "updatedAt") SELECT "active", "bundleProductGid", "createdAt", "description", "discountType", "discountValue", "endDate", "id", "imageUrl", "name", "shopDomain", "startDate", "updatedAt" FROM "Bundle";
DROP TABLE "Bundle";
ALTER TABLE "new_Bundle" RENAME TO "Bundle";
CREATE INDEX "Bundle_shopDomain_idx" ON "Bundle"("shopDomain");
CREATE INDEX "Bundle_active_idx" ON "Bundle"("active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
