import { processNextCatalogImport } from "@easy-seller/catalog";
import { prisma } from "@easy-seller/db";

const intervalMs = Math.max(1_000, Number(process.env.CATALOG_WORKER_INTERVAL_MS ?? 2_000));
let stopping = false;

async function tick() {
  try {
    while (!stopping && await processNextCatalogImport()) {
      // Drain persisted jobs before sleeping.
    }
  } catch (error) {
    console.error("Falha ao processar importação de catálogo", error);
  }
}

const timer = setInterval(tick, intervalMs);
void tick();
console.log(`Worker de catálogos ativo (intervalo ${intervalMs}ms).`);

async function shutdown() {
  stopping = true;
  clearInterval(timer);
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
