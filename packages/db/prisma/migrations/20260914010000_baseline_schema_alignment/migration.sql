-- Milestone 0: align the physical schema produced by historical migrations with schema.prisma.
-- The nullable CatalogProduct.fieldConfidence column already matches `Json?` in schema.prisma.
-- Defaults below were useful while adding required columns to legacy rows, but Prisma owns
-- these values on new writes and schema.prisma intentionally declares no database defaults.
ALTER TABLE "CatalogImport"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "PriceSnapshot"
ALTER COLUMN "origin" DROP DEFAULT,
ALTER COLUMN "confidence" DROP DEFAULT,
ALTER COLUMN "source" DROP DEFAULT;

ALTER TABLE "RankSnapshot"
ALTER COLUMN "origin" DROP DEFAULT,
ALTER COLUMN "confidence" DROP DEFAULT,
ALTER COLUMN "source" DROP DEFAULT;

ALTER TABLE "CompetitionSnapshot"
ALTER COLUMN "origin" DROP DEFAULT,
ALTER COLUMN "confidence" DROP DEFAULT,
ALTER COLUMN "source" DROP DEFAULT,
ALTER COLUMN "amazonOrigin" DROP DEFAULT,
ALTER COLUMN "amazonConfidence" DROP DEFAULT,
ALTER COLUMN "amazonSource" DROP DEFAULT;
