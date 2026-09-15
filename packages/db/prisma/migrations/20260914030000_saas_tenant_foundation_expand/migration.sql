-- Milestone 1 / Slice 1: expand ownership without removing legacy userId columns.
CREATE TYPE "MembershipRole" AS ENUM (
  'OWNER', 'ADMIN', 'FINANCE', 'OPERATIONS', 'ADS_MANAGER', 'ANALYST', 'VIEWER'
);

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cnpj" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "taxRegime" TEXT,
  "fiscalSettings" JSONB,
  "isMigrationDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Analysis" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "DecisionLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Alert" ADD COLUMN "organizationId" TEXT;

CREATE UNIQUE INDEX "Membership_userId_organizationId_key"
  ON "Membership"("userId", "organizationId");
CREATE INDEX "Membership_organizationId_role_idx"
  ON "Membership"("organizationId", "role");
CREATE INDEX "AuditLog_organizationId_createdAt_idx"
  ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx"
  ON "AuditLog"("organizationId", "entityType", "entityId");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx"
  ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "Product_organizationId_name_idx"
  ON "Product"("organizationId", "name");
CREATE INDEX "Supplier_organizationId_name_idx"
  ON "Supplier"("organizationId", "name");
CREATE INDEX "Analysis_organizationId_createdAt_idx"
  ON "Analysis"("organizationId", "createdAt");
CREATE INDEX "Opportunity_organizationId_calculatedAt_idx"
  ON "Opportunity"("organizationId", "calculatedAt");
CREATE INDEX "DecisionLog_organizationId_createdAt_idx"
  ON "DecisionLog"("organizationId", "createdAt");
CREATE INDEX "Alert_organizationId_createdAt_idx"
  ON "Alert"("organizationId", "createdAt");

ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId")
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Analysis"
  ADD CONSTRAINT "Analysis_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionLog"
  ADD CONSTRAINT "DecisionLog_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alert"
  ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deterministic identifiers make the backfill safe if its transaction is retried.
INSERT INTO "Organization" (
  "id", "name", "timezone", "currency", "isMigrationDefault", "createdAt", "updatedAt"
)
SELECT
  'legacy-org-' || md5(u."id"),
  COALESCE(NULLIF(u."name", ''), u."email") || ' — Organização',
  'America/Sao_Paulo',
  'BRL',
  true,
  u."createdAt",
  CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Membership" (
  "id", "userId", "organizationId", "role", "createdAt", "updatedAt"
)
SELECT
  'legacy-membership-' || md5(u."id"),
  u."id",
  'legacy-org-' || md5(u."id"),
  'OWNER'::"MembershipRole",
  u."createdAt",
  CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("userId", "organizationId") DO NOTHING;

UPDATE "Product" SET "organizationId" = 'legacy-org-' || md5("userId")
WHERE "organizationId" IS NULL;
UPDATE "Supplier" SET "organizationId" = 'legacy-org-' || md5("userId")
WHERE "organizationId" IS NULL;
UPDATE "Analysis" SET "organizationId" = 'legacy-org-' || md5("userId")
WHERE "organizationId" IS NULL;
UPDATE "DecisionLog" SET "organizationId" = 'legacy-org-' || md5("userId")
WHERE "organizationId" IS NULL;
UPDATE "Alert" SET "organizationId" = 'legacy-org-' || md5("userId")
WHERE "organizationId" IS NULL;
UPDATE "Opportunity" o SET "organizationId" = p."organizationId"
FROM "Product" p
WHERE o."productId" = p."id" AND o."organizationId" IS NULL;

INSERT INTO "AuditLog" (
  "id", "organizationId", "actorUserId", "action", "entityType", "entityId", "metadata", "createdAt"
)
SELECT
  'legacy-audit-' || md5(u."id"),
  'legacy-org-' || md5(u."id"),
  u."id",
  'MIGRATION.ORGANIZATION_BACKFILLED',
  'Organization',
  'legacy-org-' || md5(u."id"),
  jsonb_build_object('source', 'milestone1_slice1'),
  CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

-- Validate the expand/backfill before any later contract migration can add NOT NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Organization" o
    WHERE NOT EXISTS (
      SELECT 1 FROM "Membership" m
      WHERE m."organizationId" = o."id" AND m."role" = 'OWNER'
    )
  ) THEN
    RAISE EXCEPTION 'tenant backfill validation failed: organization without OWNER';
  END IF;

  IF EXISTS (SELECT 1 FROM "Product" WHERE "organizationId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Supplier" WHERE "organizationId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Analysis" WHERE "organizationId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Opportunity" WHERE "organizationId" IS NULL)
    OR EXISTS (SELECT 1 FROM "DecisionLog" WHERE "organizationId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Alert" WHERE "organizationId" IS NULL)
  THEN
    RAISE EXCEPTION 'tenant backfill validation failed: private row without organization';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Analysis" a JOIN "Product" p ON p."id" = a."productId"
    WHERE a."organizationId" <> p."organizationId"
  ) OR EXISTS (
    SELECT 1 FROM "Opportunity" o JOIN "Product" p ON p."id" = o."productId"
    WHERE o."organizationId" <> p."organizationId"
  ) OR EXISTS (
    SELECT 1 FROM "DecisionLog" d JOIN "Product" p ON p."id" = d."productId"
    WHERE d."organizationId" <> p."organizationId"
  ) THEN
    RAISE EXCEPTION 'tenant backfill validation failed: indirect ownership divergence';
  END IF;
END $$;
