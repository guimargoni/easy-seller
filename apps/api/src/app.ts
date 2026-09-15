import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { queueOpportunity, sha256 } from "@easy-seller/catalog";
import {
  calculateFinancials,
  calculateOpportunityScore,
  calculateRecommendedQuantity,
  generateOpportunitySummary,
  getScoreWeights,
  rankResearchCandidates,
  type OpportunityScoreInput,
  type ResearchCandidateInput,
  type StrategyProfile,
} from "@easy-seller/calculations";
import { prisma } from "@easy-seller/db";
import {
  localTenantContextResolver,
  recordAudit,
  TenantContextError,
  type TenantContext,
  type TenantContextResolver,
} from "./tenant-context.js";
import {
  AmazonPageObservationAdapter,
  AmazonSpApiAdapter,
  EstimatedAmazonFeesProvider,
  HttpAmazonSpApiClient,
  buildMonthlySalesTrend,
  estimateMonthlySalesFromRank,
  type AmazonSignal,
  type PageObservation,
} from "@easy-seller/amazon";

const money = (value: number | null | undefined) => (value == null ? null : value / 100);
const cents = (value: number | null | undefined) =>
  value == null ? null : Math.round(value * 100);
const percent = (value: number) => value / 100;
const toBasisPoints = (value: number) => Math.round(value * 100);
const nullableText = z.string().trim().min(1).nullable().optional();
const catalogMaxUploadBytes = Number(process.env.CATALOG_MAX_UPLOAD_BYTES ?? 256 * 1024 * 1024);
const catalogSourceSchema = z.enum(["PDF_UPLOAD", "CSV", "XLSX", "MANUAL", "EXTERNAL_URL"]);
const manualCatalogProductSchema = z.object({
  supplierSku: nullableText, ean: nullableText, gtin: nullableText,
  name: nullableText, brand: nullableText, model: nullableText, variant: nullableText,
  unitPrice: z.number().nonnegative().nullable().optional(), unitsPerBox: z.number().int().positive().nullable().optional(),
  minimumBoxes: z.number().int().positive().nullable().optional(), minimumUnits: z.number().int().positive().nullable().optional(),
  availability: nullableText,
});

const productSchema = z.object({
  name: z.string().trim().min(2),
  asin: nullableText,
  ean: nullableText,
  brand: nullableText,
  category: z.string().trim().min(2),
  amazonUrl: z.string().url().nullable().optional(),
  researchOrigin: nullableText,
  strategyType: z.enum(["BRANDED_RESELL", "GENERIC_LISTING"]),
  status: z.enum([
    "CANDIDATE",
    "RESEARCH",
    "VALIDATION",
    "RESEARCHING",
    "TEST",
    "READY_TO_BUY",
    "APPROVED",
    "DISCARDED",
    "WATCHING",
  ]),
  salePrice: z.number().positive().nullable().optional(),
  monthlySalesEstimate: z.number().int().nonnegative().nullable().optional(),
  sellerCount: z.number().int().nonnegative().nullable().optional(),
  amazonIsSeller: z.boolean().nullable().optional(),
  priceStability: z.number().min(0).max(100).nullable().optional(),
  demandStability: z.number().min(0).max(100).nullable().optional(),
  dataOrigin: z.enum(["REAL", "ESTIMATED", "INFERRED"]).default("INFERRED"),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().nonnegative().nullable().optional(),
  historyAvailable: z.boolean().default(false),
  estimatedTurnoverDays: z.number().int().positive().nullable().optional(),
  observations: nullableText,
  brandApprovalStatus: z
    .enum(["UNKNOWN", "NOT_REQUIRED", "REQUIRED", "APPROVED", "REJECTED"])
    .default("UNKNOWN"),
  amazonApprovalStatus: z
    .enum([
      "NOT_CHECKED",
      "OPEN",
      "REQUIRES_INVOICE",
      "REQUIRES_10_UNITS",
      "REQUIRES_LOA",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "UNAVAILABLE",
    ])
    .default("NOT_CHECKED"),
    approvalCheckedAt: z
      .string()
      .trim()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), "Data de verificação inválida.")
      .nullable()
      .optional(),
  approvalNotes: nullableText,
  approvalRequiredQuantity: z.number().int().positive().nullable().optional(),
  approvalDocumentType: nullableText,
  purchaseChecklist: z
    .object({
      checkedAmazonApproval: z.boolean(),
      hasValidSupplier: z.boolean(),
      supplierDocumentAccepted: z.boolean(),
      requiredQuantityViable: z.boolean(),
      approvalCompletedIfNeeded: z.boolean(),
    })
    .default({
      checkedAmazonApproval: false,
      hasValidSupplier: false,
      supplierDocumentAccepted: false,
      requiredQuantityViable: false,
      approvalCompletedIfNeeded: false,
    }),
  supplierId: nullableText,
  supplierSku: nullableText,
  cost: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  minimumQty: z.number().int().positive().nullable().optional(),
});
const supplierSchema = z.object({
  name: z.string().trim().min(2),
  legalName: nullableText,
  cnpj: nullableText,
  contact: nullableText,
  phone: nullableText,
  whatsapp: nullableText,
  email: z.string().email().nullable().optional(),
  website: nullableText,
  city: nullableText,
  state: z.string().trim().length(2).toUpperCase().nullable().optional(),
  notes: nullableText,
  minimumOrder: z.number().nonnegative().nullable().optional(),
  issuesInvoice: z.boolean().default(false),
  hasCatalog: z.boolean().default(false),
});
const settingsSchema = z
  .object({
    capitalTotal: z.number().nonnegative(),
    capitalReserve: z.number().nonnegative(),
    targetMarginMin: z.number().min(0).max(100),
    targetMarginIdeal: z.number().min(0).max(100),
    targetRoiMin: z.number().min(0).max(1000),
    maxTestExposurePercent: z.number().min(0).max(100),
    preferredMaxTurnoverDays: z.number().int().positive(),
    maximumSellerCount: z.number().int().positive(),
    strategyProfile: z.enum(["FAST_CASH", "BALANCED", "HIGH_MARGIN"]),
    simpleMode: z.boolean(),
  })
  .refine((v) => v.capitalReserve <= v.capitalTotal, {
    message: "A reserva não pode superar o capital total.",
    path: ["capitalReserve"],
  });
const analysisSchema = z.object({
  productId: z.string().min(1),
  salePrice: z.number().positive(),
  productCost: z.number().nonnegative(),
  inboundShipping: z.number().nonnegative().default(0),
  packaging: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(1).default(0),
  amazonCommission: z.number().nonnegative().default(0),
  amazonLogistics: z.number().nonnegative().default(0),
  advertising: z.number().nonnegative().default(0),
  otherExpenses: z.number().nonnegative().default(0),
  quantity: z.number().int().positive().default(1),
  targetMarginRate: z.number().min(0).max(1).optional(),
  monthlySales: z.number().nonnegative().default(0),
  sellerCount: z.number().int().nonnegative().default(0),
  priceStability: z.number().min(0).max(100).default(0),
  demandStability: z.number().min(0).max(100).default(0),
  amazonIsSeller: z.boolean().default(false),
  inventoryRisk: z.number().min(0).max(100).default(50),
  dataOrigin: z.enum(["REAL", "ESTIMATED", "INFERRED"]).default("INFERRED"),
});

const amazonIntelligenceSchema = z.object({
  asin: z.string().trim().regex(/^[A-Z0-9]{10}$/i).transform((value) => value.toUpperCase()),
  page: z.object({
    title: z.string().trim().min(2).optional(), price: z.number().positive().optional(),
    buyBoxPrice: z.number().positive().optional(), rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().int().nonnegative().optional(), sellerCount: z.number().int().nonnegative().optional(),
    amazonIsSeller: z.boolean().optional(), salesRank: z.number().int().positive().optional(),
    salesRankCategory: z.string().trim().min(1).optional(), observedAt: z.string().datetime().optional(),
  }).optional(),
  productCost: z.number().nonnegative().default(0), inboundShipping: z.number().nonnegative().default(0),
  packaging: z.number().nonnegative().default(0), taxRate: z.number().min(0).max(1).default(0.04),
  advertising: z.number().nonnegative().default(0), quantity: z.number().int().positive().default(1),
});

const inferredSignal = <T>(value: T, source: string): AmazonSignal<T> => ({ value, origin: "INFERRED", confidence: "LOW", source, observedAt: new Date().toISOString() });
function officialAmazonProvider() {
  const baseUrl = process.env.AMAZON_SP_API_BASE_URL;
  const token = process.env.AMAZON_SP_API_ACCESS_TOKEN;
  return baseUrl && token ? new AmazonSpApiAdapter(new HttpAmazonSpApiClient(baseUrl, token, process.env.AMAZON_MARKETPLACE_ID)) : null;
}
async function safely<T>(operation: (() => Promise<T>) | undefined): Promise<T | null> {
  if (!operation) return null;
  try { return await operation(); } catch { return null; }
}
async function collectAmazonIntelligence(asin: string, observation: PageObservation, priceHint?: number) {
  const official = officialAmazonProvider();
  const page = new AmazonPageObservationAdapter(observation);
  const [officialCatalog, pageCatalog, officialPricing, pagePricing, officialCompetition, pageCompetition, officialRank, pageRank] = await Promise.all([
    safely(official ? () => official.findByAsin(asin) : undefined), safely(() => page.findByAsin(asin)),
    safely(official ? () => official.getPricing(asin) : undefined), safely(() => page.getPricing(asin)),
    safely(official ? () => official.getCompetition(asin) : undefined), safely(() => page.getCompetition(asin)),
    safely(official ? () => official.getSalesRank(asin) : undefined), safely(() => page.getSalesRank(asin)),
  ]);
  const catalog = officialCatalog ?? pageCatalog;
  const pricing = officialPricing ?? pagePricing;
  const competition = officialCompetition ?? pageCompetition;
  const rank = officialRank ?? pageRank;
  const price = pricing?.price.value ?? priceHint;
  const estimatedFees = new EstimatedAmazonFeesProvider(Number(process.env.AMAZON_ESTIMATED_REFERRAL_RATE ?? 0.15), Number(process.env.AMAZON_ESTIMATED_LOGISTICS_BRL ?? 0));
  const officialFees = price == null ? null : await safely(official ? () => official.getFeesEstimate({ asin, price }) : undefined);
  const fees = price == null ? null : officialFees ?? await estimatedFees.getFeesEstimate({ asin, price });
  const monthlySales = rank ? inferredSignal(estimateMonthlySalesFromRank(rank.rank.value), "SALES_RANK_HEURISTIC_V1") : null;
  const turnoverDays = monthlySales ? inferredSignal(Math.max(1, Math.ceil(30 / monthlySales.value)), "MONTHLY_SALES_TO_TURNOVER_V1") : null;
  return { asin, catalog, pricing, fees, competition, rank, monthlySales, turnoverDays, provider: official ? "AMAZON_SP_API_WITH_PAGE_FALLBACK" : "PAGE_OBSERVATION_WITH_ESTIMATED_FEES" };
}

const monthlySalesHistoryStart = (referenceDate = new Date()) =>
  new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 2, 1));
async function loadMonthlySalesHistory(listingId: string, referenceDate = new Date()) {
  const snapshots = await prisma.rankSnapshot.findMany({
    where: { listingId, timestamp: { gte: monthlySalesHistoryStart(referenceDate) } },
    orderBy: { timestamp: "desc" },
  });
  return buildMonthlySalesTrend(snapshots, referenceDate);
}

const productInclude = {
  listings: { include: { priceSnapshots: { orderBy: { timestamp: "desc" as const }, take: 1 }, rankSnapshots: { orderBy: { timestamp: "desc" as const }, take: 1 }, competitionSnapshots: { orderBy: { timestamp: "desc" as const }, take: 1 } } },
  supplierProducts: { include: { supplier: true } },
  analyses: { orderBy: { createdAt: "desc" as const }, take: 1 },
  opportunities: { orderBy: { calculatedAt: "desc" as const }, take: 1 },
};
async function getProductRecord(id: string, organizationId: string) {
  return prisma.product.findFirst({ where: { id, organizationId }, include: productInclude });
}
type ProductRecord = NonNullable<Awaited<ReturnType<typeof getProductRecord>>>;
function serializeAnalysis(item: ProductRecord["analyses"][number], productName?: string) {
  return {
    id: item.id,
    productId: item.productId,
    productName,
    salePrice: money(item.salePriceCents),
    productCost: money(item.productCostCents),
    totalExpenses: money(item.totalExpensesCents),
    netProfit: money(item.netProfitCents),
    margin: percent(item.marginBasisPoints),
    roi: percent(item.roiBasisPoints),
    markup: percent(item.markupBasisPoints),
    breakEvenPrice: money(item.breakEvenPriceCents),
    maxPurchasePrice: money(item.maxPurchasePriceCents),
    score: item.score,
    classification: item.classification,
    scoreComponents: item.scoreComponents,
    positives: item.positives,
    warnings: item.warnings,
    strategyProfile: item.strategyProfile,
    dataOrigin: item.dataOrigin,
    createdAt: item.createdAt.toISOString(),
  };
}
function serializeProduct(item: ProductRecord) {
  const amazonListing = item.listings[0];
  const amazonPrice = amazonListing?.priceSnapshots[0];
  const amazonRank = amazonListing?.rankSnapshots[0];
  const amazonCompetition = amazonListing?.competitionSnapshots[0];
  return {
    id: item.id,
    name: item.name,
    asin: item.listings[0]?.asin ?? null,
    amazonUrl: item.listings[0]?.url ?? null,
    ean: item.ean,
    brand: item.brand,
    category: item.category ?? "Sem categoria",
    strategyType: item.strategyType,
    status: item.status,
    salePrice: money(item.salePriceCents),
    monthlySalesEstimate: item.monthlySalesEstimate,
    sellerCount: item.sellerCount,
    amazonIsSeller: item.amazonIsSeller,
    priceStability: item.priceStability,
    demandStability: item.demandStability,
    researchOrigin: item.researchOrigin,
    rating: item.ratingBasisPoints == null ? null : item.ratingBasisPoints / 100,
    reviewCount: item.reviewCount,
    historyAvailable: item.historyAvailable,
    estimatedTurnoverDays: item.estimatedTurnoverDays,
    observations: item.observations,
    brandApprovalStatus: item.brandApprovalStatus,
    amazonApprovalStatus: item.amazonApprovalStatus,
    approvalCheckedAt: item.approvalCheckedAt?.toISOString() ?? null,
    approvalNotes: item.approvalNotes,
    approvalRequiredQuantity: item.approvalRequiredQuantity,
    approvalDocumentType: item.approvalDocumentType,
    purchaseChecklist: {
      checkedAmazonApproval: item.checkedAmazonApproval,
      hasValidSupplier: item.hasValidSupplier,
      supplierDocumentAccepted: item.supplierDocumentAccepted,
      requiredQuantityViable: item.requiredQuantityViable,
      approvalCompletedIfNeeded: item.approvalCompletedIfNeeded,
    },
    dataOrigin: item.dataOrigin,
    suppliers: item.supplierProducts.map((link) => ({
      id: link.id,
      supplierId: link.supplierId,
      supplierName: link.supplier.name,
      supplierSku: link.supplierSku,
      cost: money(link.costCents),
      stock: link.stock,
      minimumQty: link.minimumQty,
    })),
    latestAnalysis: item.analyses[0] ? serializeAnalysis(item.analyses[0], item.name) : null,
    recommendedQuantity: item.opportunities[0]?.recommendedQty ?? null,
    amazonIntelligence: amazonListing ? {
      price: amazonPrice ? { value: money(amazonPrice.priceCents), origin: amazonPrice.origin, confidence: amazonPrice.confidence, source: amazonPrice.source, observedAt: amazonPrice.timestamp.toISOString() } : null,
      buyBoxPrice: amazonPrice?.buyBoxPriceCents != null ? { value: money(amazonPrice.buyBoxPriceCents), origin: amazonPrice.origin, confidence: amazonPrice.confidence, source: amazonPrice.source, observedAt: amazonPrice.timestamp.toISOString() } : null,
      salesRank: amazonRank ? { value: amazonRank.salesRank, origin: amazonRank.origin, confidence: amazonRank.confidence, source: amazonRank.source, observedAt: amazonRank.timestamp.toISOString() } : null,
      sellerCount: amazonCompetition ? { value: amazonCompetition.sellerCount, origin: amazonCompetition.origin, confidence: amazonCompetition.confidence, source: amazonCompetition.source, observedAt: amazonCompetition.timestamp.toISOString() } : null,
      amazonIsSeller: amazonCompetition ? { value: amazonCompetition.amazonIsSeller, origin: amazonCompetition.amazonOrigin, confidence: amazonCompetition.amazonConfidence, source: amazonCompetition.amazonSource, observedAt: amazonCompetition.timestamp.toISOString() } : null,
    } : null,
  };
}
type SupplierRecord = NonNullable<Awaited<ReturnType<typeof prisma.supplier.findFirst>>> & {
  _count?: { products: number };
};
function serializeSupplier(item: SupplierRecord) {
  return {
    id: item.id,
    name: item.name,
    legalName: item.legalName,
    cnpj: item.cnpj,
    contact: item.contact,
    phone: item.phone,
    whatsapp: item.whatsapp,
    email: item.email,
    website: item.website,
    city: item.city,
    state: item.state,
    notes: item.notes,
    minimumOrder: money(item.minimumOrderCents),
    issuesInvoice: item.issuesInvoice,
    hasCatalog: item.hasCatalog,
    productCount: item._count?.products ?? 0,
  };
}
function serializeSettings(
  item: NonNullable<Awaited<ReturnType<typeof prisma.userSettings.findUnique>>>,
) {
  return {
    capitalTotal: money(item.capitalTotalCents),
    capitalReserve: money(item.capitalReserveCents),
    targetMarginMin: percent(item.targetMarginMinBasisPoints),
    targetMarginIdeal: percent(item.targetMarginIdealBasisPoints),
    targetRoiMin: percent(item.targetRoiMinBasisPoints),
    maxTestExposurePercent: percent(item.maxTestExposureBasisPoints),
    preferredMaxTurnoverDays: item.preferredMaxTurnoverDays,
    maximumSellerCount: item.maximumSellerCount,
    strategyProfile: item.strategyProfile,
    simpleMode: item.simpleMode,
  };
}

function validateReadyToBuy(input: z.infer<typeof productSchema>) {
  if (input.status !== "READY_TO_BUY") return null;
  const checklist = input.purchaseChecklist;
  if (!Object.values(checklist).every(Boolean))
    return "Conclua todos os itens obrigatórios do checklist antes de marcar READY_TO_BUY.";
  if (
    input.strategyType === "BRANDED_RESELL" &&
    !["OPEN", "APPROVED"].includes(input.amazonApprovalStatus)
  )
    return "A autorização da Amazon precisa estar OPEN ou APPROVED antes de marcar READY_TO_BUY.";
  if (
    input.strategyType === "BRANDED_RESELL" &&
    !["NOT_REQUIRED", "APPROVED"].includes(input.brandApprovalStatus)
  )
    return "A autorização da marca precisa estar NOT_REQUIRED ou APPROVED antes de marcar READY_TO_BUY.";
  return null;
}
function productScalarData(v: z.infer<typeof productSchema>) {
  return {
    name: v.name,
    ean: v.ean ?? null,
    brand: v.brand ?? null,
    category: v.category,
    strategyType: v.strategyType,
    status: v.status,
    salePriceCents: cents(v.salePrice),
    monthlySalesEstimate: v.monthlySalesEstimate ?? null,
    sellerCount: v.sellerCount ?? null,
    amazonIsSeller: v.amazonIsSeller ?? null,
    priceStability: v.priceStability ?? null,
    demandStability: v.demandStability ?? null,
    researchOrigin: v.researchOrigin ?? null,
    ratingBasisPoints: v.rating == null ? null : Math.round(v.rating * 100),
    reviewCount: v.reviewCount ?? null,
    historyAvailable: v.historyAvailable,
    estimatedTurnoverDays: v.estimatedTurnoverDays ?? null,
    observations: v.observations ?? null,
    brandApprovalStatus: v.brandApprovalStatus,
    amazonApprovalStatus: v.amazonApprovalStatus,
    approvalCheckedAt: v.approvalCheckedAt ? new Date(v.approvalCheckedAt) : null,
    approvalNotes: v.approvalNotes ?? null,
    approvalRequiredQuantity: v.approvalRequiredQuantity ?? null,
    approvalDocumentType: v.approvalDocumentType ?? null,
    checkedAmazonApproval: v.purchaseChecklist.checkedAmazonApproval,
    hasValidSupplier: v.purchaseChecklist.hasValidSupplier,
    supplierDocumentAccepted: v.purchaseChecklist.supplierDocumentAccepted,
    requiredQuantityViable: v.purchaseChecklist.requiredQuantityViable,
    approvalCompletedIfNeeded: v.purchaseChecklist.approvalCompletedIfNeeded,
    dataOrigin: v.dataOrigin,
  };
}

async function createAnalysis(context: TenantContext, input: z.infer<typeof analysisSchema>) {
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId: context.userId } });
  const financials = calculateFinancials(input);
  const scoreInput: OpportunityScoreInput = {
    monthlySales: input.monthlySales,
    netMarginPercent: financials.netMarginPercent,
    roiPercent: financials.roiPercent,
    priceStability: input.priceStability,
    sellerCount: input.sellerCount,
    demandStability: input.demandStability,
    amazonIsSeller: input.amazonIsSeller,
    inventoryRisk: input.inventoryRisk,
  };
  const scored = calculateOpportunityScore(
    scoreInput,
    getScoreWeights(settings.strategyProfile as StrategyProfile),
  );
  const saved = await prisma.$transaction(async (tx) => {
    const analysis = await tx.analysis.create({
      data: {
      userId: context.userId,
      organizationId: context.organizationId,
      productId: input.productId,
      salePriceCents: cents(input.salePrice)!,
      productCostCents: cents(input.productCost)!,
      inboundShippingCents: cents(input.inboundShipping)!,
      packagingCents: cents(input.packaging)!,
      taxBasisPoints: toBasisPoints(input.taxRate * 100),
      amazonCommissionCents: cents(input.amazonCommission)!,
      amazonLogisticsCents: cents(input.amazonLogistics)!,
      advertisingCents: cents(input.advertising)!,
      otherExpensesCents: cents(input.otherExpenses)!,
      quantity: input.quantity,
      totalExpensesCents: cents(financials.totalExpensesPerUnit)!,
      netProfitCents: cents(financials.netProfitPerUnit)!,
      marginBasisPoints: toBasisPoints(financials.netMarginPercent),
      roiBasisPoints: toBasisPoints(financials.roiPercent),
      markupBasisPoints: toBasisPoints(financials.markupPercent),
      breakEvenPriceCents: cents(financials.breakEvenPrice)!,
      maxPurchasePriceCents: cents(financials.maxPurchasePrice)!,
      score: scored.score,
      classification: scored.classification,
      scoreComponents: scored.components,
      positives: scored.positives,
      warnings: scored.warnings,
      strategyProfile: settings.strategyProfile,
      dataOrigin: input.dataOrigin,
      },
    });
    await recordAudit(tx, context, {
      action: "ANALYSIS.CREATED",
      entityType: "Analysis",
      entityId: analysis.id,
      metadata: { productId: input.productId },
    });
    return analysis;
  });
  const available = Math.max(
    0,
    money(settings.capitalTotalCents)! - money(settings.capitalReserveCents)!,
  );
  return {
    ...serializeAnalysis(saved),
    financials,
    ...scored,
    recommendedQuantity: calculateRecommendedQuantity({
      monthlySalesEstimate: input.monthlySales,
      sellerCount: input.sellerCount,
      score: scored.score,
      capitalAvailable: available,
      unitCost: input.productCost,
      riskLevel: input.inventoryRisk >= 70 ? "HIGH" : input.inventoryRisk >= 40 ? "MEDIUM" : "LOW",
      maxExposurePercent: percent(settings.maxTestExposureBasisPoints),
    }),
    summary: generateOpportunitySummary({ ...scoreInput, score: scored.score }),
  };
}

async function getRealAvailableCapital(context: TenantContext) {
  const [settings, products] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId: context.userId } }),
    prisma.product.findMany({ where: { organizationId: context.organizationId }, include: { supplierProducts: true } }),
  ]);
  const committed = products.reduce((sum, product) => sum + product.supplierProducts.reduce((subtotal, link) => subtotal + link.costCents * (link.stock ?? 0), 0), 0);
  return { settings, availableCents: Math.max(0, settings.capitalTotalCents - settings.capitalReserveCents - committed) };
}

export async function buildApp(options: { tenantContextResolver?: TenantContextResolver } = {}) {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  });
  await app.register(multipart, { limits: { fileSize: catalogMaxUploadBytes, files: 1 } });
  const resolveTenantContext = options.tenantContextResolver ?? localTenantContextResolver;
  app.addHook("preHandler", async (request) => {
    if (request.routeOptions.url === "/health") return;
    request.tenant = await resolveTenantContext(request);
  });
  app.get("/health", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected", timestamp: new Date().toISOString() };
    } catch {
      return reply.code(503).send({ status: "error", database: "disconnected" });
    }
  });
  app.get("/settings", async (req) =>
    serializeSettings(await prisma.userSettings.findUniqueOrThrow({ where: { userId: req.tenant.userId } })),
  );
  app.put("/settings", async (req, reply) => {
    const p = settingsSchema.safeParse(req.body);
    if (!p.success)
      return reply.code(400).send({ error: "INVALID_SETTINGS", issues: p.error.issues });
    const v = p.data;
    const data = {
      capitalTotalCents: cents(v.capitalTotal)!,
      capitalReserveCents: cents(v.capitalReserve)!,
      targetMarginMinBasisPoints: toBasisPoints(v.targetMarginMin),
      targetMarginIdealBasisPoints: toBasisPoints(v.targetMarginIdeal),
      targetRoiMinBasisPoints: toBasisPoints(v.targetRoiMin),
      maxTestExposureBasisPoints: toBasisPoints(v.maxTestExposurePercent),
      preferredMaxTurnoverDays: v.preferredMaxTurnoverDays,
      maximumSellerCount: v.maximumSellerCount,
      strategyProfile: v.strategyProfile,
      simpleMode: v.simpleMode,
    };
    return serializeSettings(await prisma.$transaction(async (tx) => {
      const settings = await tx.userSettings.upsert({
        where: { userId: req.tenant.userId },
        create: { userId: req.tenant.userId, ...data },
        update: data,
      });
      await recordAudit(tx, req.tenant, {
        action: "SETTINGS.UPDATED",
        entityType: "UserSettings",
        entityId: settings.id,
      });
      return settings;
    }));
  });

  const catalogInclude = {
    supplier: true,
    imports: { orderBy: { createdAt: "desc" as const }, take: 1 },
    products: { orderBy: { overallConfidence: "asc" as const } },
    changes: { orderBy: { createdAt: "desc" as const } },
  };
  const serializeCatalogProduct = (item: any) => ({
    id: item.id, supplierSku: item.supplierSku, ean: item.ean, gtin: item.gtin,
    name: item.rawName, brand: item.brand, model: item.model, variant: item.variant,
    unitPrice: money(item.unitPriceCents), unitsPerBox: item.unitsPerBox, minimumBoxes: item.minimumBoxes,
    minimumUnits: item.minimumUnits, minimumInvestment: money(item.minimumInvestmentCents),
    capitalExposurePercentage: item.capitalExposureBasisPoints == null ? null : percent(item.capitalExposureBasisPoints),
    availability: item.availability, pageNumber: item.pageNumber, fieldConfidence: item.fieldConfidence,
    overallConfidence: item.overallConfidence, status: item.status, linkedProductId: item.linkedProductId,
  });
  const serializeCatalog = (item: any) => ({
    id: item.id, supplierId: item.supplierId, supplierName: item.supplier.name, name: item.name,
    sourceType: item.sourceType, sourceUrl: item.sourceUrl, catalogDate: item.catalogDate?.toISOString() ?? null,
    importedAt: item.importedAt.toISOString(), status: item.status, version: item.version,
    totalPages: item.totalPages, totalDetectedProducts: item.totalDetectedProducts,
    totalValidatedProducts: item.totalValidatedProducts,
    import: item.imports?.[0] ? { id: item.imports[0].id, status: item.imports[0].status, progressPercent: item.imports[0].progressPercent, error: item.imports[0].error, extractionMethod: item.imports[0].extractionMethod } : null,
    products: item.products?.map(serializeCatalogProduct) ?? [], changes: item.changes ?? [],
  });
  async function createCatalog(context: TenantContext, data: { supplierId: string; name: string; sourceType: z.infer<typeof catalogSourceSchema>; sourceFile?: string; sourceUrl?: string; catalogDate?: string; sourceFilename?: string; sourceMimeType?: string; sourceSizeBytes?: number; sourceSha256?: string }) {
    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, organizationId: context.organizationId } });
    if (!supplier) throw new Error("SUPPLIER_NOT_FOUND");
    return prisma.$transaction(async (tx) => {
      const latest = await tx.catalog.findFirst({ where: { supplierId: data.supplierId }, orderBy: { version: "desc" }, select: { version: true } });
      return tx.catalog.create({ data: {
        supplierId: data.supplierId, name: data.name, sourceType: data.sourceType, sourceFile: data.sourceFile,
        sourceUrl: data.sourceUrl, catalogDate: data.catalogDate ? new Date(data.catalogDate) : null,
        status: "UPLOADED", version: (latest?.version ?? 0) + 1,
        imports: { create: { status: "UPLOADED", sourceFilename: data.sourceFilename, sourceMimeType: data.sourceMimeType, sourceSizeBytes: data.sourceSizeBytes, sourceSha256: data.sourceSha256 } },
      }, include: catalogInclude });
    });
  }
  app.get("/catalogs", async (req) => (await prisma.catalog.findMany({ where: { supplier: { organizationId: req.tenant.organizationId } }, include: catalogInclude, orderBy: { importedAt: "desc" } })).map(serializeCatalog));
  app.get("/catalogs/:id", async (req, reply) => {
    const item = await prisma.catalog.findFirst({ where: { id: (req.params as { id: string }).id, supplier: { organizationId: req.tenant.organizationId } }, include: catalogInclude });
    return item ? serializeCatalog(item) : reply.code(404).send({ error: "NOT_FOUND" });
  });
  app.post("/catalogs/upload", async (req, reply) => {
    const fields: Record<string, string> = {};
    let file: { buffer: Buffer; filename: string; mimetype: string } | null = null;
    for await (const part of req.parts()) {
      if (part.type === "file") file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
      else fields[part.fieldname] = String(part.value);
    }
    const parsed = z.object({ supplierId: z.string().min(1), name: z.string().trim().min(2), catalogDate: z.string().optional() }).safeParse(fields);
    if (!parsed.success || !file) return reply.code(400).send({ error: "INVALID_CATALOG_UPLOAD", issues: parsed.success ? [{ message: "Arquivo obrigatório" }] : parsed.error.issues });
    const extension = file.filename.toLowerCase().split(".").pop();
    const sourceType = extension === "csv" ? "CSV" : extension === "xlsx" ? "XLSX" : extension === "pdf" ? "PDF_UPLOAD" : null;
    if (!sourceType) return reply.code(415).send({ error: "UNSUPPORTED_CATALOG", message: "Use CSV, XLSX ou PDF." });
    const storage = resolve(process.env.CATALOG_STORAGE_DIR ?? ".runtime/catalogs");
    await mkdir(storage, { recursive: true });
    const storedPath = resolve(storage, `${randomUUID()}.${extension}`);
    await writeFile(storedPath, file.buffer);
    try {
      const catalog = await createCatalog(req.tenant, { ...parsed.data, sourceType, sourceFile: storedPath, sourceFilename: file.filename, sourceMimeType: file.mimetype, sourceSizeBytes: file.buffer.length, sourceSha256: sha256(file.buffer) });
      await prisma.supplier.update({ where: { id: parsed.data.supplierId }, data: { hasCatalog: true } });
      return reply.code(202).send(serializeCatalog(catalog));
    } catch (error) {
      if (error instanceof Error && error.message === "SUPPLIER_NOT_FOUND") return reply.code(404).send({ error: error.message });
      throw error;
    }
  });
  app.post("/catalogs/manual", async (req, reply) => {
    const parsed = z.object({ supplierId: z.string().min(1), name: z.string().trim().min(2), catalogDate: z.string().optional(), products: z.array(manualCatalogProductSchema).min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_MANUAL_CATALOG", issues: parsed.error.issues });
    const buffer = Buffer.from(JSON.stringify(parsed.data.products.map((values) => ({ values, baseConfidence: 1, extractionMethod: "MANUAL" }))));
    const storage = resolve(process.env.CATALOG_STORAGE_DIR ?? ".runtime/catalogs"); await mkdir(storage, { recursive: true });
    const storedPath = resolve(storage, `${randomUUID()}.json`); await writeFile(storedPath, buffer);
    const catalog = await createCatalog(req.tenant, { ...parsed.data, sourceType: "MANUAL", sourceFile: storedPath, sourceFilename: `${parsed.data.name}.json`, sourceMimeType: "application/json", sourceSizeBytes: buffer.length, sourceSha256: sha256(buffer) });
    return reply.code(202).send(serializeCatalog(catalog));
  });
  app.post("/catalogs/reference", async (req, reply) => {
    const parsed = z.object({ supplierId: z.string().min(1), name: z.string().trim().min(2), sourceUrl: z.string().url(), catalogDate: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_CATALOG_REFERENCE", issues: parsed.error.issues });
    const catalog = await createCatalog(req.tenant, { ...parsed.data, sourceType: "EXTERNAL_URL" });
    await prisma.catalog.update({ where: { id: catalog.id }, data: { status: "NEEDS_REVIEW" } });
    await prisma.catalogImport.update({ where: { id: catalog.imports[0].id }, data: { status: "NEEDS_REVIEW", progressPercent: 100, finishedAt: new Date(), metadata: { note: "URL mantida somente como referência; nenhum conteúdo externo foi presumido." } } });
    return reply.code(201).send(serializeCatalog(await prisma.catalog.findUniqueOrThrow({ where: { id: catalog.id }, include: catalogInclude })));
  });
  app.patch("/catalog-products/:id/review", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = z.object({ action: z.enum(["CONFIRM", "EDIT", "IGNORE", "MERGE"]), mergeProductId: z.string().optional(), values: manualCatalogProductSchema.optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REVIEW", issues: parsed.error.issues });
    const item = await prisma.catalogProduct.findFirst({ where: { id, catalog: { supplier: { organizationId: req.tenant.organizationId } } }, include: { catalog: true } });
    if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
    if (parsed.data.action === "IGNORE") await prisma.catalogProduct.update({ where: { id }, data: { status: "IGNORED", reviewedAt: new Date() } });
    else {
      if (parsed.data.action === "EDIT") {
        if (!parsed.data.values) return reply.code(400).send({ error: "VALUES_REQUIRED" });
        const v = parsed.data.values;
        const quantity = v.minimumUnits ?? (v.minimumBoxes && v.unitsPerBox ? v.minimumBoxes * v.unitsPerBox : null);
        const investment = v.unitPrice != null && quantity != null ? cents(v.unitPrice)! * quantity : null;
        const capital = await getRealAvailableCapital(req.tenant);
        const exposure = investment != null && capital.availableCents > 0 ? Math.round(investment / capital.availableCents * 10_000) : null;
        await prisma.catalogProduct.update({ where: { id }, data: { supplierSku: v.supplierSku, ean: v.ean, gtin: v.gtin, rawName: v.name, normalizedName: v.name?.toLowerCase() ?? null, brand: v.brand, model: v.model, variant: v.variant, unitPriceCents: cents(v.unitPrice), unitsPerBox: v.unitsPerBox, minimumBoxes: v.minimumBoxes, minimumUnits: v.minimumUnits, minimumInvestmentCents: investment, capitalExposureBasisPoints: exposure, availability: v.availability, fieldConfidence: Object.fromEntries(Object.entries(v).filter(([, value]) => value != null).map(([key]) => [key, 1])), overallConfidence: 1 } });
        if (exposure != null && exposure > capital.settings.maxTestExposureBasisPoints) await prisma.alert.create({ data: { userId: req.tenant.userId, organizationId: req.tenant.organizationId, type: "CAPITAL_EXPOSURE", severity: exposure >= capital.settings.maxTestExposureBasisPoints * 2 ? "HIGH" : "MEDIUM", title: "Exposição de capital acima do limite", message: `${v.name ?? v.supplierSku ?? "Produto do catálogo"}: investimento mínimo compromete ${(exposure / 100).toFixed(2)}% do capital disponível.` } });
      }
      if (parsed.data.action === "MERGE" && !parsed.data.mergeProductId) return reply.code(400).send({ error: "MERGE_PRODUCT_REQUIRED" });
      await prisma.catalogProduct.update({ where: { id }, data: { status: parsed.data.action === "MERGE" ? "MERGED" : "CONFIRMED", reviewedAt: new Date() } });
      try { await queueOpportunity(id, req.tenant.userId, req.tenant.organizationId, parsed.data.mergeProductId); } catch (error) { if (error instanceof Error && error.message === "MERGE_PRODUCT_NOT_FOUND") return reply.code(404).send({ error: error.message }); throw error; }
    }
    const counts = await prisma.catalogProduct.groupBy({ by: ["status"], where: { catalogId: item.catalogId }, _count: true });
    const pending = counts.find((count) => count.status === "PENDING")?._count ?? 0;
    const validated = counts.filter((count) => ["CONFIRMED", "MERGED"].includes(count.status)).reduce((sum, count) => sum + count._count, 0);
    await prisma.catalog.update({ where: { id: item.catalogId }, data: { status: pending ? "NEEDS_REVIEW" : "COMPLETED", totalValidatedProducts: validated } });
    return serializeCatalogProduct(await prisma.catalogProduct.findUniqueOrThrow({ where: { id } }));
  });
  app.get("/supplier-products/:id/prices", async (req, reply) => {
    const link = await prisma.supplierProduct.findFirst({ where: { id: (req.params as { id: string }).id, supplier: { organizationId: req.tenant.organizationId } }, include: { priceHistory: { orderBy: { observedAt: "desc" }, include: { catalog: true } } } });
    if (!link) return reply.code(404).send({ error: "NOT_FOUND" });
    return link.priceHistory.map((price) => ({ price: money(price.priceCents), unitsPerBox: price.unitsPerBox, minimumQty: price.minimumQty, observedAt: price.observedAt.toISOString(), catalogId: price.catalogId, catalogVersion: price.catalog?.version ?? null }));
  });
  app.get("/catalog-opportunities", async (req) => {
    const rows = await prisma.catalogProduct.findMany({ where: { catalog: { supplier: { organizationId: req.tenant.organizationId } }, status: { in: ["CONFIRMED", "MERGED"] }, linkedProductId: { not: null }, availability: { not: "OUT_OF_STOCK" } }, include: { catalog: { include: { supplier: true } }, linkedProduct: true }, orderBy: [{ capitalExposureBasisPoints: "asc" }, { overallConfidence: "desc" }] });
    return rows.map((item, index) => ({ rank: index + 1, catalogProduct: serializeCatalogProduct(item), productId: item.linkedProductId, supplierName: item.catalog.supplier.name, catalogVersion: item.catalog.version, amazonDataStatus: "NOT_FETCHED", shortlistReason: item.capitalExposureBasisPoints == null ? "Dados validados; exposição depende de quantidade mínima e preço." : `Exposição de ${percent(item.capitalExposureBasisPoints).toFixed(2)}% do capital disponível.` }));
  });
  app.get("/alerts", async (req) => prisma.alert.findMany({ where: { organizationId: req.tenant.organizationId }, orderBy: { createdAt: "desc" }, take: 100 }));
  app.post("/amazon/intelligence", async (req, reply) => {
    const parsed = amazonIntelligenceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_AMAZON_INTELLIGENCE_REQUEST", issues: parsed.error.issues });
    const input = parsed.data;
    const intelligence = await collectAmazonIntelligence(input.asin, { asin: input.asin, ...input.page }, input.page?.price);
    const listingRecord = await prisma.amazonListing.findFirst({ where: { asin: input.asin, product: { organizationId: req.tenant.organizationId } }, include: { product: { include: { analyses: { where: { organizationId: req.tenant.organizationId }, orderBy: { createdAt: "desc" }, take: 1 } } }, priceSnapshots: { orderBy: { timestamp: "desc" }, take: 1 }, competitionSnapshots: { orderBy: { timestamp: "desc" }, take: 1 } } });
    const title = intelligence.catalog?.title.value ?? input.page?.title ?? `Produto Amazon ${input.asin}`;
    const listing = listingRecord ?? await prisma.amazonListing.create({ data: { asin: input.asin, origin: intelligence.catalog?.title.origin ?? intelligence.pricing?.price.origin ?? "INFERRED", product: { create: { userId: req.tenant.userId, organizationId: req.tenant.organizationId, name: title, category: intelligence.rank?.category.value ?? "Não informada", status: "RESEARCHING", strategyType: "BRANDED_RESELL", dataOrigin: intelligence.catalog?.title.origin ?? "INFERRED" } } }, include: { product: { include: { analyses: { where: { organizationId: req.tenant.organizationId }, orderBy: { createdAt: "desc" }, take: 1 } } }, priceSnapshots: { take: 0 }, competitionSnapshots: { take: 0 } } });
    const alerts: Array<{ type: string; severity: string; title: string; message: string }> = [];
    const previousPrice = listingRecord?.priceSnapshots[0];
    const previousCompetition = listingRecord?.competitionSnapshots[0];
    if (intelligence.pricing) {
      const current = intelligence.pricing.price;
      await prisma.priceSnapshot.create({ data: { listingId: listing.id, priceCents: cents(current.value)!, buyBoxPriceCents: cents(intelligence.pricing.buyBoxPrice?.value), shippingCents: cents(intelligence.pricing.shipping?.value), origin: current.origin, confidence: current.confidence, source: current.source, timestamp: new Date(current.observedAt) } });
      if (previousPrice && current.value < previousPrice.priceCents / 100) alerts.push({ type: "AMAZON_PRICE_DROP", severity: "MEDIUM", title: "Queda de preço", message: `${input.asin}: preço caiu de R$ ${(previousPrice.priceCents / 100).toFixed(2)} para R$ ${current.value.toFixed(2)}.` });
    }
    if (intelligence.rank) {
      const current = intelligence.rank.rank;
      await prisma.rankSnapshot.create({ data: { listingId: listing.id, salesRank: current.value, subcategoryRank: intelligence.rank.subcategoryRank?.value, category: intelligence.rank.category.value, origin: current.origin, confidence: current.confidence, source: current.source, timestamp: new Date(current.observedAt) } });
    }
    if (intelligence.competition) {
      const current = intelligence.competition.sellerCount;
      await prisma.competitionSnapshot.create({ data: { listingId: listing.id, sellerCount: current.value, fbaSellerCount: intelligence.competition.fbaSellerCount?.value, amazonIsSeller: intelligence.competition.amazonIsSeller.value, origin: current.origin, confidence: current.confidence, source: current.source, amazonOrigin: intelligence.competition.amazonIsSeller.origin, amazonConfidence: intelligence.competition.amazonIsSeller.confidence, amazonSource: intelligence.competition.amazonIsSeller.source, timestamp: new Date(current.observedAt) } });
      if (previousCompetition && current.value > previousCompetition.sellerCount) alerts.push({ type: "AMAZON_COMPETITION_UP", severity: "MEDIUM", title: "Concorrência aumentou", message: `${input.asin}: vendedores passaram de ${previousCompetition.sellerCount} para ${current.value}.` });
      if (previousCompetition && !previousCompetition.amazonIsSeller && intelligence.competition.amazonIsSeller.value) alerts.push({ type: "AMAZON_ENTERED", severity: "HIGH", title: "Amazon entrou na oferta", message: `${input.asin}: a Amazon passou a constar como vendedora.` });
    }
    if (intelligence.catalog) {
      const signal = intelligence.catalog.title;
      await prisma.amazonListing.update({ where: { id: listing.id }, data: { title: signal.value, brand: intelligence.catalog.brand?.value, imageUrl: intelligence.catalog.imageUrl?.value, ratingBasisPoints: intelligence.catalog.rating ? Math.round(intelligence.catalog.rating.value * 100) : undefined, reviewCount: intelligence.catalog.reviewCount?.value, historyAvailable: intelligence.catalog.historyAvailable.value, catalogOrigin: signal.origin, catalogConfidence: signal.confidence, catalogSource: signal.source, catalogObservedAt: new Date(signal.observedAt) } });
      await prisma.product.update({ where: { id: listing.productId }, data: { name: signal.value, brand: intelligence.catalog.brand?.value, ratingBasisPoints: intelligence.catalog.rating ? Math.round(intelligence.catalog.rating.value * 100) : undefined, reviewCount: intelligence.catalog.reviewCount?.value, historyAvailable: intelligence.catalog.historyAvailable.value, salePriceCents: intelligence.pricing ? cents(intelligence.pricing.price.value) : undefined, monthlySalesEstimate: intelligence.monthlySales?.value, estimatedTurnoverDays: intelligence.turnoverDays?.value, sellerCount: intelligence.competition?.sellerCount.value, amazonIsSeller: intelligence.competition?.amazonIsSeller.value } });
    }
    const salePrice = intelligence.pricing?.price.value ?? input.page?.price ?? 0;
    let decision = null;
    if (salePrice > 0 && intelligence.fees) {
      const financials = calculateFinancials({ salePrice, productCost: input.productCost, inboundShipping: input.inboundShipping, packaging: input.packaging, taxRate: input.taxRate, amazonCommission: intelligence.fees.commission.value, amazonLogistics: intelligence.fees.logistics.value, advertising: input.advertising, quantity: input.quantity, targetMarginRate: 0.15 });
      const scoreInput = { monthlySales: intelligence.monthlySales?.value ?? 0, netMarginPercent: financials.netMarginPercent, roiPercent: financials.roiPercent, priceStability: 50, sellerCount: intelligence.competition?.sellerCount.value ?? 0, demandStability: intelligence.rank ? 50 : 0, amazonIsSeller: intelligence.competition?.amazonIsSeller.value ?? false, inventoryRisk: intelligence.rank ? 40 : 60 };
      const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId: req.tenant.userId } });
      const score = calculateOpportunityScore(scoreInput, getScoreWeights(settings.strategyProfile as StrategyProfile));
      const available = Math.max(0, money(settings.capitalTotalCents)! - money(settings.capitalReserveCents)!);
      decision = { ...financials, ...score, recommendedQuantity: calculateRecommendedQuantity({ monthlySalesEstimate: scoreInput.monthlySales, sellerCount: scoreInput.sellerCount, score: score.score, capitalAvailable: available, unitCost: input.productCost, riskLevel: scoreInput.inventoryRisk >= 70 ? "HIGH" : scoreInput.inventoryRisk >= 40 ? "MEDIUM" : "LOW", maxExposurePercent: percent(settings.maxTestExposureBasisPoints) }), origin: "INFERRED", confidence: intelligence.rank ? "MEDIUM" : "LOW", source: "EASY_SELLER_CALCULATION_V1" };
      const previousMargin = listing.product.analyses[0]?.marginBasisPoints;
      if (previousMargin != null && financials.netMarginPercent < previousMargin / 100 - 2) alerts.push({ type: "AMAZON_MARGIN_DOWN", severity: "HIGH", title: "Margem caiu", message: `${input.asin}: margem caiu de ${(previousMargin / 100).toFixed(2)}% para ${financials.netMarginPercent.toFixed(2)}%.` });
    }
    if (alerts.length) await prisma.alert.createMany({ data: alerts.map((alert) => ({ ...alert, userId: req.tenant.userId, organizationId: req.tenant.organizationId })) });
    const monthlySalesHistory = await loadMonthlySalesHistory(listing.id);
    return { ...intelligence, monthlySalesHistory, decision, changes: alerts };
  });
  app.get("/amazon/intelligence/:asin", async (req, reply) => {
    const asin = (req.params as { asin: string }).asin.toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) return reply.code(400).send({ error: "INVALID_ASIN" });
    const listing = await prisma.amazonListing.findFirst({
      where: { asin, product: { organizationId: req.tenant.organizationId } },
      include: {
        product: { include: { analyses: { where: { organizationId: req.tenant.organizationId }, orderBy: { createdAt: "desc" }, take: 1 } } },
        priceSnapshots: { orderBy: { timestamp: "desc" }, take: 90 },
        rankSnapshots: { where: { timestamp: { gte: monthlySalesHistoryStart() } }, orderBy: { timestamp: "desc" } },
        competitionSnapshots: { orderBy: { timestamp: "desc" }, take: 90 },
      },
    });
    if (!listing) return reply.code(404).send({ error: "AMAZON_INTELLIGENCE_NOT_FOUND" });
    return {
      asin,
      catalog: { title: listing.title, brand: listing.brand, imageUrl: listing.imageUrl, rating: listing.ratingBasisPoints == null ? null : listing.ratingBasisPoints / 100, reviewCount: listing.reviewCount, historyAvailable: listing.historyAvailable, origin: listing.catalogOrigin, confidence: listing.catalogConfidence, source: listing.catalogSource, observedAt: listing.catalogObservedAt?.toISOString() ?? null },
      latestAnalysis: listing.product.analyses[0] ? serializeAnalysis(listing.product.analyses[0], listing.product.name) : null,
      priceSnapshots: listing.priceSnapshots.map((value) => ({ price: money(value.priceCents), buyBoxPrice: money(value.buyBoxPriceCents), shipping: money(value.shippingCents), origin: value.origin, confidence: value.confidence, source: value.source, observedAt: value.timestamp.toISOString() })),
      rankSnapshots: listing.rankSnapshots.map((value) => ({ rank: value.salesRank, subcategoryRank: value.subcategoryRank, category: value.category, origin: value.origin, confidence: value.confidence, source: value.source, observedAt: value.timestamp.toISOString() })),
      monthlySalesHistory: buildMonthlySalesTrend(listing.rankSnapshots),
      competitionSnapshots: listing.competitionSnapshots.map((value) => ({ sellerCount: value.sellerCount, fbaSellerCount: value.fbaSellerCount, amazonIsSeller: value.amazonIsSeller, origin: value.origin, confidence: value.confidence, source: value.source, amazonOrigin: value.amazonOrigin, amazonConfidence: value.amazonConfidence, amazonSource: value.amazonSource, observedAt: value.timestamp.toISOString() })),
    };
  });
  app.get("/products", async (req) =>
    (
      await prisma.product.findMany({
        where: { organizationId: req.tenant.organizationId },
        include: productInclude,
        orderBy: { updatedAt: "desc" },
      })
    ).map(serializeProduct),
  );
  app.get("/products/:id", async (req, reply) => {
    const item = await getProductRecord((req.params as { id: string }).id, req.tenant.organizationId);
    if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
    return serializeProduct(item);
  });
  app.post("/products", async (req, reply) => {
    const p = productSchema.safeParse(req.body);
    if (!p.success)
      return reply.code(400).send({ error: "INVALID_PRODUCT", issues: p.error.issues });
    const v = p.data;
    const readyError = validateReadyToBuy(v);
    if (readyError)
      return reply.code(409).send({ error: "READY_TO_BUY_BLOCKED", message: readyError });
    if (v.supplierId && !(await prisma.supplier.findFirst({ where: { id: v.supplierId, organizationId: req.tenant.organizationId } })))
      return reply.code(404).send({ error: "SUPPLIER_NOT_FOUND" });
    const item = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
        userId: req.tenant.userId,
        organizationId: req.tenant.organizationId,
        ...productScalarData(v),
        listings: v.asin
          ? { create: { asin: v.asin, url: v.amazonUrl ?? null, origin: v.dataOrigin } }
          : undefined,
        supplierProducts:
          v.supplierId && v.cost != null
            ? {
                create: {
                  supplierId: v.supplierId,
                  supplierSku: v.supplierSku ?? null,
                  costCents: cents(v.cost)!,
                  stock: v.stock ?? null,
                  minimumQty: v.minimumQty ?? null,
                },
              }
            : undefined,
        },
        include: productInclude,
      });
      await recordAudit(tx, req.tenant, {
        action: "PRODUCT.CREATED",
        entityType: "Product",
        entityId: product.id,
        metadata: { status: product.status },
      });
      return product;
    });
    return reply.code(201).send(serializeProduct(item));
  });
  app.put("/products/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    if (!(await prisma.product.findFirst({ where: { id, organizationId: req.tenant.organizationId } })))
      return reply.code(404).send({ error: "NOT_FOUND" });
    const p = productSchema.safeParse(req.body);
    if (!p.success)
      return reply.code(400).send({ error: "INVALID_PRODUCT", issues: p.error.issues });
    const v = p.data;
    const readyError = validateReadyToBuy(v);
    if (readyError)
      return reply.code(409).send({ error: "READY_TO_BUY_BLOCKED", message: readyError });
    if (v.supplierId && !(await prisma.supplier.findFirst({ where: { id: v.supplierId, organizationId: req.tenant.organizationId } })))
      return reply.code(404).send({ error: "SUPPLIER_NOT_FOUND" });
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: productScalarData(v) });
      await tx.amazonListing.deleteMany({ where: { productId: id } });
      if (v.asin)
        await tx.amazonListing.create({
          data: { productId: id, asin: v.asin, url: v.amazonUrl ?? null, origin: v.dataOrigin },
        });
      if (v.supplierId && v.cost != null) {
        const link = await tx.supplierProduct.findFirst({
          where: { productId: id, supplierId: v.supplierId },
        });
        const data = {
          supplierSku: v.supplierSku ?? null,
          costCents: cents(v.cost)!,
          stock: v.stock ?? null,
          minimumQty: v.minimumQty ?? null,
        };
        if (link) await tx.supplierProduct.update({ where: { id: link.id }, data });
        else
          await tx.supplierProduct.create({
            data: { ...data, productId: id, supplierId: v.supplierId },
          });
      }
      await recordAudit(tx, req.tenant, {
        action: "PRODUCT.UPDATED",
        entityType: "Product",
        entityId: id,
        metadata: { status: v.status },
      });
    });
    return serializeProduct((await getProductRecord(id, req.tenant.organizationId))!);
  });
  app.delete("/products/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.product.deleteMany({
        where: { id, organizationId: req.tenant.organizationId },
      });
      if (deleted.count) await recordAudit(tx, req.tenant, {
        action: "PRODUCT.DELETED",
        entityType: "Product",
        entityId: id,
      });
      return deleted;
    });
    return result.count ? reply.code(204).send() : reply.code(404).send({ error: "NOT_FOUND" });
  });
  app.post("/products/:id/suppliers", async (req, reply) => {
    const schema = z.object({
      supplierId: z.string().min(1),
      supplierSku: nullableText,
      cost: z.number().nonnegative(),
      stock: z.number().int().nonnegative().nullable().optional(),
      minimumQty: z.number().int().positive().nullable().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "INVALID_LINK", issues: p.error.issues });
    const productId = (req.params as { id: string }).id;
    const [product, supplier] = await Promise.all([
      prisma.product.findFirst({ where: { id: productId, organizationId: req.tenant.organizationId } }),
      prisma.supplier.findFirst({ where: { id: p.data.supplierId, organizationId: req.tenant.organizationId } }),
    ]);
    if (!product || !supplier) return reply.code(404).send({ error: "NOT_FOUND" });
    const existing = await prisma.supplierProduct.findFirst({
      where: { productId, supplierId: supplier.id },
    });
    const data = {
      supplierSku: p.data.supplierSku ?? null,
      costCents: cents(p.data.cost)!,
      stock: p.data.stock ?? null,
      minimumQty: p.data.minimumQty ?? null,
    };
    const link = await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.supplierProduct.update({ where: { id: existing.id }, data })
        : await tx.supplierProduct.create({
            data: { ...data, productId, supplierId: supplier.id },
          });
      await recordAudit(tx, req.tenant, {
        action: existing ? "PRODUCT.SUPPLIER_UPDATED" : "PRODUCT.SUPPLIER_LINKED",
        entityType: "Product",
        entityId: productId,
        metadata: { supplierId: supplier.id },
      });
      return saved;
    });
    return reply.code(existing ? 200 : 201).send(link);
  });
  app.get("/suppliers", async (req) =>
    (
      await prisma.supplier.findMany({
        where: { organizationId: req.tenant.organizationId },
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      })
    ).map((item) => serializeSupplier(item)),
  );
  app.get("/suppliers/:id", async (req, reply) => {
    const item = await prisma.supplier.findFirst({
      where: { id: (req.params as { id: string }).id, organizationId: req.tenant.organizationId },
      include: { _count: { select: { products: true } } },
    });
    return item ? serializeSupplier(item) : reply.code(404).send({ error: "NOT_FOUND" });
  });
  app.post("/suppliers", async (req, reply) => {
    const p = supplierSchema.safeParse(req.body);
    if (!p.success)
      return reply.code(400).send({ error: "INVALID_SUPPLIER", issues: p.error.issues });
    const v = p.data;
    const item = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
        userId: req.tenant.userId,
        organizationId: req.tenant.organizationId,
        name: v.name,
        legalName: v.legalName ?? null,
        cnpj: v.cnpj ?? null,
        contact: v.contact ?? null,
        phone: v.phone ?? null,
        whatsapp: v.whatsapp ?? null,
        email: v.email ?? null,
        website: v.website ?? null,
        city: v.city ?? null,
        state: v.state ?? null,
        notes: v.notes ?? null,
        minimumOrderCents: cents(v.minimumOrder),
        issuesInvoice: v.issuesInvoice,
        hasCatalog: v.hasCatalog,
        },
      });
      await recordAudit(tx, req.tenant, {
        action: "SUPPLIER.CREATED",
        entityType: "Supplier",
        entityId: supplier.id,
      });
      return supplier;
    });
    return reply.code(201).send(serializeSupplier(item));
  });
  app.put("/suppliers/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    if (!(await prisma.supplier.findFirst({ where: { id, organizationId: req.tenant.organizationId } })))
      return reply.code(404).send({ error: "NOT_FOUND" });
    const p = supplierSchema.safeParse(req.body);
    if (!p.success)
      return reply.code(400).send({ error: "INVALID_SUPPLIER", issues: p.error.issues });
    const v = p.data;
    return serializeSupplier(await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: { id },
        data: {
          name: v.name,
          legalName: v.legalName ?? null,
          cnpj: v.cnpj ?? null,
          contact: v.contact ?? null,
          phone: v.phone ?? null,
          whatsapp: v.whatsapp ?? null,
          email: v.email ?? null,
          website: v.website ?? null,
          city: v.city ?? null,
          state: v.state ?? null,
          notes: v.notes ?? null,
          minimumOrderCents: cents(v.minimumOrder),
          issuesInvoice: v.issuesInvoice,
          hasCatalog: v.hasCatalog,
        },
      });
      await recordAudit(tx, req.tenant, {
        action: "SUPPLIER.UPDATED",
        entityType: "Supplier",
        entityId: id,
      });
      return supplier;
    }));
  });
  app.delete("/suppliers/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.supplier.deleteMany({
        where: { id, organizationId: req.tenant.organizationId },
      });
      if (deleted.count) await recordAudit(tx, req.tenant, {
        action: "SUPPLIER.DELETED",
        entityType: "Supplier",
        entityId: id,
      });
      return deleted;
    });
    return result.count ? reply.code(204).send() : reply.code(404).send({ error: "NOT_FOUND" });
  });
  app.post("/calculations", async (req, reply) => {
    const p = analysisSchema.omit({ productId: true, dataOrigin: true }).safeParse(req.body);
    if (!p.success)
      return reply.code(400).send({ error: "INVALID_CALCULATION", issues: p.error.issues });
    const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId: req.tenant.userId } });
    const financials = calculateFinancials(p.data);
    const scoreInput = {
      monthlySales: p.data.monthlySales,
      netMarginPercent: financials.netMarginPercent,
      roiPercent: financials.roiPercent,
      priceStability: p.data.priceStability,
      sellerCount: p.data.sellerCount,
      demandStability: p.data.demandStability,
      amazonIsSeller: p.data.amazonIsSeller,
      inventoryRisk: p.data.inventoryRisk,
    };
    return {
      ...financials,
      ...calculateOpportunityScore(
        scoreInput,
        getScoreWeights(settings.strategyProfile as StrategyProfile),
      ),
    };
  });
  app.get("/analyses", async (req) => {
    const rows = await prisma.analysis.findMany({
      where: { organizationId: req.tenant.organizationId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => serializeAnalysis(row, row.product.name));
  });
  app.post("/analyses", async (req, reply) => {
    const p = analysisSchema.safeParse(req.body);
    if (!p.success)
      return reply.code(400).send({ error: "INVALID_ANALYSIS", issues: p.error.issues });
    if (!(await prisma.product.findFirst({ where: { id: p.data.productId, organizationId: req.tenant.organizationId } })))
      return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
    return reply.code(201).send(await createAnalysis(req.tenant, p.data));
  });
  app.post("/extension/analyses", async (req, reply) => {
    const schema = analysisSchema
      .omit({ productId: true })
      .extend({
        asin: z.string().trim().min(10),
        productName: z.string().trim().min(2).default("Produto Amazon"),
      });
    const p = schema.safeParse(req.body);
    if (!p.success)
      return reply.code(400).send({ error: "INVALID_EXTENSION_ANALYSIS", issues: p.error.issues });
    const listing = await prisma.amazonListing.findFirst({
      where: { asin: p.data.asin, product: { organizationId: req.tenant.organizationId } },
      include: { product: true },
    });
    const product =
      listing?.product ??
      (await prisma.product.create({
        data: {
          userId: req.tenant.userId,
          organizationId: req.tenant.organizationId,
          name: p.data.productName,
          category: "Não informada",
          strategyType: "BRANDED_RESELL",
          status: "RESEARCHING",
          salePriceCents: cents(p.data.salePrice),
          dataOrigin: p.data.dataOrigin,
          listings: { create: { asin: p.data.asin, origin: p.data.dataOrigin } },
        },
      }));
    return reply
      .code(201)
      .send(await createAnalysis(req.tenant, { ...p.data, productId: product.id }));
  });
  app.get("/research/candidates", async (req) => {
    const [settings, rows] = await Promise.all([
      prisma.userSettings.findUniqueOrThrow({ where: { userId: req.tenant.userId } }),
      prisma.product.findMany({
        where: { organizationId: req.tenant.organizationId, status: { not: "DISCARDED" } },
        include: productInclude,
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    const available = Math.max(
      0,
      money(settings.capitalTotalCents)! - money(settings.capitalReserveCents)!,
    );
    const serialized = rows.map(serializeProduct);
    const candidates: ResearchCandidateInput[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      strategyType: row.strategyType,
      estimatedCost: money(row.supplierProducts[0]?.costCents) ?? 0,
      amazonPrice: money(row.salePriceCents) ?? 0,
      estimatedDemand: row.monthlySalesEstimate ?? 0,
      sellerCount: row.sellerCount ?? 0,
      rating: row.ratingBasisPoints == null ? null : row.ratingBasisPoints / 100,
      reviewCount: row.reviewCount ?? 0,
      historyAvailable: row.historyAvailable,
      estimatedTurnoverDays: row.estimatedTurnoverDays,
      amazonIsSeller: row.amazonIsSeller ?? false,
      brandApprovalStatus: row.brandApprovalStatus,
      amazonApprovalStatus: row.amazonApprovalStatus,
      minimumRequiredQuantity:
        row.approvalRequiredQuantity ?? row.supplierProducts[0]?.minimumQty ?? 1,
    }));
    const ranked = rankResearchCandidates(candidates, {
      minimumMarginPercent: percent(settings.targetMarginMinBasisPoints),
      idealMarginPercent: percent(settings.targetMarginIdealBasisPoints),
      minimumRoiPercent: percent(settings.targetRoiMinBasisPoints),
      maximumTurnoverDays: settings.preferredMaxTurnoverDays,
      maximumSellerCount: settings.maximumSellerCount,
      maximumCapitalExposure: (available * percent(settings.maxTestExposureBasisPoints)) / 100,
    });
    return ranked.map((item) => ({
      ...item,
      candidate: serialized.find((product) => product.id === item.candidate.id)!,
    }));
  });
  app.get("/dashboard", async (req) => {
    const [settings, products, analyses, current] = await Promise.all([
      prisma.userSettings.findUniqueOrThrow({ where: { userId: req.tenant.userId } }),
      prisma.product.findMany({ where: { organizationId: req.tenant.organizationId }, include: { supplierProducts: true } }),
      prisma.analysis.findMany({ where: { organizationId: req.tenant.organizationId }, orderBy: { createdAt: "desc" } }),
      prisma.user.findUniqueOrThrow({ where: { id: req.tenant.userId } }),
    ]);
    const committed =
      products.reduce(
        (sum, p) =>
          sum + p.supplierProducts.reduce((inner, l) => inner + l.costCents * (l.stock ?? 0), 0),
        0,
      ) / 100;
    const total = money(settings.capitalTotalCents)!;
    const reserve = money(settings.capitalReserveCents)!;
    const latestMap = new Map<string, (typeof analyses)[number]>();
    for (const item of analyses)
      if (!latestMap.has(item.productId)) latestMap.set(item.productId, item);
    const latest = [...latestMap.values()];
    return {
      isDemo: current.isDemo,
      capitalTotal: total,
      capitalReserve: reserve,
      capitalCommitted: committed,
      capitalAvailable: Math.max(0, total - reserve - committed),
      projectedProfit: latest.length
        ? latest.reduce((sum, a) => sum + money(a.netProfitCents)! * a.quantity, 0)
        : null,
      averageRoi: latest.length
        ? latest.reduce((sum, a) => sum + percent(a.roiBasisPoints), 0) / latest.length
        : null,
      activeProducts: products.filter((p) => p.status !== "DISCARDED").length,
      testProducts: products.filter((p) => p.status === "TEST").length,
      recentAnalyses: latest
        .slice(0, 5)
        .map((a) => serializeAnalysis(a, products.find((p) => p.id === a.productId)?.name)),
    };
  });
  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    if (error instanceof TenantContextError) {
      return reply.code(error.statusCode).send({ error: error.code });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.code(413).send({
        error: "CATALOG_FILE_TOO_LARGE",
        message: `O arquivo excede o limite de ${Math.floor(catalogMaxUploadBytes / 1024 / 1024)} MB.`,
      });
    }
    reply
      .code(500)
      .send({ error: "INTERNAL_ERROR", message: "Não foi possível concluir a operação." });
  });
  return app;
}
