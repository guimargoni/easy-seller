export type DataOrigin = "REAL" | "ESTIMATED" | "INFERRED";
export type DataConfidence = "HIGH" | "MEDIUM" | "LOW";
export type ProductStatus =
  | "CANDIDATE"
  | "RESEARCH"
  | "VALIDATION"
  | "RESEARCHING"
  | "TEST"
  | "READY_TO_BUY"
  | "APPROVED"
  | "DISCARDED"
  | "WATCHING";
export type StrategyType = "BRANDED_RESELL" | "GENERIC_LISTING";
export type StrategyProfile = "FAST_CASH" | "BALANCED" | "HIGH_MARGIN";
export type BrandApprovalStatus = "UNKNOWN" | "NOT_REQUIRED" | "REQUIRED" | "APPROVED" | "REJECTED";
export type AmazonApprovalStatus =
  | "NOT_CHECKED"
  | "OPEN"
  | "REQUIRES_INVOICE"
  | "REQUIRES_10_UNITS"
  | "REQUIRES_LOA"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "UNAVAILABLE";
export type ProductRecommendation = "BUY_TEST" | "WATCH" | "AVOID";

export interface PurchaseChecklist {
  checkedAmazonApproval: boolean;
  hasValidSupplier: boolean;
  supplierDocumentAccepted: boolean;
  requiredQuantityViable: boolean;
  approvalCompletedIfNeeded: boolean;
}

export interface SupplierLink {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierSku: string | null;
  cost: number;
  stock: number | null;
  minimumQty: number | null;
}

export interface Product {
  id: string;
  name: string;
  asin: string | null;
  amazonUrl: string | null;
  ean: string | null;
  brand: string | null;
  category: string;
  strategyType: StrategyType;
  status: ProductStatus;
  salePrice: number | null;
  monthlySalesEstimate: number | null;
  sellerCount: number | null;
  amazonIsSeller: boolean | null;
  priceStability: number | null;
  demandStability: number | null;
  researchOrigin: string | null;
  rating: number | null;
  reviewCount: number | null;
  historyAvailable: boolean;
  estimatedTurnoverDays: number | null;
  observations: string | null;
  brandApprovalStatus: BrandApprovalStatus;
  amazonApprovalStatus: AmazonApprovalStatus;
  approvalCheckedAt: string | null;
  approvalNotes: string | null;
  approvalRequiredQuantity: number | null;
  approvalDocumentType: string | null;
  purchaseChecklist: PurchaseChecklist;
  dataOrigin: DataOrigin;
  suppliers: SupplierLink[];
  latestAnalysis?: Analysis | null;
  recommendedQuantity?: number | null;
  amazonIntelligence?: {
    price: DataSignal<number | null> | null;
    buyBoxPrice: DataSignal<number | null> | null;
    salesRank: DataSignal<number> | null;
    sellerCount: DataSignal<number> | null;
    amazonIsSeller: DataSignal<boolean> | null;
  } | null;
}

export interface DataSignal<T> {
  value: T;
  origin: DataOrigin;
  confidence: DataConfidence;
  source: string;
  observedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  contact: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  minimumOrder: number | null;
  issuesInvoice: boolean;
  hasCatalog: boolean;
  productCount?: number;
}

export interface UserSettings {
  capitalTotal: number;
  capitalReserve: number;
  targetMarginMin: number;
  targetMarginIdeal: number;
  targetRoiMin: number;
  maxTestExposurePercent: number;
  preferredMaxTurnoverDays: number;
  maximumSellerCount: number;
  strategyProfile: StrategyProfile;
  simpleMode: boolean;
}

export interface RankedCandidate {
  rank: number;
  candidate: Product;
  analysis: {
    candidateId: string;
    score: number;
    recommendation: ProductRecommendation;
    estimatedMarginPercent: number;
    estimatedRoiPercent: number;
    estimatedCapitalExposure: number;
    reasons: string[];
    restrictions: string[];
    strategySignals: string[];
  };
  comparisonReason: string;
}

export interface Analysis {
  id: string;
  productId: string;
  productName?: string;
  salePrice: number;
  productCost: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
  roi: number;
  markup: number;
  breakEvenPrice: number;
  maxPurchasePrice: number;
  score: number;
  classification: string;
  positives: string[];
  warnings: string[];
  strategyProfile: StrategyProfile;
  dataOrigin: DataOrigin;
  createdAt: string;
}

export type CatalogSourceType = "PDF_UPLOAD" | "CSV" | "XLSX" | "MANUAL" | "EXTERNAL_URL";
export type ImportStatus = "UPLOADED" | "PROCESSING" | "NEEDS_REVIEW" | "COMPLETED" | "FAILED";
export type CatalogReviewStatus = "PENDING" | "CONFIRMED" | "IGNORED" | "MERGED";

export interface CatalogProduct {
  id: string;
  supplierSku: string | null;
  ean: string | null;
  gtin: string | null;
  name: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  unitPrice: number | null;
  unitsPerBox: number | null;
  minimumBoxes: number | null;
  minimumUnits: number | null;
  minimumInvestment: number | null;
  capitalExposurePercentage: number | null;
  availability: string | null;
  pageNumber: number | null;
  fieldConfidence: Record<string, number>;
  overallConfidence: number;
  status: CatalogReviewStatus;
  linkedProductId: string | null;
}

export interface Catalog {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  sourceType: CatalogSourceType;
  sourceUrl: string | null;
  catalogDate: string | null;
  importedAt: string;
  status: ImportStatus;
  version: number;
  totalPages: number | null;
  totalDetectedProducts: number;
  totalValidatedProducts: number;
  import: { id: string; status: ImportStatus; progressPercent: number; error: string | null; extractionMethod: string | null } | null;
  products: CatalogProduct[];
  changes: Array<{ id: string; changeType: string; productKey: string; beforeValue: unknown; afterValue: unknown; createdAt: string }>;
}

export interface CatalogOpportunity {
  rank: number;
  catalogProduct: CatalogProduct;
  productId: string;
  supplierName: string;
  catalogVersion: number;
  amazonDataStatus: "NOT_FETCHED";
  shortlistReason: string;
}
