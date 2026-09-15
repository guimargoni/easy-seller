import type { MembershipRole } from "@prisma/client";

export const capabilities = [
  "session.read",
  "products.read", "products.write",
  "suppliers.read", "suppliers.write",
  "catalogs.read", "catalogs.write",
  "analyses.read", "analyses.write",
  "calculations.execute",
  "research.read", "dashboard.read", "alerts.read",
  "amazon_intelligence.read", "amazon_intelligence.write",
  "settings.read", "settings.write",
  "members.read", "members.manage", "members.manage_owner",
  "audit.read",
] as const;

export type Capability = (typeof capabilities)[number];

const readCapabilities: Capability[] = [
  "session.read", "products.read", "suppliers.read", "catalogs.read",
  "analyses.read", "calculations.execute", "research.read", "dashboard.read",
  "alerts.read", "amazon_intelligence.read", "settings.read",
];

export const roleCapabilities: Readonly<Record<MembershipRole, readonly Capability[]>> = {
  OWNER: capabilities,
  ADMIN: capabilities.filter((capability) => capability !== "members.manage_owner"),
  FINANCE: [
    ...readCapabilities,
    "analyses.write",
  ],
  OPERATIONS: [
    ...readCapabilities,
    "products.write", "suppliers.write", "catalogs.write", "analyses.write",
    "amazon_intelligence.write",
  ],
  ADS_MANAGER: [
    "session.read", "products.read", "analyses.read", "calculations.execute",
    "research.read", "dashboard.read", "alerts.read", "amazon_intelligence.read",
  ],
  ANALYST: readCapabilities,
  VIEWER: readCapabilities.filter((capability) => capability !== "calculations.execute"),
};

export function capabilitiesForRole(role: MembershipRole): Capability[] {
  return [...roleCapabilities[role]];
}

export function hasCapability(
  granted: readonly Capability[],
  required: Capability,
): boolean {
  return granted.includes(required);
}

export const routeCapabilities = {
  "GET /me": "session.read",
  "GET /members": "members.read",
  "PATCH /members/:id": "members.manage",
  "GET /audit-logs": "audit.read",
  "GET /settings": "settings.read",
  "PUT /settings": "settings.write",
  "GET /catalogs": "catalogs.read",
  "GET /catalogs/:id": "catalogs.read",
  "POST /catalogs/upload": "catalogs.write",
  "POST /catalogs/manual": "catalogs.write",
  "POST /catalogs/reference": "catalogs.write",
  "PATCH /catalog-products/:id/review": "catalogs.write",
  "GET /supplier-products/:id/prices": "suppliers.read",
  "GET /catalog-opportunities": "research.read",
  "GET /alerts": "alerts.read",
  "POST /amazon/intelligence": "amazon_intelligence.write",
  "GET /amazon/intelligence/:asin": "amazon_intelligence.read",
  "GET /products": "products.read",
  "GET /products/:id": "products.read",
  "POST /products": "products.write",
  "PUT /products/:id": "products.write",
  "DELETE /products/:id": "products.write",
  "POST /products/:id/suppliers": "products.write",
  "GET /suppliers": "suppliers.read",
  "GET /suppliers/:id": "suppliers.read",
  "POST /suppliers": "suppliers.write",
  "PUT /suppliers/:id": "suppliers.write",
  "DELETE /suppliers/:id": "suppliers.write",
  "POST /calculations": "calculations.execute",
  "GET /analyses": "analyses.read",
  "POST /analyses": "analyses.write",
  "POST /extension/analyses": "analyses.write",
  "GET /research/candidates": "research.read",
  "GET /dashboard": "dashboard.read",
} as const satisfies Readonly<Record<string, Capability>>;

export function capabilityForRoute(method: string, routeUrl: string): Capability | undefined {
  return routeCapabilities[`${method} ${routeUrl}` as keyof typeof routeCapabilities];
}

declare module "fastify" {
  interface FastifyRequest {
    capabilities: Capability[];
  }
}
