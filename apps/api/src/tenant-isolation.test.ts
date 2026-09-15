import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InjectOptions } from "fastify";
import { prisma } from "@easy-seller/db";
import { buildApp } from "./app.js";
import {
  assertLocalIdentityAllowed,
  resolveTenantContextForUser,
  sanitizeAuditMetadata,
  type TenantContextResolver,
} from "./tenant-context.js";

const marker = "tenant-slice1";
const ids = {
  userA: `${marker}-user-a`, userB: `${marker}-user-b`, userNoMembership: `${marker}-user-none`,
  organizationA: `${marker}-organization-a`, organizationB: `${marker}-organization-b`,
  membershipA: `${marker}-membership-a`, membershipB: `${marker}-membership-b`,
  productA: `${marker}-product-a`, productB: `${marker}-product-b`,
  supplierA: `${marker}-supplier-a`, supplierB: `${marker}-supplier-b`,
  analysisA: `${marker}-analysis-a`, analysisB: `${marker}-analysis-b`,
  opportunityA: `${marker}-opportunity-a`, opportunityB: `${marker}-opportunity-b`,
  alertA: `${marker}-alert-a`, alertB: `${marker}-alert-b`,
  decisionA: `${marker}-decision-a`, decisionB: `${marker}-decision-b`,
};

const emailA = `${marker}-a@easyseller.local`;
const emailB = `${marker}-b@easyseller.local`;

function assertTestDatabase() {
  if (process.env.NODE_ENV !== "test" || process.env.ALLOW_TEST_DATABASE !== "true")
    throw new Error("Tenant integration tests require the protected test environment.");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!/(^|[_-])test($|[_-])/i.test(url.pathname))
    throw new Error("Tenant integration tests require a database clearly named as test.");
}

const resolver: TenantContextResolver = async (request) => {
  const email = request.headers["x-test-user-email"];
  if (typeof email !== "string") throw new Error("TEST_IDENTITY_REQUIRED");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return resolveTenantContextForUser(user.id);
};

const productPayload = (name: string) => ({
  name,
  category: "Categoria compartilhada",
  strategyType: "BRANDED_RESELL",
  status: "RESEARCHING",
  dataOrigin: "INFERRED",
});

describe("tenant isolation", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    assertTestDatabase();
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [ids.organizationA, ids.organizationB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.userB, ids.userNoMembership] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ids.organizationA, ids.organizationB] } } });

    await prisma.user.createMany({ data: [
      { id: ids.userA, email: emailA, name: "Tenant Similar" },
      { id: ids.userB, email: emailB, name: "Tenant Similar" },
      { id: ids.userNoMembership, email: `${marker}-none@easyseller.local`, name: "Sem membership" },
    ] });
    await prisma.userSettings.createMany({ data: [
      { userId: ids.userA }, { userId: ids.userB }, { userId: ids.userNoMembership },
    ] });
    await prisma.organization.createMany({ data: [
      { id: ids.organizationA, name: "Organização Similar" },
      { id: ids.organizationB, name: "Organização Similar" },
    ] });
    await prisma.membership.createMany({ data: [
      { id: ids.membershipA, userId: ids.userA, organizationId: ids.organizationA, role: "OWNER" },
      { id: ids.membershipB, userId: ids.userB, organizationId: ids.organizationB, role: "OWNER" },
    ] });
    await prisma.supplier.createMany({ data: [
      { id: ids.supplierA, userId: ids.userA, organizationId: ids.organizationA, name: "Fornecedor Similar" },
      { id: ids.supplierB, userId: ids.userB, organizationId: ids.organizationB, name: "Fornecedor Similar" },
    ] });
    await prisma.product.createMany({ data: [
      { id: ids.productA, userId: ids.userA, organizationId: ids.organizationA, name: "Produto Similar", category: "Teste" },
      { id: ids.productB, userId: ids.userB, organizationId: ids.organizationB, name: "Produto Similar", category: "Teste" },
    ] });
    const analysisData = {
      salePriceCents: 10000, productCostCents: 5000, totalExpensesCents: 6000,
      netProfitCents: 4000, marginBasisPoints: 4000, roiBasisPoints: 8000,
      markupBasisPoints: 10000, breakEvenPriceCents: 6000, maxPurchasePriceCents: 3500,
      score: 70, classification: "TEST", scoreComponents: {}, positives: [], warnings: [],
      strategyProfile: "FAST_CASH" as const,
    };
    await prisma.analysis.createMany({ data: [
      { id: ids.analysisA, userId: ids.userA, organizationId: ids.organizationA, productId: ids.productA, ...analysisData },
      { id: ids.analysisB, userId: ids.userB, organizationId: ids.organizationB, productId: ids.productB, ...analysisData },
    ] });
    const opportunityData = {
      score: 70, marginBasisPoints: 2000, roiBasisPoints: 3000, estimatedMonthlySales: 10,
      recommendedQty: 2, maxPurchasePriceCents: 4000, riskLevel: "LOW" as const, modelVersion: "tenant-test",
    };
    await prisma.opportunity.createMany({ data: [
      { id: ids.opportunityA, productId: ids.productA, organizationId: ids.organizationA, ...opportunityData },
      { id: ids.opportunityB, productId: ids.productB, organizationId: ids.organizationB, ...opportunityData },
    ] });
    await prisma.alert.createMany({ data: [
      { id: ids.alertA, userId: ids.userA, organizationId: ids.organizationA, type: "TEST", severity: "LOW", title: "Alerta Similar", message: "A" },
      { id: ids.alertB, userId: ids.userB, organizationId: ids.organizationB, type: "TEST", severity: "LOW", title: "Alerta Similar", message: "B" },
    ] });
    await prisma.decisionLog.createMany({ data: [
      { id: ids.decisionA, userId: ids.userA, organizationId: ids.organizationA, productId: ids.productA, decision: "TEST", context: {} },
      { id: ids.decisionB, userId: ids.userB, organizationId: ids.organizationB, productId: ids.productB, decision: "TEST", context: {} },
    ] });
    app = await buildApp({ tenantContextResolver: resolver });
  });

  afterAll(async () => {
    await app?.close();
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [ids.organizationA, ids.organizationB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.userB, ids.userNoMembership] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ids.organizationA, ids.organizationB] } } });
  });

  const inject = (email: string, options: InjectOptions) =>
    app.inject({ ...options, headers: { ...options.headers, "x-test-user-email": email } });

  it("resolves a valid membership and rejects invalid tenant contexts", async () => {
    await expect(resolveTenantContextForUser(ids.userA, ids.organizationA)).resolves.toMatchObject({
      userId: ids.userA, organizationId: ids.organizationA, role: "OWNER",
    });
    await expect(resolveTenantContextForUser(ids.userA, "organization-does-not-exist")).rejects.toMatchObject({
      code: "TENANT_MEMBERSHIP_REQUIRED", statusCode: 403,
    });
    await expect(resolveTenantContextForUser(ids.userNoMembership)).rejects.toMatchObject({
      code: "TENANT_MEMBERSHIP_REQUIRED", statusCode: 403,
    });
  });

  it("makes LOCAL_USER_EMAIL impossible to enable in production", () => {
    expect(() => assertLocalIdentityAllowed({ NODE_ENV: "production", ALLOW_LOCAL_IDENTITY: "true" }))
      .toThrowError("LOCAL_IDENTITY_FORBIDDEN_IN_PRODUCTION");
  });

  it("removes sensitive fields from audit metadata", () => {
    expect(sanitizeAuditMetadata({ status: "ok", token: "secret", nested: { password: "secret" } }))
      .toEqual({ status: "ok", nested: {} });
  });

  it.each([[emailA, ids.productA, ids.productB], [emailB, ids.productB, ids.productA]])(
    "%s lists only its organization and cannot read or update the other product",
    async (email, ownProductId, foreignProductId) => {
      const list = await inject(email, { method: "GET", url: "/products" });
      expect(list.statusCode).toBe(200);
      expect(list.json().map((item: { id: string }) => item.id)).toContain(ownProductId);
      expect(list.json().map((item: { id: string }) => item.id)).not.toContain(foreignProductId);
      expect((await inject(email, { method: "GET", url: `/products/${foreignProductId}` })).statusCode).toBe(404);
      expect((await inject(email, { method: "PUT", url: `/products/${foreignProductId}`, payload: productPayload("Tentativa") })).statusCode).toBe(404);
    },
  );

  it.each([[emailA, ids.supplierA, ids.supplierB], [emailB, ids.supplierB, ids.supplierA]])(
    "%s isolates supplier read and update",
    async (email, ownSupplierId, foreignSupplierId) => {
      const list = await inject(email, { method: "GET", url: "/suppliers" });
      expect(list.json().map((item: { id: string }) => item.id)).toContain(ownSupplierId);
      expect(list.json().map((item: { id: string }) => item.id)).not.toContain(foreignSupplierId);
      expect((await inject(email, { method: "GET", url: `/suppliers/${foreignSupplierId}` })).statusCode).toBe(404);
      expect((await inject(email, { method: "PUT", url: `/suppliers/${foreignSupplierId}`, payload: { name: "Tentativa" } })).statusCode).toBe(404);
    },
  );

  it.each([
    [emailA, ids.analysisA, ids.analysisB, ids.productA, ids.productB, ids.alertA, ids.alertB],
    [emailB, ids.analysisB, ids.analysisA, ids.productB, ids.productA, ids.alertB, ids.alertA],
  ])("%s isolates analyses, opportunities and alerts", async (email, ownAnalysis, foreignAnalysis, ownProduct, foreignProduct, ownAlert, foreignAlert) => {
    const analyses = (await inject(email, { method: "GET", url: "/analyses" })).json();
    expect(analyses.map((item: { id: string }) => item.id)).toContain(ownAnalysis);
    expect(analyses.map((item: { id: string }) => item.id)).not.toContain(foreignAnalysis);
    const products = (await inject(email, { method: "GET", url: "/products" })).json();
    expect(products.find((item: { id: string }) => item.id === ownProduct)?.recommendedQuantity).toBe(2);
    expect(products.map((item: { id: string }) => item.id)).not.toContain(foreignProduct);
    const alerts = (await inject(email, { method: "GET", url: "/alerts" })).json();
    expect(alerts.map((item: { id: string }) => item.id)).toContain(ownAlert);
    expect(alerts.map((item: { id: string }) => item.id)).not.toContain(foreignAlert);
    const analysisAttempt = await inject(email, {
      method: "POST", url: "/analyses",
      payload: { productId: foreignProduct, salePrice: 100, productCost: 50 },
    });
    expect(analysisAttempt.statusCode).toBe(404);
  });

  it("writes tenant-scoped, sanitized audit records for a critical mutation", async () => {
    const response = await inject(emailA, { method: "POST", url: "/products", payload: productPayload("Produto auditado") });
    expect(response.statusCode).toBe(201);
    const created = response.json();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: ids.organizationA, entityType: "Product", entityId: created.id, action: "PRODUCT.CREATED" },
    });
    expect(audit.actorUserId).toBe(ids.userA);
    expect(JSON.stringify(audit.metadata)).not.toMatch(/password|token|secret/i);
    await inject(emailA, { method: "DELETE", url: `/products/${created.id}` });
  });

  it("keeps DecisionLog tenant-scoped even though no HTTP route exists yet", async () => {
    const contextA = await resolveTenantContextForUser(ids.userA);
    const contextB = await resolveTenantContextForUser(ids.userB);
    const [rowsA, rowsB] = await Promise.all([
      prisma.decisionLog.findMany({ where: { organizationId: contextA.organizationId } }),
      prisma.decisionLog.findMany({ where: { organizationId: contextB.organizationId } }),
    ]);
    expect(rowsA.map((item) => item.id)).toContain(ids.decisionA);
    expect(rowsA.map((item) => item.id)).not.toContain(ids.decisionB);
    expect(rowsB.map((item) => item.id)).toContain(ids.decisionB);
    expect(rowsB.map((item) => item.id)).not.toContain(ids.decisionA);
  });
});
