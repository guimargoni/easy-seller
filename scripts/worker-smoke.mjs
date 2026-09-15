import { once } from "node:events";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ensureLocalUser, prisma } from "@easy-seller/db";
import { assertSafeTestEnvironment } from "./test-environment-guard.mjs";

assertSafeTestEnvironment();
const marker = `worker-smoke-${Date.now()}`;
const storage = resolve(process.env.CATALOG_STORAGE_DIR ?? ".runtime/test-catalogs");
const catalogIds = [];
const sourceFiles = [];
const productIds = new Set();
let supplierId;

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function enqueue(userId, version) {
  await mkdir(storage, { recursive: true });
  const sourceFile = resolve(storage, `${randomUUID()}.json`);
  sourceFiles.push(sourceFile);
  await writeFile(sourceFile, JSON.stringify([{
    values: {
      supplierSku: `${marker}-${version}`,
      name: `Worker recovery fixture ${version}`,
      unitPrice: 10 + version,
      minimumUnits: 2,
      availability: "IN_STOCK",
    },
    baseConfidence: 1,
    extractionMethod: "MANUAL",
  }]));
  const catalog = await prisma.catalog.create({
    data: {
      supplierId,
      name: `${marker}-v${version}`,
      sourceType: "MANUAL",
      sourceFile,
      status: "UPLOADED",
      version,
      imports: { create: { status: "UPLOADED", sourceFilename: `${marker}-${version}.json`, sourceMimeType: "application/json" } },
    },
    include: { imports: true },
  });
  catalogIds.push(catalog.id);
  return catalog.imports[0].id;
}

function startWorker() {
  return spawn(process.execPath, ["--import", "tsx", "apps/worker/src/index.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, CATALOG_WORKER_INTERVAL_MS: "100" },
    stdio: "inherit",
  });
}

async function waitForImport(importId) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const item = await prisma.catalogImport.findUniqueOrThrow({ where: { id: importId } });
    if (item.status === "FAILED") throw new Error(`WORKER_SMOKE: import falhou: ${item.error}`);
    if (["COMPLETED", "NEEDS_REVIEW"].includes(item.status)) return item;
    await delay(100);
  }
  throw new Error("WORKER_SMOKE: timeout aguardando import.");
}

async function stopWorker(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(3_000)]);
  if (child.exitCode === null) child.kill();
}

try {
  const user = await ensureLocalUser();
  const membership = await prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
  const supplier = await prisma.supplier.create({ data: { userId: user.id, organizationId: membership.organizationId, name: marker } });
  supplierId = supplier.id;

  const firstImport = await enqueue(user.id, 1);
  const firstWorker = startWorker();
  await waitForImport(firstImport);
  await stopWorker(firstWorker);

  // The second job is persisted while no worker exists. A new process must recover and drain it.
  const secondImport = await enqueue(user.id, 2);
  const queued = await prisma.catalogImport.findUniqueOrThrow({ where: { id: secondImport } });
  if (queued.status !== "UPLOADED") throw new Error("WORKER_SMOKE: job não permaneceu persistido antes do restart.");
  const restartedWorker = startWorker();
  await waitForImport(secondImport);
  await stopWorker(restartedWorker);

  const persisted = await prisma.catalogProduct.count({ where: { catalogId: { in: catalogIds } } });
  if (persisted !== 2) throw new Error(`WORKER_SMOKE: esperados 2 itens persistidos, encontrados ${persisted}.`);
  console.log("Worker smoke: PASS (fila persistida, processamento, persistência e recovery após restart). ");
} finally {
  if (supplierId) {
    const catalogProducts = await prisma.catalogProduct.findMany({ where: { catalogId: { in: catalogIds } }, select: { id: true, linkedProductId: true } });
    for (const item of catalogProducts) if (item.linkedProductId) productIds.add(item.linkedProductId);
    const catalogProductIds = catalogProducts.map((item) => item.id);
    await prisma.productMatch.deleteMany({ where: { catalogProductId: { in: catalogProductIds } } });
    await prisma.supplierProductPrice.deleteMany({ where: { catalogId: { in: catalogIds } } });
    await prisma.catalogChange.deleteMany({ where: { OR: [{ catalogId: { in: catalogIds } }, { previousCatalogId: { in: catalogIds } }] } });
    await prisma.catalogProduct.deleteMany({ where: { catalogId: { in: catalogIds } } });
    await prisma.catalogImport.deleteMany({ where: { catalogId: { in: catalogIds } } });
    await prisma.catalog.deleteMany({ where: { id: { in: catalogIds } } });
    await prisma.supplierProductPrice.deleteMany({ where: { supplierProduct: { supplierId } } });
    await prisma.supplierProduct.deleteMany({ where: { supplierId } });
    await prisma.alert.deleteMany({ where: { user: { email: process.env.LOCAL_USER_EMAIL }, message: { contains: "Worker recovery fixture" } } });
    for (const productId of productIds) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
  }
  for (const sourceFile of sourceFiles) await unlink(sourceFile).catch(() => undefined);
  await prisma.$disconnect();
}
