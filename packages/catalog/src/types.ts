export type CatalogField =
  | "supplierSku"
  | "ean"
  | "gtin"
  | "name"
  | "brand"
  | "model"
  | "variant"
  | "unitPrice"
  | "unitsPerBox"
  | "minimumBoxes"
  | "minimumUnits"
  | "availability";

export type ExtractionMethod = "NATIVE_TEXT" | "LAYOUT" | "IMAGE" | "OCR" | "TABULAR" | "MANUAL";

export interface RawCatalogRecord {
  values: Record<string, unknown>;
  rawText?: string;
  pageNumber?: number;
  baseConfidence: number;
  extractionMethod: ExtractionMethod;
}

export interface NormalizedCatalogProduct {
  supplierSku: string | null;
  ean: string | null;
  gtin: string | null;
  rawName: string | null;
  normalizedName: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  unitPriceCents: number | null;
  unitsPerBox: number | null;
  minimumBoxes: number | null;
  minimumUnits: number | null;
  minimumInvestmentCents: number | null;
  availability: string | null;
  pageNumber: number | null;
  rawText: string | null;
  fieldConfidence: Record<string, number>;
  overallConfidence: number;
  extractionMethod: ExtractionMethod;
}
