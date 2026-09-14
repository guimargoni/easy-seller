-- Phase 2: product research workflow, configurable comparison criteria and approval controls.
ALTER TYPE "OpportunityStatus" ADD VALUE IF NOT EXISTS 'CANDIDATE';
ALTER TYPE "OpportunityStatus" ADD VALUE IF NOT EXISTS 'RESEARCH';
ALTER TYPE "OpportunityStatus" ADD VALUE IF NOT EXISTS 'VALIDATION';
ALTER TYPE "OpportunityStatus" ADD VALUE IF NOT EXISTS 'READY_TO_BUY';

CREATE TYPE "BrandApprovalStatus" AS ENUM ('UNKNOWN', 'NOT_REQUIRED', 'REQUIRED', 'APPROVED', 'REJECTED');
CREATE TYPE "AmazonApprovalStatus" AS ENUM ('NOT_CHECKED', 'OPEN', 'REQUIRES_INVOICE', 'REQUIRES_10_UNITS', 'REQUIRES_LOA', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'UNAVAILABLE');

ALTER TABLE "UserSettings"
ADD COLUMN "maximumSellerCount" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "Product"
ADD COLUMN "researchOrigin" TEXT,
ADD COLUMN "ratingBasisPoints" INTEGER,
ADD COLUMN "reviewCount" INTEGER,
ADD COLUMN "historyAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "estimatedTurnoverDays" INTEGER,
ADD COLUMN "observations" TEXT,
ADD COLUMN "brandApprovalStatus" "BrandApprovalStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "amazonApprovalStatus" "AmazonApprovalStatus" NOT NULL DEFAULT 'NOT_CHECKED',
ADD COLUMN "approvalCheckedAt" TIMESTAMP(3),
ADD COLUMN "approvalNotes" TEXT,
ADD COLUMN "approvalRequiredQuantity" INTEGER,
ADD COLUMN "approvalDocumentType" TEXT,
ADD COLUMN "checkedAmazonApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasValidSupplier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "supplierDocumentAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requiredQuantityViable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "approvalCompletedIfNeeded" BOOLEAN NOT NULL DEFAULT false;
