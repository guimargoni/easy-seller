import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const email = process.env.LOCAL_USER_EMAIL ?? "local@easyseller.local";

async function main() {
  const user = await db.user.upsert({
    where: { email },
    update: { name: "Usuário Demo", isDemo: true },
    create: { email, name: "Usuário Demo", isDemo: true },
  });
  await db.userSettings.upsert({
    where: { userId: user.id }, update: {},
    create: { userId: user.id, capitalTotalCents: 2_000_000, capitalReserveCents: 200_000, targetMarginMinBasisPoints: 1500, targetMarginIdealBasisPoints: 1800, targetRoiMinBasisPoints: 2500, maxTestExposureBasisPoints: 500, preferredMaxTurnoverDays: 30, strategyProfile: "FAST_CASH", simpleMode: true },
  });
  const supplier = await db.supplier.upsert({
    where: { id: "demo-supplier-aurora" }, update: {},
    create: { id: "demo-supplier-aurora", userId: user.id, name: "Distribuidora Aurora", legalName: "Aurora Distribuição Ltda.", cnpj: "12.345.678/0001-90", contact: "Marina", phone: "11 3333-1200", whatsapp: "11 99999-1200", email: "marina@aurora.exemplo", city: "São Paulo", state: "SP", issuesInvoice: true, hasCatalog: false, minimumOrderCents: 80_000, notes: "Registro de demonstração." },
  });
  const product = await db.product.upsert({
    where: { id: "demo-product-organizer" }, update: {},
    create: { id: "demo-product-organizer", userId: user.id, name: "Kit organizador modular 6 peças", brand: "Casa Clara", ean: "7891000000011", category: "Casa", strategyType: "BRANDED_RESELL", status: "TEST", salePriceCents: 7_990, monthlySalesEstimate: 82, sellerCount: 4, amazonIsSeller: false, priceStability: 88, demandStability: 82, dataOrigin: "INFERRED", listings: { create: { asin: "B0EASY001BR", origin: "INFERRED" } } },
  });
  await db.supplierProduct.upsert({
    where: { id: "demo-supplier-product-organizer" }, update: {},
    create: { id: "demo-supplier-product-organizer", supplierId: supplier.id, productId: product.id, supplierSku: "AUR-ORG-06", costCents: 3_800, stock: 8, minimumQty: 1 },
  });
}

main().then(() => console.log(`Seed de demonstração aplicado para ${email}.`)).finally(async () => db.$disconnect());
