import type { FastifyRequest } from "fastify";
import { LOCAL_USER_EMAIL, prisma } from "@easy-seller/db";
import { assertLocalIdentityAllowed, TenantContextError, type TenantContext } from "./tenant-context.js";

export interface AuthenticatedIdentity {
  userId: string;
  source: string;
}

export type IdentityResolver = (
  request: FastifyRequest,
) => Promise<AuthenticatedIdentity | null>;

export interface AuthorizedMembership {
  id: string;
  organizationId: string;
  organizationName: string;
  role: TenantContext["role"];
}

export interface SessionContext {
  identity: AuthenticatedIdentity;
  user: { id: string; email: string; name: string | null };
  memberships: AuthorizedMembership[];
  tenant: TenantContext;
}

async function ensureLocalIdentityUser() {
  const user = await prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: { email: LOCAL_USER_EMAIL, name: "Usuário local", settings: { create: {} } },
    include: { settings: true },
  });
  if (!user.settings) await prisma.userSettings.create({ data: { userId: user.id } });

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: user.name ? `${user.name} — Organização` : "Organização local",
          memberships: { create: { userId: user.id, role: "OWNER" } },
        },
        include: { memberships: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: user.id,
          action: "LOCAL.ORGANIZATION_BOOTSTRAPPED",
          entityType: "Organization",
          entityId: organization.id,
          metadata: { source: "explicit_local_identity_adapter" },
        },
      });
    });
  }
  return user;
}

export const localIdentityResolver: IdentityResolver = async () => {
  assertLocalIdentityAllowed();
  const user = await ensureLocalIdentityUser();
  return { userId: user.id, source: "LOCAL_DEVELOPMENT" };
};

export async function resolveSessionContext(
  identity: AuthenticatedIdentity,
  requestedOrganizationId?: string,
): Promise<SessionContext> {
  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: {
      id: true,
      email: true,
      name: true,
      memberships: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, organizationId: true, role: true, organization: { select: { name: true } } },
      },
    },
  });
  if (!user) throw new TenantContextError("IDENTITY_USER_NOT_FOUND", 401);
  const selected = requestedOrganizationId
    ? user.memberships.find((membership) => membership.organizationId === requestedOrganizationId)
    : user.memberships[0];
  if (!selected) throw new TenantContextError("TENANT_MEMBERSHIP_REQUIRED", 403);
  const memberships = user.memberships.map((membership) => ({
    id: membership.id,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    role: membership.role,
  }));
  return {
    identity,
    user: { id: user.id, email: user.email, name: user.name },
    memberships,
    tenant: {
      userId: user.id,
      organizationId: selected.organizationId,
      membershipId: selected.id,
      role: selected.role,
    },
  };
}

export function requestedOrganization(request: FastifyRequest): string | undefined {
  const header = request.headers["x-organization-id"];
  return typeof header === "string" && header.trim() ? header.trim() : undefined;
}

declare module "fastify" {
  interface FastifyRequest {
    session: SessionContext;
  }
}
