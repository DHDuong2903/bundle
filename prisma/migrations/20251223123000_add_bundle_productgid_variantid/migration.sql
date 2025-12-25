-- Add bundleProductGid, bundleProductHandle to Bundle and variantId to BundleItem
ALTER TABLE "Bundle" ADD COLUMN "bundleProductGid" TEXT;
ALTER TABLE "Bundle" ADD COLUMN "bundleProductHandle" TEXT;
ALTER TABLE "BundleItem" ADD COLUMN "variantId" TEXT;

-- Optional index for quick lookup by bundleProductGid
CREATE INDEX IF NOT EXISTS "Bundle_bundleProductGid_idx" ON "Bundle"("bundleProductGid");
