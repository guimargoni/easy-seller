import type { RawCatalogRecord } from "./types.js";

export class ProductBlockDetector {
  detect(pages: Array<{ pageNumber: number; lines: string[] }>, method: "NATIVE_TEXT" | "LAYOUT" | "OCR"): RawCatalogRecord[] {
    const records: RawCatalogRecord[] = [];
    for (const page of pages) {
      const meaningful = page.lines.map((line) => line.trim()).filter(Boolean);
      if (meaningful.length < 2) continue;
      const delimiter = meaningful[0]!.includes(";") ? ";" : meaningful[0]!.includes("\t") ? "\t" : null;
      if (delimiter) {
        const headers = meaningful[0]!.split(delimiter).map((item) => item.trim());
        for (const line of meaningful.slice(1)) {
          const cells = line.split(delimiter).map((item) => item.trim());
          if (cells.every((cell) => !cell)) continue;
          records.push({ values: Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])), rawText: line, pageNumber: page.pageNumber, baseConfidence: method === "OCR" ? 0.45 : method === "LAYOUT" ? 0.72 : 0.82, extractionMethod: method });
        }
      }
    }
    return records;
  }
}
