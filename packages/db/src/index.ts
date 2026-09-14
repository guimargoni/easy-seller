import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { easySellerPrisma?: PrismaClient };
export const prisma = globalForPrisma.easySellerPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.easySellerPrisma = prisma;

export const LOCAL_USER_EMAIL = process.env.LOCAL_USER_EMAIL ?? "local@easyseller.local";

export async function ensureLocalUser() {
  return prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: { email: LOCAL_USER_EMAIL, name: "Usuário local", settings: { create: {} } },
    include: { settings: true },
  });
}
