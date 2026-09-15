import { buildApp } from "../apps/api/src/app.ts";
import { processCatalogImport } from "@easy-seller/catalog";
import { ensureLocalUser, prisma } from "@easy-seller/db";
import { unlink } from "node:fs/promises";
import { assertSafeTestEnvironment } from "./test-environment-guard.mjs";

assertSafeTestEnvironment({ requireApi: true });

const app = await buildApp();
const marker = `phase3-smoke-${Date.now()}`;
let supplierId;
const catalogIds = [];
const productIds = new Set();

const expect = (condition, message) => { if (!condition) throw new Error(message); };
async function createAndProcess(name, products) {
  const response = await app.inject({ method: "POST", url: "/catalogs/manual", payload: { supplierId, name, products } });
  expect(response.statusCode === 202, `criação retornou ${response.statusCode}: ${response.body}`);
  const catalog = response.json(); catalogIds.push(catalog.id);
  await processCatalogImport(catalog.import.id);
  const detail = await app.inject({ method: "GET", url: `/catalogs/${catalog.id}` });
  expect(detail.statusCode === 200, "catálogo processado não encontrado");
  return detail.json();
}

try {
  const user = await ensureLocalUser();
  const membership = await prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
  const supplier = await prisma.supplier.create({ data: { userId: user.id, organizationId: membership.organizationId, name: marker } });
  supplierId = supplier.id;
  const first = await createAndProcess(`${marker}-v1`, [
    { supplierSku: "SMOKE-A", name: "Produto Smoke A", unitPrice: 10, unitsPerBox: 6, minimumUnits: 6, availability: "IN_STOCK" },
    { name: "Produto pendente" },
  ]);
  expect(first.version === 1, "primeira versão incorreta");
  expect(first.products.some((item) => item.status === "PENDING"), "threshold não enviou item incompleto à revisão");
  const pending = first.products.find((item) => item.status === "PENDING");
  const review = await app.inject({ method: "PATCH", url: `/catalog-products/${pending.id}/review`, payload: { action: "EDIT", values: { supplierSku: "SMOKE-P", name: "Produto pendente revisado", unitPrice: 5, minimumUnits: 2 } } });
  expect(review.statusCode === 200, `revisão retornou ${review.statusCode}: ${review.body}`);
  const second = await createAndProcess(`${marker}-v2`, [
    { supplierSku: "SMOKE-A", name: "Produto Smoke A", unitPrice: 12, unitsPerBox: 12, minimumUnits: 12, availability: "OUT_OF_STOCK" },
    { supplierSku: "SMOKE-N", name: "Produto novo", unitPrice: 8, minimumUnits: 1, availability: "IN_STOCK" },
  ]);
  expect(second.version === 2, "versionamento não incrementou");
  const changes = second.changes.map((item) => item.changeType);
  expect(changes.includes("PRICE_INCREASE") && changes.includes("BOX_CHANGED") && changes.includes("OUT_OF_STOCK") && changes.includes("NEW_PRODUCT") && changes.includes("REMOVED_PRODUCT"), `comparação não detectou todas as mudanças esperadas: ${JSON.stringify({ changes: second.changes, first: first.products, second: second.products })}`);
  const opportunities = await app.inject({ method: "GET", url: "/catalog-opportunities" });
  expect(opportunities.statusCode === 200 && opportunities.json().some((item) => item.supplierName === marker && item.amazonDataStatus === "NOT_FETCHED"), "pipeline/shortlist não foi criado");
  console.log("Phase 3 smoke: PASS (upload manual, fila, threshold, revisão, versões, comparação e shortlist).");
} finally {
  if (supplierId) {
    const sourceFiles = await prisma.catalog.findMany({ where: { id: { in: catalogIds } }, select: { sourceFile: true } });
    const catalogProducts = await prisma.catalogProduct.findMany({ where: { catalogId: { in: catalogIds } }, select: { id: true, linkedProductId: true } });
    for (const item of catalogProducts) if (item.linkedProductId) productIds.add(item.linkedProductId);
    await prisma.productMatch.deleteMany({ where: { catalogProductId: { in: catalogProducts.map((item) => item.id) } } });
    await prisma.supplierProductPrice.deleteMany({ where: { catalogId: { in: catalogIds } } });
    await prisma.catalogChange.deleteMany({ where: { OR: [{ catalogId: { in: catalogIds } }, { previousCatalogId: { in: catalogIds } }] } });
    await prisma.catalogProduct.deleteMany({ where: { catalogId: { in: catalogIds } } });
    await prisma.catalogImport.deleteMany({ where: { catalogId: { in: catalogIds } } });
    await prisma.catalog.deleteMany({ where: { id: { in: catalogIds } } });
    await prisma.supplierProductPrice.deleteMany({ where: { supplierProduct: { supplierId } } });
    await prisma.supplierProduct.deleteMany({ where: { supplierId } });
    await prisma.alert.deleteMany({ where: { user: { email: process.env.LOCAL_USER_EMAIL ?? "local@easyseller.local" }, message: { contains: "Produto Smoke" } } });
    for (const productId of productIds) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    for (const source of sourceFiles) if (source.sourceFile) await unlink(source.sourceFile).catch(() => undefined);
  }
  await app.close();
  await prisma.$disconnect();
}
