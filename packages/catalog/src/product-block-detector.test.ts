import { describe, expect, it } from "vitest";
import { ProductBlockDetector } from "./product-block-detector.js";

describe("ProductBlockDetector", () => {
  it("preserves rows and page evidence from a delimited PDF table", () => {
    const records = new ProductBlockDetector().detect([{ pageNumber: 4, lines: ["SKU;Produto;Preço", "A-1;Garrafa;19,90"] }], "LAYOUT");
    expect(records).toHaveLength(1);
    expect(records[0]?.values).toEqual({ SKU: "A-1", Produto: "Garrafa", Preço: "19,90" });
    expect(records[0]?.pageNumber).toBe(4);
    expect(records[0]?.baseConfidence).toBe(0.72);
  });
  it("does not manufacture records from unstructured text", () => {
    expect(new ProductBlockDetector().detect([{ pageNumber: 1, lines: ["apenas uma descrição"] }], "NATIVE_TEXT")).toEqual([]);
  });
});
