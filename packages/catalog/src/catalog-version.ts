export interface ComparableCatalogProduct {
  id: string;
  supplierSku: string | null;
  ean: string | null;
  gtin: string | null;
  normalizedName: string | null;
  rawName: string | null;
  unitPriceCents: number | null;
  unitsPerBox: number | null;
  availability: string | null;
}

export type DetectedCatalogChange = {
  changeType: "NEW_PRODUCT" | "REMOVED_PRODUCT" | "PRICE_INCREASE" | "PRICE_DECREASE" | "BOX_CHANGED" | "BACK_IN_STOCK" | "OUT_OF_STOCK";
  productKey: string;
  catalogProductId?: string;
  previousCatalogProductId?: string;
  beforeValue?: object;
  afterValue?: object;
};

export const catalogProductKey = (item: ComparableCatalogProduct) =>
  item.supplierSku ? `sku:${item.supplierSku.toLowerCase()}` : item.ean ? `ean:${item.ean}` : item.gtin ? `gtin:${item.gtin}` : item.normalizedName ? `name:${item.normalizedName}` : null;

export function detectCatalogChanges(previous: ComparableCatalogProduct[], current: ComparableCatalogProduct[]): DetectedCatalogChange[] {
  const oldMap = new Map(previous.map((item) => [catalogProductKey(item), item]).filter((entry): entry is [string, ComparableCatalogProduct] => Boolean(entry[0])));
  const newMap = new Map(current.map((item) => [catalogProductKey(item), item]).filter((entry): entry is [string, ComparableCatalogProduct] => Boolean(entry[0])));
  const changes: DetectedCatalogChange[] = [];
  for (const [key, item] of newMap) {
    const old = oldMap.get(key);
    if (!old) { changes.push({ changeType: "NEW_PRODUCT", productKey: key, catalogProductId: item.id, afterValue: { name: item.rawName } }); continue; }
    if (item.unitPriceCents != null && old.unitPriceCents != null && item.unitPriceCents !== old.unitPriceCents) changes.push({ changeType: item.unitPriceCents > old.unitPriceCents ? "PRICE_INCREASE" : "PRICE_DECREASE", productKey: key, catalogProductId: item.id, previousCatalogProductId: old.id, beforeValue: { priceCents: old.unitPriceCents }, afterValue: { priceCents: item.unitPriceCents } });
    if (item.unitsPerBox !== old.unitsPerBox) changes.push({ changeType: "BOX_CHANGED", productKey: key, catalogProductId: item.id, previousCatalogProductId: old.id, beforeValue: { unitsPerBox: old.unitsPerBox }, afterValue: { unitsPerBox: item.unitsPerBox } });
    if (old.availability === "OUT_OF_STOCK" && item.availability === "IN_STOCK") changes.push({ changeType: "BACK_IN_STOCK", productKey: key, catalogProductId: item.id, previousCatalogProductId: old.id });
    if (old.availability !== "OUT_OF_STOCK" && item.availability === "OUT_OF_STOCK") changes.push({ changeType: "OUT_OF_STOCK", productKey: key, catalogProductId: item.id, previousCatalogProductId: old.id });
  }
  for (const [key, item] of oldMap) if (!newMap.has(key)) changes.push({ changeType: "REMOVED_PRODUCT", productKey: key, previousCatalogProductId: item.id, beforeValue: { name: item.rawName } });
  return changes;
}
