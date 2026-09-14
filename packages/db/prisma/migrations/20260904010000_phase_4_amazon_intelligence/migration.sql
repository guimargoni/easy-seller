CREATE TYPE "DataConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

ALTER TABLE "AmazonListing"
ADD COLUMN "title" TEXT,
ADD COLUMN "brand" TEXT,
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "ratingBasisPoints" INTEGER,
ADD COLUMN "reviewCount" INTEGER,
ADD COLUMN "historyAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "catalogOrigin" "DataOrigin",
ADD COLUMN "catalogConfidence" "DataConfidence",
ADD COLUMN "catalogSource" TEXT,
ADD COLUMN "catalogObservedAt" TIMESTAMP(3);

ALTER TABLE "PriceSnapshot"
ADD COLUMN "origin" "DataOrigin" NOT NULL DEFAULT 'INFERRED',
ADD COLUMN "confidence" "DataConfidence" NOT NULL DEFAULT 'LOW',
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN';

ALTER TABLE "RankSnapshot"
ADD COLUMN "category" TEXT,
ADD COLUMN "origin" "DataOrigin" NOT NULL DEFAULT 'INFERRED',
ADD COLUMN "confidence" "DataConfidence" NOT NULL DEFAULT 'LOW',
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN';

ALTER TABLE "CompetitionSnapshot"
ADD COLUMN "origin" "DataOrigin" NOT NULL DEFAULT 'INFERRED',
ADD COLUMN "confidence" "DataConfidence" NOT NULL DEFAULT 'LOW',
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN',
ADD COLUMN "amazonOrigin" "DataOrigin" NOT NULL DEFAULT 'INFERRED',
ADD COLUMN "amazonConfidence" "DataConfidence" NOT NULL DEFAULT 'LOW',
ADD COLUMN "amazonSource" TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN';
