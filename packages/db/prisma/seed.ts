import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const user = await db.user.upsert({
    where: { email: "demo@easyseller.local" },
    update: {},
    create: { email: "demo@easyseller.local", name: "Usuário Demo" },
  });
  await db.supplier.create({
    data: {
      userId: user.id,
      name: "Distribuidora Aurora",
      cnpj: "12.345.678/0001-90",
      contact: "Marina",
      city: "São Paulo",
      state: "SP",
      issuesInvoice: true,
      minimumOrderCents: 80000,
    },
  });
  const product = await db.product.create({
    data: {
      userId: user.id,
      name: "Kit organizador modular 6 peças",
      brand: "Casa Clara",
      ean: "7891000000011",
      category: "Casa",
      listings: { create: { asin: "B0EASY001BR", origin: "INFERRED" } },
    },
  });
  await db.opportunity.create({
    data: { productId: product.id, score: 87, marginBasisPoints: 1840, roiBasisPoints: 3870, estimatedMonthlySales: 82, estimatedDaysToSell: 18, recommendedQty: 8, maxPurchasePriceCents: 4230, riskLevel: "LOW", modelVersion: "fast-cash-v1" },
  });
}

main().finally(async () => db.$disconnect());
