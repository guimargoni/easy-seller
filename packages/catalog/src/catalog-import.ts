import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { prisma } from "@easy-seller/db";
import { CatalogNormalizer } from "./catalog-normalizer.js";
import { PdfImageExtractor, PdfLayoutExtractor, PdfOcrExtractor, PdfTextExtractor } from "./pdf-extractors.js";
import { ProductBlockDetector } from "./product-block-detector.js";
import type { NormalizedCatalogProduct, RawCatalogRecord } from "./types.js";
import { detectCatalogChanges } from "./catalog-version.js";

const normalizer = new CatalogNormalizer();
const detector = new ProductBlockDetector();
const reviewThreshold = Number(process.env.CATALOG_CONFIDENCE_THRESHOLD ?? 0.75);
export const shouldRunPdfOcr = (hasNativeText: boolean, detectedProducts: number) => !hasNativeText && detectedProducts === 0;

export async function extractTabularRecords(buffer: Buffer, sourceType: "CSV" | "XLSX"): Promise<RawCatalogRecord[]> {
  if (sourceType === "CSV") {
    const firstLine = buffer.toString("utf8").split(/\r?\n/, 1)[0] ?? "";
    const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
    const rows = parseCsv(buffer, { bom: true, delimiter, relax_column_count: true, skip_empty_lines: true }) as unknown[][];
    const headers = (rows.shift() ?? []).map((value) => String(value).trim());
    return rows.map((row) => ({ values: Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])), rawText: row.map(String).join(";"), baseConfidence: 0.98, extractionMethod: "TABULAR" }));
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const records: RawCatalogRecord[] = [];
  workbook.eachSheet((sheet) => {
    const headers = (sheet.getRow(1).values as unknown[]).slice(1).map((value) => String(value ?? "").trim());
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const cells = (row.values as unknown[]).slice(1).map((value) => typeof value === "object" && value && "text" in value ? (value as { text: string }).text : value);
      if (cells.every((value) => value == null || String(value).trim() === "")) return;
      records.push({ values: Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? null])), rawText: JSON.stringify(cells), baseConfidence: 0.98, extractionMethod: "TABULAR" });
    });
  });
  return records;
}

async function pdfRecords(buffer: Buffer) {
  const nativePages = await new PdfTextExtractor().extract(buffer);
  const hasNativeText = nativePages.some((page) => page.lines.some((line) => line.trim().length > 0));
  let records = detector.detect(nativePages, "NATIVE_TEXT");
  if (records.length) return { records, method: "NATIVE_TEXT" as const, totalPages: nativePages.length };
  const layoutPages = await new PdfLayoutExtractor().extract(buffer);
  records = detector.detect(layoutPages, "LAYOUT");
  if (records.length) return { records, method: "LAYOUT" as const, totalPages: layoutPages.length };
  if (!shouldRunPdfOcr(hasNativeText, records.length)) return { records: [], method: "LAYOUT" as const, totalPages: nativePages.length };
  const hasImages = await new PdfImageExtractor().hasImages(buffer);
  if (hasImages) {
    // Images are detected before OCR; no values are derived without readable evidence.
  }
  const ocrPages = await new PdfOcrExtractor().extract(buffer);
  records = detector.detect(ocrPages, "OCR");
  return { records, method: hasImages ? "OCR" as const : "LAYOUT" as const, totalPages: nativePages.length };
}

async function compareCatalogVersions(catalogId: string, supplierId: string, version: number) {
  const previous = await prisma.catalog.findFirst({ where: { supplierId, version: { lt: version }, status: { in: ["COMPLETED", "NEEDS_REVIEW"] } }, orderBy: { version: "desc" }, include: { products: true } });
  if (!previous) return;
  const current = await prisma.catalog.findUniqueOrThrow({ where: { id: catalogId }, include: { products: true } });
  const changes = detectCatalogChanges(previous.products, current.products);
  if (changes.length) await prisma.catalogChange.createMany({ data: changes.map((change) => ({ ...change, catalogId, previousCatalogId: previous.id })) });
}

async function capitalAvailableCents(userId: string, organizationId: string) {
  const [settings, products] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    prisma.product.findMany({ where: { organizationId }, include: { supplierProducts: true } }),
  ]);
  const committed = products.reduce((sum, product) => sum + product.supplierProducts.reduce((subtotal, link) => subtotal + link.costCents * (link.stock ?? 0), 0), 0);
  return { available: Math.max(0, settings.capitalTotalCents - settings.capitalReserveCents - committed), maxExposure: settings.maxTestExposureBasisPoints };
}

async function persistProducts(catalog: { id: string; supplierId: string; supplier: { userId: string; organizationId: string | null } }, products: NormalizedCatalogProduct[]) {
  const organizationId = catalog.supplier.organizationId;
  if (!organizationId) throw new Error("CATALOG_TENANT_CONTEXT_MISSING");
  const capital = await capitalAvailableCents(catalog.supplier.userId, organizationId);
  for (const item of products) {
    const exposure = item.minimumInvestmentCents != null && capital.available > 0 ? Math.round(item.minimumInvestmentCents / capital.available * 10_000) : null;
    const status = item.overallConfidence >= reviewThreshold ? "CONFIRMED" : "PENDING";
    const saved = await prisma.catalogProduct.create({ data: {
      catalogId: catalog.id, supplierSku: item.supplierSku, ean: item.ean, gtin: item.gtin, rawName: item.rawName,
      normalizedName: item.normalizedName, brand: item.brand, model: item.model, variant: item.variant,
      unitPriceCents: item.unitPriceCents, unitsPerBox: item.unitsPerBox, minimumBoxes: item.minimumBoxes,
      minimumUnits: item.minimumUnits, minimumInvestmentCents: item.minimumInvestmentCents, capitalExposureBasisPoints: exposure,
      availability: item.availability, pageNumber: item.pageNumber, rawText: item.rawText,
      fieldConfidence: item.fieldConfidence, extractionConfidence: item.overallConfidence, overallConfidence: item.overallConfidence, status,
    } });
    if (exposure != null && exposure > capital.maxExposure) await prisma.alert.create({ data: {
      userId: catalog.supplier.userId, organizationId, type: "CAPITAL_EXPOSURE", severity: exposure >= capital.maxExposure * 2 ? "HIGH" : "MEDIUM",
      title: "Exposição de capital acima do limite",
      message: `${item.rawName ?? item.supplierSku ?? "Produto do catálogo"}: investimento mínimo compromete ${(exposure / 100).toFixed(2)}% do capital disponível.`,
    } });
    if (status === "CONFIRMED") await queueOpportunity(saved.id, catalog.supplier.userId, organizationId);
  }
}

export async function queueOpportunity(catalogProductId: string, userId: string, organizationId: string, mergeProductId?: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.catalogProduct.findFirst({ where: { id: catalogProductId, catalog: { supplier: { organizationId } } }, include: { catalog: true } });
    if (!item) throw new Error("CATALOG_PRODUCT_NOT_FOUND");
    if (item.linkedProductId) return item.linkedProductId;
    let productId = mergeProductId;
    if (productId && !(await tx.product.findFirst({ where: { id: productId, organizationId } }))) throw new Error("MERGE_PRODUCT_NOT_FOUND");
    if (!productId) {
      if (!item.rawName) return null;
      const existingLink = item.supplierSku ? await tx.supplierProduct.findFirst({ where: { supplierId: item.catalog.supplierId, supplierSku: item.supplierSku }, select: { productId: true, product: { select: { organizationId: true } } } }) : null;
      const existingEan = item.ean ? await tx.product.findFirst({ where: { organizationId, ean: item.ean }, select: { id: true } }) : null;
      productId = existingLink?.product?.organizationId === organizationId ? existingLink.productId ?? undefined : existingEan?.id ?? undefined;
      if (!productId) productId = (await tx.product.create({ data: { userId, organizationId, name: item.rawName, brand: item.brand, ean: item.ean ?? item.gtin, category: null, strategyType: "BRANDED_RESELL", status: "CANDIDATE", researchOrigin: `CATALOG:${item.catalogId}`, dataOrigin: "REAL" } })).id;
    }
    if (item.unitPriceCents != null) {
      const link = await tx.supplierProduct.findFirst({ where: { supplierId: item.catalog.supplierId, productId } });
      const supplierProduct = link ? await tx.supplierProduct.update({ where: { id: link.id }, data: { supplierSku: item.supplierSku, costCents: item.unitPriceCents, minimumQty: item.minimumUnits } }) : await tx.supplierProduct.create({ data: { supplierId: item.catalog.supplierId, productId, supplierSku: item.supplierSku, costCents: item.unitPriceCents, minimumQty: item.minimumUnits } });
      await tx.supplierProductPrice.create({ data: { supplierProductId: supplierProduct.id, priceCents: item.unitPriceCents, unitsPerBox: item.unitsPerBox, minimumQty: item.minimumUnits, catalogId: item.catalogId } });
    }
    await tx.catalogProduct.update({ where: { id: item.id }, data: { linkedProductId: productId, opportunityQueuedAt: new Date() } });
    return productId;
  });
}

export async function processCatalogImport(importId: string) {
  const claimed = await prisma.catalogImport.updateMany({ where: { id: importId, status: "UPLOADED" }, data: { status: "PROCESSING", progressPercent: 5, startedAt: new Date() } });
  if (!claimed.count) return false;
  try {
    const job = await prisma.catalogImport.findUniqueOrThrow({ where: { id: importId }, include: { catalog: { include: { supplier: true } } } });
    const buffer = job.catalog.sourceFile ? await readFile(job.catalog.sourceFile) : Buffer.from("[]");
    let records: RawCatalogRecord[] = [];
    let method = "MANUAL";
    let totalPages: number | null = null;
    if (job.catalog.sourceType === "CSV" || job.catalog.sourceType === "XLSX") { records = await extractTabularRecords(buffer, job.catalog.sourceType); method = "TABULAR"; }
    else if (job.catalog.sourceType === "PDF_UPLOAD") { const pdf = await pdfRecords(buffer); records = pdf.records; method = pdf.method; totalPages = pdf.totalPages; }
    else if (job.catalog.sourceType === "MANUAL") { records = JSON.parse(buffer.toString("utf8")) as RawCatalogRecord[]; }
    const normalized = records.map((record) => normalizer.normalize(record)).filter((item) => item.rawName || item.supplierSku || item.ean || item.gtin);
    await prisma.catalogImport.update({ where: { id: importId }, data: { progressPercent: 55, totalPages, extractionMethod: method } });
    await persistProducts(job.catalog, normalized);
    const pending = normalized.filter((item) => item.overallConfidence < reviewThreshold).length;
    const finalStatus = pending || normalized.length === 0 ? "NEEDS_REVIEW" : "COMPLETED";
    await prisma.catalog.update({ where: { id: job.catalogId }, data: { status: finalStatus, totalPages, totalDetectedProducts: normalized.length, totalValidatedProducts: normalized.length - pending } });
    await compareCatalogVersions(job.catalogId, job.catalog.supplierId, job.catalog.version);
    await prisma.catalogImport.update({ where: { id: importId }, data: { status: finalStatus, progressPercent: 100, finishedAt: new Date() } });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.catalogImport.update({ where: { id: importId }, data: { status: "FAILED", error: message.slice(0, 2000), finishedAt: new Date() } });
    const job = await prisma.catalogImport.findUnique({ where: { id: importId } });
    if (job) await prisma.catalog.update({ where: { id: job.catalogId }, data: { status: "FAILED" } });
    throw error;
  }
}

export async function processNextCatalogImport() {
  const next = await prisma.catalogImport.findFirst({ where: { status: "UPLOADED" }, orderBy: { createdAt: "asc" } });
  return next ? processCatalogImport(next.id) : false;
}

export class CatalogImport {
  process(importId: string) { return processCatalogImport(importId); }
  processNext() { return processNextCatalogImport(); }
}

export const sha256 = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
export { CatalogNormalizer } from "./catalog-normalizer.js";
export { PdfTextExtractor, PdfLayoutExtractor } from "./pdf-extractors.js";
export { ProductBlockDetector } from "./product-block-detector.js";
export { detectCatalogChanges, catalogProductKey } from "./catalog-version.js";
