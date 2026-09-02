-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('TEST', 'APPROVED', 'DISCARDED', 'WATCHING');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CatalogSourceType" AS ENUM ('PDF_UPLOAD', 'EXTERNAL_URL', 'QR_CODE', 'CSV', 'XLSX', 'MANUAL');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('AUTO_CONFIRMED', 'NEEDS_REVIEW', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DataOrigin" AS ENUM ('REAL', 'ESTIMATED', 'INFERRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "ean" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonListing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "asin" TEXT NOT NULL,
    "url" TEXT,
    "origin" "DataOrigin" NOT NULL DEFAULT 'INFERRED',

    CONSTRAINT "AmazonListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "cnpj" TEXT,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "city" TEXT,
    "state" TEXT,
    "segment" TEXT,
    "issuesInvoice" BOOLEAN NOT NULL DEFAULT false,
    "minimumOrderCents" INTEGER,
    "leadTimeDays" INTEGER,
    "paymentTerms" TEXT,
    "shippingNotes" TEXT,
    "notes" TEXT,
    "lastContactAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT,
    "supplierSku" TEXT,
    "costCents" INTEGER NOT NULL,
    "stock" INTEGER,
    "minimumQty" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "buyBoxPriceCents" INTEGER,
    "shippingCents" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "salesRank" INTEGER NOT NULL,
    "subcategoryRank" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionSnapshot" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerCount" INTEGER NOT NULL,
    "fbaSellerCount" INTEGER,
    "amazonIsSeller" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "marginBasisPoints" INTEGER NOT NULL,
    "roiBasisPoints" INTEGER NOT NULL,
    "estimatedMonthlySales" INTEGER NOT NULL,
    "estimatedDaysToSell" INTEGER,
    "recommendedQty" INTEGER NOT NULL,
    "maxPurchasePriceCents" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "CatalogSourceType" NOT NULL,
    "sourceFile" TEXT,
    "sourceUrl" TEXT,
    "catalogDate" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ImportStatus" NOT NULL,
    "totalPages" INTEGER,
    "totalDetectedProducts" INTEGER NOT NULL DEFAULT 0,
    "totalValidatedProducts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogImport" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "currentPage" INTEGER,
    "totalPages" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "CatalogImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "ean" TEXT,
    "gtin" TEXT,
    "rawName" TEXT,
    "normalizedName" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "variant" TEXT,
    "color" TEXT,
    "voltage" TEXT,
    "unitPriceCents" INTEGER,
    "unitsPerBox" INTEGER,
    "minimumBoxes" INTEGER,
    "minimumUnits" INTEGER,
    "minimumInvestmentCents" INTEGER,
    "availability" TEXT,
    "pageNumber" INTEGER,
    "imageUrl" TEXT,
    "imageCropData" JSONB,
    "rawText" TEXT,
    "fieldConfidence" JSONB,
    "extractionConfidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMatch" (
    "id" TEXT NOT NULL,
    "catalogProductId" TEXT NOT NULL,
    "amazonAsin" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "matchMethod" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL,

    CONSTRAINT "ProductMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProductPrice" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "unitsPerBox" INTEGER,
    "minimumQty" INTEGER,
    "catalogId" TEXT,
    "validFrom" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Product_userId_name_idx" ON "Product"("userId", "name");

-- CreateIndex
CREATE INDEX "AmazonListing_asin_idx" ON "AmazonListing"("asin");

-- CreateIndex
CREATE UNIQUE INDEX "AmazonListing_productId_asin_key" ON "AmazonListing"("productId", "asin");

-- CreateIndex
CREATE INDEX "Supplier_userId_name_idx" ON "Supplier"("userId", "name");

-- CreateIndex
CREATE INDEX "SupplierProduct_supplierId_supplierSku_idx" ON "SupplierProduct"("supplierId", "supplierSku");

-- CreateIndex
CREATE INDEX "PriceSnapshot_listingId_timestamp_idx" ON "PriceSnapshot"("listingId", "timestamp");

-- CreateIndex
CREATE INDEX "RankSnapshot_listingId_timestamp_idx" ON "RankSnapshot"("listingId", "timestamp");

-- CreateIndex
CREATE INDEX "CompetitionSnapshot_listingId_timestamp_idx" ON "CompetitionSnapshot"("listingId", "timestamp");

-- CreateIndex
CREATE INDEX "Opportunity_productId_calculatedAt_idx" ON "Opportunity"("productId", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_supplierId_version_key" ON "Catalog"("supplierId", "version");

-- CreateIndex
CREATE INDEX "CatalogProduct_catalogId_supplierSku_idx" ON "CatalogProduct"("catalogId", "supplierSku");

-- CreateIndex
CREATE INDEX "CatalogProduct_ean_idx" ON "CatalogProduct"("ean");

-- CreateIndex
CREATE INDEX "SupplierProductPrice_supplierProductId_observedAt_idx" ON "SupplierProductPrice"("supplierProductId", "observedAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonListing" ADD CONSTRAINT "AmazonListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "AmazonListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "AmazonListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionSnapshot" ADD CONSTRAINT "CompetitionSnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "AmazonListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogImport" ADD CONSTRAINT "CatalogImport_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatch" ADD CONSTRAINT "ProductMatch_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductPrice" ADD CONSTRAINT "SupplierProductPrice_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductPrice" ADD CONSTRAINT "SupplierProductPrice_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
