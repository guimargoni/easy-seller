import { describe, expect, it } from "vitest";
import { detectCatalogChanges, type ComparableCatalogProduct } from "./catalog-version.js";

const item = (id: string, sku: string, price: number, box: number, availability: string): ComparableCatalogProduct => ({ id, supplierSku: sku, ean: null, gtin: null, normalizedName: id, rawName: id, unitPriceCents: price, unitsPerBox: box, availability });

describe("catalog version comparison", () => {
  it("detects all requested commercial changes", () => {
    const previous = [item("a0", "A", 1000, 6, "IN_STOCK"), item("b0", "B", 2000, 2, "IN_STOCK"), item("c0", "C", 3000, 1, "OUT_OF_STOCK"), item("d0", "D", 4000, 1, "IN_STOCK"), item("gone", "G", 500, 1, "IN_STOCK")];
    const current = [item("a1", "A", 1200, 12, "OUT_OF_STOCK"), item("b1", "B", 1800, 2, "IN_STOCK"), item("c1", "C", 3000, 1, "IN_STOCK"), item("d1", "D", 4000, 1, "IN_STOCK"), item("new", "N", 900, 1, "IN_STOCK")];
    const types = detectCatalogChanges(previous, current).map((change) => change.changeType);
    expect(types).toEqual(expect.arrayContaining(["NEW_PRODUCT", "REMOVED_PRODUCT", "PRICE_INCREASE", "PRICE_DECREASE", "BOX_CHANGED", "BACK_IN_STOCK", "OUT_OF_STOCK"]));
  });
  it("ignores missing identifiers instead of inventing a match", () => {
    const withoutKey = { ...item("x", "", 100, 1, "IN_STOCK"), supplierSku: null, normalizedName: null };
    expect(detectCatalogChanges([withoutKey], [withoutKey])).toEqual([]);
  });
});
