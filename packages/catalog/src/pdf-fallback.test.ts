import { describe, expect, it } from "vitest";
import { shouldRunPdfOcr } from "./catalog-import.js";

describe("PDF fallback", () => {
  it("does not execute OCR when the PDF contains native text", () => {
    expect(shouldRunPdfOcr(true, 0)).toBe(false);
  });

  it("allows OCR only when native text and detected products are both absent", () => {
    expect(shouldRunPdfOcr(false, 0)).toBe(true);
    expect(shouldRunPdfOcr(false, 1)).toBe(false);
  });
});
