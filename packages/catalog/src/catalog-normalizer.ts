import type { CatalogField, NormalizedCatalogProduct, RawCatalogRecord } from "./types.js";

const aliases: Record<CatalogField, string[]> = {
  supplierSku: ["sku", "suppliersku", "codigo", "cod", "codigo produto", "referencia", "ref"],
  ean: ["ean", "ean13", "codigo barras", "codigo de barras"],
  gtin: ["gtin", "gtin13", "gtin14"],
  name: ["name", "nome", "produto", "descricao", "descricao produto", "item"],
  brand: ["brand", "marca", "fabricante"],
  model: ["modelo"],
  variant: ["variante", "variacao", "tamanho", "cor", "voltagem"],
  unitPrice: ["unitprice", "preco", "preco unitario", "valor", "custo", "valor unitario"],
  unitsPerBox: ["unitsperbox", "unidades por caixa", "un caixa", "qtd caixa", "embalagem", "multiplo"],
  minimumBoxes: ["minimumboxes", "caixas minimas", "minimo caixas", "pedido minimo caixas"],
  minimumUnits: ["minimumunits", "pedido minimo", "quantidade minima", "qtd minima", "minimo"],
  availability: ["availability", "disponibilidade", "estoque", "situacao", "status"],
};

const cleanKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const textValue = (value: unknown) => value == null || String(value).trim() === "" ? null : String(value).trim();
const intValue = (value: unknown) => {
  const text = textValue(value)?.replace(/[^0-9-]/g, "");
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const moneyValue = (value: unknown) => {
  const original = textValue(value);
  if (!original) return null;
  let text = original.replace(/R\$|\s/g, "").replace(/[^0-9,.-]/g, "");
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
};
const gtinValue = (value: unknown) => {
  const digits = textValue(value)?.replace(/\D/g, "") ?? "";
  return [8, 12, 13, 14].includes(digits.length) ? digits : null;
};
const normalizeAvailability = (value: unknown) => {
  const raw = textValue(value);
  if (!raw) return null;
  const key = cleanKey(raw);
  if (/sem estoque|out of stock|indisponivel|esgotado|ruptura|^0$/.test(key)) return "OUT_OF_STOCK";
  if (/em estoque|in stock|disponivel|pronta entrega|^sim$/.test(key) || /^\d+$/.test(key) && Number(key) > 0) return "IN_STOCK";
  return raw;
};

export class CatalogNormalizer {
  normalize(record: RawCatalogRecord): NormalizedCatalogProduct {
    const mapped = new Map<CatalogField, unknown>();
    const confidence: Record<string, number> = {};
    for (const [rawKey, value] of Object.entries(record.values)) {
      const key = cleanKey(rawKey);
      const field = (Object.keys(aliases) as CatalogField[]).find((candidate) => aliases[candidate].includes(key));
      if (field && textValue(value) != null) {
        mapped.set(field, value);
        confidence[field] = record.baseConfidence;
      }
    }
    const supplierSku = textValue(mapped.get("supplierSku"));
    const ean = gtinValue(mapped.get("ean"));
    const gtin = gtinValue(mapped.get("gtin"));
    const rawName = textValue(mapped.get("name"));
    const unitPriceCents = moneyValue(mapped.get("unitPrice"));
    const unitsPerBox = intValue(mapped.get("unitsPerBox"));
    const minimumBoxes = intValue(mapped.get("minimumBoxes"));
    const minimumUnits = intValue(mapped.get("minimumUnits"));
    if (mapped.has("ean") && !ean) confidence.ean = Math.min(confidence.ean ?? 0, 0.2);
    if (mapped.has("gtin") && !gtin) confidence.gtin = Math.min(confidence.gtin ?? 0, 0.2);
    const orderUnits = minimumUnits ?? (minimumBoxes != null && unitsPerBox != null ? minimumBoxes * unitsPerBox : null);
    const minimumInvestmentCents = unitPriceCents != null && orderUnits != null ? unitPriceCents * orderUnits : null;
    const values = Object.values(confidence);
    const identityPresent = Boolean(supplierSku || ean || gtin || rawName);
    const coreEvidenceCount = [rawName, unitPriceCents, supplierSku || ean || gtin].filter((value) => value != null).length;
    const overallConfidence = identityPresent && values.length
      ? Math.round((values.reduce((sum, item) => sum + item, 0) / values.length) * (coreEvidenceCount / 3) * 1000) / 1000
      : 0;
    return {
      supplierSku, ean, gtin, rawName,
      normalizedName: rawName ? cleanKey(rawName) : null,
      brand: textValue(mapped.get("brand")),
      model: textValue(mapped.get("model")),
      variant: textValue(mapped.get("variant")),
      unitPriceCents, unitsPerBox, minimumBoxes, minimumUnits, minimumInvestmentCents,
      availability: normalizeAvailability(mapped.get("availability")),
      pageNumber: record.pageNumber ?? null,
      rawText: record.rawText ?? null,
      fieldConfidence: confidence,
      overallConfidence,
      extractionMethod: record.extractionMethod,
    };
  }
}
