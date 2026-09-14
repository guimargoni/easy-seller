CREATE TYPE "CatalogReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IGNORED', 'MERGED');
CREATE TYPE "CatalogChangeType" AS ENUM ('NEW_PRODUCT', 'REMOVED_PRODUCT', 'PRICE_INCREASE', 'PRICE_DECREASE', 'BOX_CHANGED', 'BACK_IN_STOCK', 'OUT_OF_STOCK');

ALTER TABLE "CatalogImport"
  ADD COLUMN "sourceFilename" TEXT,
  ADD COLUMN "sourceMimeType" TEXT,
  ADD COLUMN "sourceSizeBytes" INTEGER,
  ADD COLUMN "sourceSha256" TEXT,
  ADD COLUMN "extractionMethod" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CatalogProduct"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CatalogReviewStatus" USING
    CASE WHEN "status" IN ('CONFIRMED', 'IGNORED', 'MERGED') THEN "status"::"CatalogReviewStatus" ELSE 'PENDING'::"CatalogReviewStatus" END,
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ADD COLUMN "overallConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "capitalExposureBasisPoints" INTEGER,
  ADD COLUMN "linkedProductId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "opportunityQueuedAt" TIMESTAMP(3);

CREATE TABLE "CatalogChange" (
  "id" TEXT NOT NULL,
  "catalogId" TEXT NOT NULL,
  "previousCatalogId" TEXT,
  "changeType" "CatalogChangeType" NOT NULL,
  "productKey" TEXT NOT NULL,
  "catalogProductId" TEXT,
  "previousCatalogProductId" TEXT,
  "beforeValue" JSONB,
  "afterValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogImport_status_createdAt_idx" ON "CatalogImport"("status", "createdAt");
CREATE INDEX "CatalogChange_catalogId_changeType_idx" ON "CatalogChange"("catalogId", "changeType");
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CatalogChange" ADD CONSTRAINT "CatalogChange_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogChange" ADD CONSTRAINT "CatalogChange_previousCatalogId_fkey" FOREIGN KEY ("previousCatalogId") REFERENCES "Catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
