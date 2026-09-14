import { describe, expect, it } from "vitest";
import { CatalogNormalizer } from "./catalog-normalizer.js";

describe("CatalogNormalizer", () => {
  it("normalizes explicit tabular fields and calculates minimum investment", () => {
    const item = new CatalogNormalizer().normalize({ values: { SKU: "ABC-1", Produto: "Copo Térmico", Marca: "Acme", Preço: "R$ 12,50", "Unidades por caixa": 6, "Caixas mínimas": 2 }, baseConfidence: 0.98, extractionMethod: "TABULAR" });
    expect(item.unitPriceCents).toBe(1250);
    expect(item.minimumInvestmentCents).toBe(15000);
    expect(item.fieldConfidence.name).toBe(0.98);
    expect(item.overallConfidence).toBe(0.98);
  });
  it("does not invent absent fields or a default quantity", () => {
    const item = new CatalogNormalizer().normalize({ values: { Produto: "Item sem preço" }, baseConfidence: 0.8, extractionMethod: "NATIVE_TEXT" });
    expect(item.brand).toBeNull();
    expect(item.minimumUnits).toBeNull();
    expect(item.minimumInvestmentCents).toBeNull();
    expect(item.overallConfidence).toBeLessThan(0.75);
  });
  it("rejects malformed GTIN evidence", () => {
    const item = new CatalogNormalizer().normalize({ values: { Produto: "Item", EAN: "123" }, baseConfidence: 0.9, extractionMethod: "TABULAR" });
    expect(item.ean).toBeNull();
    expect(item.fieldConfidence.ean).toBe(0.2);
  });
});
