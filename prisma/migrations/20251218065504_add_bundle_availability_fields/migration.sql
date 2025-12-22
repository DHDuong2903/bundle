-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT,
    "discountValue" REAL,
    "shopDomain" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Bundle" ("active", "createdAt", "description", "discountType", "discountValue", "id", "name", "shopDomain", "updatedAt") SELECT "active", "createdAt", "description", "discountType", "discountValue", "id", "name", "shopDomain", "updatedAt" FROM "Bundle";
DROP TABLE "Bundle";
ALTER TABLE "new_Bundle" RENAME TO "Bundle";
CREATE INDEX "Bundle_shopDomain_idx" ON "Bundle"("shopDomain");
CREATE INDEX "Bundle_active_idx" ON "Bundle"("active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
