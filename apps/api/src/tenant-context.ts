import type { FastifyRequest } from "fastify";
import type { MembershipRole, Prisma } from "@prisma/client";
import { LOCAL_USER_EMAIL, prisma } from "@easy-seller/db";

export interface TenantContext {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: MembershipRole;
}

export type TenantContextResolver = (request: FastifyRequest) => Promise<TenantContext>;

export class TenantContextError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(code);
  }
}

export function assertLocalIdentityAllowed(environment = process.env) {
  if (environment.NODE_ENV === "production") {
    throw new TenantContextError("LOCAL_IDENTITY_FORBIDDEN_IN_PRODUCTION", 500);
  }
  if (!["development", "test"].includes(environment.NODE_ENV ?? "")) {
    throw new TenantContextError("LOCAL_IDENTITY_ENVIRONMENT_REQUIRED", 500);
  }
  if (environment.ALLOW_LOCAL_IDENTITY !== "true") {
    throw new TenantContextError("LOCAL_IDENTITY_NOT_ENABLED", 503);
  }
}

export async function resolveTenantContextForUser(
  userId: string,
  organizationId?: string,
): Promise<TenantContext> {
  const membership = await prisma.membership.findFirst({
    where: { userId, ...(organizationId ? { organizationId } : {}) },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new TenantContextError("TENANT_MEMBERSHIP_REQUIRED", 403);
  return {
    userId,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
  };
}

async function ensureLocalTenantContext(): Promise<TenantContext> {
  const user = await prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: { email: LOCAL_USER_EMAIL, name: "Usuário local", settings: { create: {} } },
    include: { settings: true },
  });
  if (!user.settings) await prisma.userSettings.create({ data: { userId: user.id } });

  const existing = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return resolveTenantContextForUser(user.id, existing.organizationId);

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: user.name ? `${user.name} — Organização` : "Organização local",
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
      include: { memberships: true },
    });
    const membership = organization.memberships[0];
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
    return {
      userId: user.id,
      organizationId: organization.id,
      membershipId: membership.id,
      role: membership.role,
    };
  });
}

export const localTenantContextResolver: TenantContextResolver = async () => {
  assertLocalIdentityAllowed();
  return ensureLocalTenantContext();
};

const sensitiveMetadataKey = /password|token|secret|authorization|cookie|document|payload/i;

export function sanitizeAuditMetadata(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (value == null || depth > 3) return undefined;
  if (typeof value === "string") return value.slice(0, 512);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizeAuditMetadata(item, depth + 1))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
  }
  if (typeof value === "object") {
    const sanitized: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      if (sensitiveMetadataKey.test(key)) continue;
      const safe = sanitizeAuditMetadata(item, depth + 1);
      if (safe !== undefined) sanitized[key] = safe;
    }
    return sanitized;
  }
  return undefined;
}

export async function recordAudit(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  input: { action: string; entityType: string; entityId?: string; metadata?: unknown },
) {
  return tx.auditLog.create({
    data: {
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: sanitizeAuditMetadata(input.metadata),
    },
  });
}

declare module "fastify" {
  interface FastifyRequest {
    tenant: TenantContext;
  }
}
