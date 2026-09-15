import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InjectOptions } from "fastify";
import { prisma } from "@easy-seller/db";
import { buildApp } from "./app.js";
import type { IdentityResolver } from "./identity-session.js";

const marker = "auth-slice2";
const organizationA = `${marker}-organization-a`;
const organizationB = `${marker}-organization-b`;
const roles = ["OWNER", "ADMIN", "FINANCE", "OPERATIONS", "ADS_MANAGER", "ANALYST", "VIEWER"] as const;
const userId = (role: string) => `${marker}-user-${role.toLowerCase()}`;
const membershipId = (role: string) => `${marker}-membership-${role.toLowerCase()}`;
const foreignProductId = `${marker}-foreign-product`;
const ownProductId = `${marker}-own-product`;
const noMembershipUserId = `${marker}-user-no-membership`;
const inactiveUserId = `${marker}-user-inactive`;
const adminTargetUserId = `${marker}-user-admin-target`;
const adminTargetMembershipId = `${marker}-membership-admin-target`;

function assertTestDatabase() {
  if (process.env.NODE_ENV !== "test" || process.env.ALLOW_TEST_DATABASE !== "true")
    throw new Error("Auth integration tests require the protected test environment.");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!/(^|[_-])test($|[_-])/i.test(url.pathname))
    throw new Error("Auth integration tests require a database clearly named as test.");
}

const identityResolver: IdentityResolver = async (request) => {
  const id = request.headers["x-test-identity"];
  return typeof id === "string" ? { userId: id, source: "TEST_FIXTURE" } : null;
};

const productPayload = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  category: "Autorização",
  strategyType: "BRANDED_RESELL",
  status: "RESEARCHING",
  dataOrigin: "INFERRED",
  ...extra,
});

describe("identity, session and server-side RBAC", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    assertTestDatabase();
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: `${marker}-user-` } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA, organizationB] } } });

    await prisma.organization.createMany({ data: [
      { id: organizationA, name: "Auth Organization A" },
      { id: organizationB, name: "Auth Organization B" },
    ] });
    await prisma.user.createMany({ data: [
      ...roles.map((role) => ({ id: userId(role), email: `${role.toLowerCase()}-${marker}@easyseller.local`, name: role })),
      { id: noMembershipUserId, email: `none-${marker}@easyseller.local`, name: "No membership" },
      { id: inactiveUserId, email: `inactive-${marker}@easyseller.local`, name: "Inactive" },
      { id: adminTargetUserId, email: `target-${marker}@easyseller.local`, name: "Admin target" },
    ] });
    await prisma.userSettings.createMany({ data: [
      ...roles.map((role) => ({ userId: userId(role) })),
      { userId: noMembershipUserId }, { userId: inactiveUserId }, { userId: adminTargetUserId },
    ] });
    await prisma.membership.createMany({ data: [
      ...roles.map((role) => ({ id: membershipId(role), userId: userId(role), organizationId: organizationA, role })),
      { id: `${marker}-membership-foreign-owner`, userId: userId("OWNER"), organizationId: organizationB, role: "OWNER" },
      { id: `${marker}-membership-inactive`, userId: inactiveUserId, organizationId: organizationA, role: "VIEWER", isActive: false },
      { id: adminTargetMembershipId, userId: adminTargetUserId, organizationId: organizationA, role: "VIEWER" },
    ] });
    await prisma.product.createMany({ data: [
      { id: ownProductId, userId: userId("OWNER"), organizationId: organizationA, name: "Own product", category: "Test" },
      { id: foreignProductId, userId: userId("OWNER"), organizationId: organizationB, name: "Foreign product", category: "Test" },
    ] });
    app = await buildApp({ identityResolver });
    app.get("/unmapped-test", async () => ({ leaked: true }));
  });

  afterAll(async () => {
    await app?.close();
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: `${marker}-user-` } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA, organizationB] } } });
  });

  const inject = (identity: string | null, options: InjectOptions, organizationId = organizationA) => app.inject({
    ...options,
    headers: {
      ...options.headers,
      ...(identity ? { "x-test-identity": identity } : {}),
      "x-organization-id": organizationId,
    },
  });

  it("returns 401 when no authenticated identity exists", async () => {
    const response = await inject(null, { method: "GET", url: "/products" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });

  it("denies a private route that has no explicit capability policy", async () => {
    const response = await inject(userId("OWNER"), { method: "GET", url: "/unmapped-test" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "AUTHORIZATION_POLICY_REQUIRED" });
  });

  it("returns 403 for identities without an active membership", async () => {
    for (const id of [noMembershipUserId, inactiveUserId]) {
      const response = await inject(id, { method: "GET", url: "/products" });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "TENANT_MEMBERSHIP_REQUIRED" });
    }
  });

  it("returns 403 for a nonexistent or unauthorized organization selection", async () => {
    expect((await inject(userId("VIEWER"), { method: "GET", url: "/me" }, `${marker}-missing`)).statusCode).toBe(403);
    expect((await inject(userId("VIEWER"), { method: "GET", url: "/me" }, organizationB)).statusCode).toBe(403);
  });

  it("returns 404 for an entity owned by another tenant", async () => {
    expect((await inject(userId("OWNER"), { method: "GET", url: `/products/${foreignProductId}` })).statusCode).toBe(404);
  });

  it("authorizes OWNER and protects the last owner", async () => {
    expect((await inject(userId("OWNER"), { method: "POST", url: "/products", payload: productPayload("Owner product") })).statusCode).toBe(201);
    const protectedResponse = await inject(userId("OWNER"), {
      method: "PATCH", url: `/members/${membershipId("OWNER")}`, payload: { role: "ADMIN" },
    });
    expect(protectedResponse.statusCode).toBe(409);
    expect(protectedResponse.json()).toEqual({ error: "ORGANIZATION_OWNER_REQUIRED" });
  });

  it("authorizes ADMIN by capability, audits role changes, and cannot manage OWNER", async () => {
    const me = await inject(userId("ADMIN"), { method: "GET", url: "/me" });
    expect(me.statusCode).toBe(200);
    expect(me.json().capabilities).toContain("members.manage");
    expect(me.json().capabilities).not.toContain("members.manage_owner");
    expect((await inject(userId("ADMIN"), {
      method: "PATCH", url: `/members/${membershipId("OWNER")}`, payload: { role: "ADMIN" },
    })).statusCode).toBe(403);
    expect((await inject(userId("ADMIN"), {
      method: "PATCH", url: `/members/${adminTargetMembershipId}`, payload: { role: "ANALYST" },
    })).statusCode).toBe(200);
    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: organizationA, action: "MEMBERSHIP.ROLE_CHANGED", entityId: adminTargetMembershipId },
    });
    expect(audit?.actorUserId).toBe(userId("ADMIN"));
    const ownAudit = await inject(userId("OWNER"), { method: "GET", url: "/audit-logs" });
    const foreignAudit = await inject(userId("OWNER"), { method: "GET", url: "/audit-logs" }, organizationB);
    expect(ownAudit.json().map((entry: { id: string }) => entry.id)).toContain(audit?.id);
    expect(foreignAudit.json().map((entry: { id: string }) => entry.id)).not.toContain(audit?.id);
  });

  it("prevents VIEWER from mutating while allowing reads", async () => {
    expect((await inject(userId("VIEWER"), { method: "GET", url: "/products" })).statusCode).toBe(200);
    expect((await inject(userId("VIEWER"), { method: "POST", url: "/products", payload: productPayload("Viewer forged") })).statusCode).toBe(403);
  });

  it("applies the ANALYST matrix through real routes", async () => {
    expect((await inject(userId("ANALYST"), { method: "POST", url: "/calculations", payload: { salePrice: 100, productCost: 50 } })).statusCode).toBe(200);
    expect((await inject(userId("ANALYST"), { method: "POST", url: "/products", payload: productPayload("Analyst product") })).statusCode).toBe(403);
  });

  it("applies the OPERATIONS matrix through real routes", async () => {
    expect((await inject(userId("OPERATIONS"), { method: "POST", url: "/products", payload: productPayload("Operations product") })).statusCode).toBe(201);
    expect((await inject(userId("OPERATIONS"), { method: "PUT", url: "/settings", payload: {} })).statusCode).toBe(403);
  });

  it("applies the FINANCE matrix through real routes", async () => {
    expect((await inject(userId("FINANCE"), { method: "POST", url: "/calculations", payload: { salePrice: 120, productCost: 60 } })).statusCode).toBe(200);
    expect((await inject(userId("FINANCE"), { method: "POST", url: "/products", payload: productPayload("Finance product") })).statusCode).toBe(403);
  });

  it("applies the ADS_MANAGER matrix without introducing Ads scope", async () => {
    const me = await inject(userId("ADS_MANAGER"), { method: "GET", url: "/me" });
    expect(me.statusCode).toBe(200);
    expect(me.json().capabilities).toContain("amazon_intelligence.read");
    expect(me.json().capabilities).not.toContain("amazon_intelligence.write");
    expect((await inject(userId("ADS_MANAGER"), { method: "POST", url: "/amazon/intelligence", payload: {} })).statusCode).toBe(403);
  });

  it("ignores forged organizationId and userId fields and uses server context", async () => {
    const response = await inject(userId("OPERATIONS"), {
      method: "POST",
      url: "/products",
      payload: productPayload("Forged ownership", { organizationId: organizationB, userId: userId("OWNER") }),
    });
    expect(response.statusCode).toBe(201);
    const stored = await prisma.product.findUniqueOrThrow({ where: { id: response.json().id } });
    expect(stored.organizationId).toBe(organizationA);
    expect(stored.userId).toBe(userId("OPERATIONS"));
  });

  it("keeps the local identity adapter impossible in production through a private route", async () => {
    const previousNodeEnvironment = process.env.NODE_ENV;
    const previousLocalIdentityFlag = process.env.ALLOW_LOCAL_IDENTITY;
    process.env.NODE_ENV = "production";
    process.env.ALLOW_LOCAL_IDENTITY = "true";
    const productionApp = await buildApp();
    try {
      const response = await productionApp.inject({ method: "GET", url: "/products" });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "LOCAL_IDENTITY_FORBIDDEN_IN_PRODUCTION" });
    } finally {
      await productionApp.close();
      process.env.NODE_ENV = previousNodeEnvironment;
      process.env.ALLOW_LOCAL_IDENTITY = previousLocalIdentityFlag;
    }
  });

  it("returns current user, memberships and capabilities without secrets", async () => {
    const response = await inject(userId("OWNER"), { method: "GET", url: "/me" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.id).toBe(userId("OWNER"));
    expect(body.currentOrganization).toEqual({ id: organizationA, role: "OWNER" });
    expect(body.organizations.length).toBe(2);
    expect(body.capabilities).toContain("members.manage_owner");
    expect(JSON.stringify(body)).not.toMatch(/token|secret|password|hash|cookie/i);
    for (const url of ["/members", "/audit-logs"]) {
      const protectedResponse = await inject(userId("OWNER"), { method: "GET", url });
      expect(protectedResponse.statusCode).toBe(200);
      expect(protectedResponse.body).not.toMatch(/token|secret|password|hash|cookie/i);
    }
  });
});
