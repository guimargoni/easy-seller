import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertSafeTestEnvironment } from "./test-environment-guard.mjs";

assertSafeTestEnvironment();
const sourceUrl = new URL(process.env.DATABASE_URL);
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
const prismaCli = resolve("node_modules/prisma/build/index.js");
const migrationRoot = resolve("packages/db/prisma/migrations");
const currentMigration = "20260914030000_saas_tenant_foundation_expand";
const previousMigrations = [
  "20260902110000_init",
  "20260903010000_phase_2_product_research",
  "20260903030000_phase_3_supplier_intelligence",
  "20260904010000_phase_4_amazon_intelligence",
  "20260914010000_baseline_schema_alignment",
];

function checkedDatabaseName(label) {
  const name = `easy_seller_m1_${label}_test`;
  if (!/^[a-z0-9_]+_test$/.test(name)) throw new Error("Unsafe migration test database name.");
  return name;
}

function databaseUrl(name) {
  const url = new URL(sourceUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function recreateDatabase(name) {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
}

function deploy(schemaPath, url) {
  const result = spawnSync(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", schemaPath],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`Migration deploy failed.\n${result.stdout}\n${result.stderr}`);
  }
}

async function prepareMigrationDirectory(tempRoot) {
  const prismaRoot = resolve(tempRoot, "prisma");
  const migrations = resolve(prismaRoot, "migrations");
  await mkdir(migrations, { recursive: true });
  await cp(resolve("packages/db/prisma/schema.prisma"), resolve(prismaRoot, "schema.prisma"));
  for (const migration of previousMigrations) {
    await cp(resolve(migrationRoot, migration), resolve(migrations, migration), { recursive: true });
  }
  await cp(resolve(migrationRoot, "migration_lock.toml"), resolve(migrations, "migration_lock.toml"));
  return { schemaPath: resolve(prismaRoot, "schema.prisma"), migrations };
}

async function insertLegacyFixture(db, users) {
  const originalTimestamp = "2025-01-02T03:04:05.000Z";
  for (let index = 1; index <= users; index += 1) {
    const suffix = String(index);
    const fixtureSql = `
      INSERT INTO "User" ("id", "email", "name", "isDemo", "createdAt")
      VALUES ('legacy-user-${suffix}', 'legacy-${suffix}@example.test', 'Usuário Legado', false, '${originalTimestamp}');
      INSERT INTO "UserSettings" ("id", "userId", "updatedAt")
      VALUES ('legacy-settings-${suffix}', 'legacy-user-${suffix}', '${originalTimestamp}');
      INSERT INTO "Supplier" ("id", "userId", "name", "issuesInvoice", "hasCatalog")
      VALUES ('legacy-supplier-${suffix}', 'legacy-user-${suffix}', 'Fornecedor Igual', false, false);
      INSERT INTO "Product" (
        "id", "userId", "name", "strategyType", "status", "historyAvailable",
        "checkedAmazonApproval", "hasValidSupplier", "supplierDocumentAccepted",
        "requiredQuantityViable", "approvalCompletedIfNeeded", "dataOrigin", "createdAt", "updatedAt"
      ) VALUES (
        'legacy-product-${suffix}', 'legacy-user-${suffix}', 'Produto Igual', 'BRANDED_RESELL',
        'RESEARCHING', false, false, false, false, false, false, 'INFERRED',
        '${originalTimestamp}', '${originalTimestamp}'
      );
      INSERT INTO "Analysis" (
        "id", "userId", "productId", "salePriceCents", "productCostCents",
        "totalExpensesCents", "netProfitCents", "marginBasisPoints", "roiBasisPoints",
        "markupBasisPoints", "breakEvenPriceCents", "maxPurchasePriceCents", "score",
        "classification", "scoreComponents", "positives", "warnings", "strategyProfile", "createdAt"
      ) VALUES (
        'legacy-analysis-${suffix}', 'legacy-user-${suffix}', 'legacy-product-${suffix}', 10000, 5000,
        6000, 4000, 4000, 8000, 10000, 6000, 3500, 70, 'TEST', '{}'::jsonb,
        '[]'::jsonb, '[]'::jsonb, 'FAST_CASH', '${originalTimestamp}'
      );
      INSERT INTO "Opportunity" (
        "id", "productId", "score", "marginBasisPoints", "roiBasisPoints",
        "estimatedMonthlySales", "recommendedQty", "maxPurchasePriceCents", "riskLevel",
        "modelVersion", "calculatedAt"
      ) VALUES (
        'legacy-opportunity-${suffix}', 'legacy-product-${suffix}', 70, 2000, 3000, 10, 2,
        4000, 'LOW', 'legacy-test', '${originalTimestamp}'
      );
      INSERT INTO "DecisionLog" ("id", "userId", "productId", "decision", "context", "createdAt")
      VALUES ('legacy-decision-${suffix}', 'legacy-user-${suffix}', 'legacy-product-${suffix}', 'TEST', '{}'::jsonb, '${originalTimestamp}');
      INSERT INTO "Alert" ("id", "userId", "type", "severity", "title", "message", "createdAt")
      VALUES ('legacy-alert-${suffix}', 'legacy-user-${suffix}', 'TEST', 'LOW', 'Alerta Igual', 'Fixture', '${originalTimestamp}');
    `;
    for (const statement of fixtureSql.split(/;\s*(?:\r?\n|$)/).map((value) => value.trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement);
    }
  }
  return originalTimestamp;
}

async function validateBackfill(db, users, originalTimestamp) {
  const counts = await db.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM "Organization") AS organizations,
      (SELECT COUNT(*)::int FROM "Membership" WHERE "role" = 'OWNER') AS owners,
      (SELECT COUNT(*)::int FROM "AuditLog" WHERE "action" = 'MIGRATION.ORGANIZATION_BACKFILLED') AS audits,
      ((SELECT COUNT(*) FROM "Product" WHERE "organizationId" IS NULL) +
       (SELECT COUNT(*) FROM "Supplier" WHERE "organizationId" IS NULL) +
       (SELECT COUNT(*) FROM "Analysis" WHERE "organizationId" IS NULL) +
       (SELECT COUNT(*) FROM "Opportunity" WHERE "organizationId" IS NULL) +
       (SELECT COUNT(*) FROM "DecisionLog" WHERE "organizationId" IS NULL) +
       (SELECT COUNT(*) FROM "Alert" WHERE "organizationId" IS NULL))::int AS missing,
      (SELECT COUNT(*)::int FROM "Product" WHERE "id" LIKE 'legacy-product-%') AS products,
      (SELECT COUNT(*)::int FROM "Product" WHERE "createdAt" = '${originalTimestamp}'::timestamp) AS timestamps
  `);
  const result = counts[0];
  if (result.organizations !== users || result.owners !== users || result.audits !== users ||
      result.missing !== 0 || result.products !== users || result.timestamps !== users) {
    throw new Error(`Invalid backfill result: ${JSON.stringify(result)}`);
  }
}

async function runScenario(label, users) {
  const name = checkedDatabaseName(label);
  const url = databaseUrl(name);
  await mkdir(resolve(".runtime"), { recursive: true });
  const tempRoot = await mkdtemp(resolve(".runtime", `tenant-migration-test-${label}-`));
  let db;
  try {
    await recreateDatabase(name);
    const paths = await prepareMigrationDirectory(tempRoot);
    deploy(paths.schemaPath, url);
    db = new PrismaClient({ datasourceUrl: url });
    const timestamp = await insertLegacyFixture(db, users);
    await db.$disconnect();
    db = undefined;
    await cp(resolve(migrationRoot, currentMigration), resolve(paths.migrations, currentMigration), { recursive: true });
    deploy(paths.schemaPath, url);
    db = new PrismaClient({ datasourceUrl: url });
    await validateBackfill(db, users, timestamp);
    console.log(`Tenant migration ${label}: PASS (${users} usuário(s), IDs/timestamps preservados, zero órfãos).`);
  } finally {
    await db?.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    const resolvedTemp = resolve(tempRoot);
    const runtimeRoot = resolve(".runtime");
    const runtimeRelativePath = relative(runtimeRoot, resolvedTemp);
    if (runtimeRelativePath.startsWith("..") || !runtimeRelativePath.startsWith("tenant-migration-test-")) {
      throw new Error("Refusing to remove an unexpected migration test directory.");
    }
    await rm(resolvedTemp, { recursive: true, force: true });
  }
}

try {
  await runScenario("seed", 1);
  await runScenario("snapshot", 2);
} finally {
  await admin.$disconnect();
}
