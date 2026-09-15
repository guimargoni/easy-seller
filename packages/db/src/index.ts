import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { easySellerPrisma?: PrismaClient };
export const prisma = globalForPrisma.easySellerPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.easySellerPrisma = prisma;

export const LOCAL_USER_EMAIL = process.env.LOCAL_USER_EMAIL ?? "local@easyseller.local";

export async function ensureLocalUser() {
  if (process.env.NODE_ENV === "production" || !["development", "test"].includes(process.env.NODE_ENV ?? "")) {
    throw new Error("LOCAL_USER_BOOTSTRAP_FORBIDDEN_IN_THIS_ENVIRONMENT");
  }
  if (process.env.ALLOW_LOCAL_IDENTITY !== "true") {
    throw new Error("LOCAL_USER_BOOTSTRAP_NOT_ENABLED");
  }
  return prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: { email: LOCAL_USER_EMAIL, name: "Usuário local", settings: { create: {} } },
    include: { settings: true },
  });
}
