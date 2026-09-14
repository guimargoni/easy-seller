import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import Tesseract from "tesseract.js";

export interface PdfPageText { pageNumber: number; lines: string[] }

export class PdfTextExtractor {
  async extract(buffer: Buffer): Promise<PdfPageText[]> {
    const document = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    const pages: PdfPageText[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = "";
      for (const item of content.items.filter((entry): entry is Extract<typeof entry, { str: string; hasEOL: boolean }> => "str" in entry)) {
        line += `${line ? " " : ""}${item.str}`;
        if (item.hasEOL) { if (line.trim()) lines.push(line.trim()); line = ""; }
      }
      if (line.trim()) lines.push(line.trim());
      pages.push({ pageNumber: number, lines });
    }
    return pages;
  }
}

export class PdfLayoutExtractor {
  async extract(buffer: Buffer): Promise<PdfPageText[]> {
    const document = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    const pages: PdfPageText[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter((item): item is Extract<typeof item, { str: string; transform: number[] }> => "str" in item && "transform" in item)
        .map((item) => ({ text: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0 }))
        .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
      const rows: Array<{ y: number; cells: typeof items }> = [];
      for (const item of items) {
        const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
        if (row) row.cells.push(item); else rows.push({ y: item.y, cells: [item] });
      }
      pages.push({ pageNumber: number, lines: rows.map((row) => row.cells.sort((a, b) => a.x - b.x).map((cell) => cell.text).join("\t")) });
    }
    return pages;
  }
}

export class PdfImageExtractor {
  async hasImages(buffer: Buffer): Promise<boolean> {
    const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
    for (let number = 1; number <= document.numPages; number++) {
      const operations = await (await document.getPage(number)).getOperatorList();
      if (operations.fnArray.some((operation) => operation === OPS.paintImageXObject || operation === OPS.paintInlineImageXObject || operation === OPS.paintImageMaskXObject)) return true;
    }
    return false;
  }
}

export class PdfOcrExtractor {
  async extract(buffer: Buffer): Promise<PdfPageText[]> {
    const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const worker = await Tesseract.createWorker(process.env.CATALOG_OCR_LANGS ?? "por+eng", undefined, {
      logger: process.env.CATALOG_OCR_LOG === "true" ? (message) => console.info("catalog-ocr", message.status, message.progress) : undefined,
    });
    const pages: PdfPageText[] = [];
    try {
      for (let number = 1; number <= document.numPages; number++) {
        const page = await document.getPage(number);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        await page.render({ canvasContext: context, viewport, canvas } as never).promise;
        const result = await worker.recognize(canvas.toBuffer("image/png"));
        pages.push({ pageNumber: number, lines: result.data.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) });
      }
    } finally {
      await worker.terminate();
    }
    return pages;
  }
}
