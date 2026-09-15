import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { assertSafeTestEnvironment } from "./test-environment-guard.mjs";

const target = assertSafeTestEnvironment();
const prisma = new PrismaClient();
const expectedMigrations = [
  "20260902110000_init",
  "20260903010000_phase_2_product_research",
  "20260903030000_phase_3_supplier_intelligence",
  "20260904010000_phase_4_amazon_intelligence",
  "20260914010000_baseline_schema_alignment",
  "20260914030000_saas_tenant_foundation_expand",
];
const expectedTables = [
  "Alert", "AmazonListing", "Analysis", "AuditLog", "Catalog", "CatalogChange",
  "CatalogImport", "CatalogProduct", "CompetitionSnapshot", "DecisionLog", "Membership",
  "Opportunity", "Organization", "PriceSnapshot", "Product", "ProductMatch", "RankSnapshot",
  "Supplier", "SupplierProduct", "SupplierProductPrice", "User", "UserSettings",
];

try {
  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY migration_name
  `;
  const applied = migrations
    .filter((row) => row.finished_at && !row.rolled_back_at)
    .map((row) => row.migration_name);
  if (JSON.stringify(applied) !== JSON.stringify(expectedMigrations)) {
    throw new Error(`DB_CHECK: migrations divergentes: ${applied.join(", ")}`);
  }
  const failed = migrations.filter((row) => !row.finished_at && !row.rolled_back_at);
  if (failed.length) throw new Error(`DB_CHECK: ${failed.length} migration(s) incompleta(s).`);

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  const actualTables = tables.map((row) => row.table_name).filter((name) => name !== "_prisma_migrations");
  if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables)) {
    throw new Error(`DB_CHECK: tabelas divergentes: ${actualTables.join(", ")}`);
  }

  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'CatalogProduct' AND column_name = 'fieldConfidence') OR
        (table_name = 'CatalogImport' AND column_name = 'updatedAt') OR
        (table_name IN ('PriceSnapshot', 'RankSnapshot', 'CompetitionSnapshot')
          AND column_name IN ('origin', 'confidence', 'source', 'amazonOrigin', 'amazonConfidence', 'amazonSource'))
      )
  `;
  const confidence = columns.find((row) => row.table_name === "CatalogProduct" && row.column_name === "fieldConfidence");
  if (!confidence || confidence.is_nullable !== "YES") {
    throw new Error("DB_CHECK: CatalogProduct.fieldConfidence não corresponde ao Json? do Prisma.");
  }
  const residualDefaults = columns.filter((row) => row.column_default !== null);
  if (residualDefaults.length) {
    throw new Error(`DB_CHECK: defaults residuais: ${residualDefaults.map((row) => `${row.table_name}.${row.column_name}`).join(", ")}`);
  }
  const users = await prisma.user.count();
  if (users < 1) throw new Error("DB_CHECK: seed não criou o usuário demo.");
  const [organizations, memberships, owners, privateRowsWithoutTenant] = await Promise.all([
    prisma.organization.count(),
    prisma.membership.count(),
    prisma.membership.count({ where: { role: "OWNER" } }),
    prisma.$queryRaw`
      SELECT (
        (SELECT COUNT(*) FROM "Product" WHERE "organizationId" IS NULL) +
        (SELECT COUNT(*) FROM "Supplier" WHERE "organizationId" IS NULL) +
        (SELECT COUNT(*) FROM "Analysis" WHERE "organizationId" IS NULL) +
        (SELECT COUNT(*) FROM "Opportunity" WHERE "organizationId" IS NULL) +
        (SELECT COUNT(*) FROM "DecisionLog" WHERE "organizationId" IS NULL) +
        (SELECT COUNT(*) FROM "Alert" WHERE "organizationId" IS NULL)
      )::int AS count
    `,
  ]);
  if (organizations < 1 || memberships < 1 || owners < 1) {
    throw new Error("DB_CHECK: seed não criou Organization/Membership OWNER.");
  }
  if (privateRowsWithoutTenant[0]?.count !== 0) {
    throw new Error("DB_CHECK: há registros privados sem organizationId após seed.");
  }

  const diff = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js", "migrate", "diff",
      "--from-url", process.env.DATABASE_URL,
      "--to-schema-datamodel", "packages/db/prisma/schema.prisma",
      "--exit-code",
    ],
    { cwd: process.cwd(), env: process.env, encoding: "utf8" },
  );
  if (diff.status !== 0) {
    throw new Error(`DB_CHECK: Prisma detectou drift físico.\n${diff.stdout}\n${diff.stderr}`);
  }
  console.log(`DB baseline: PASS (${target.host}/${target.database}, ${applied.length} migrations, ${actualTables.length} tabelas, seed/tenant presentes, sem drift).`);
} finally {
  await prisma.$disconnect();
}
