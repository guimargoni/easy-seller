import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { extractTabularRecords } from "./catalog-import.js";

describe("tabular catalog extraction", () => {
  it("reads semicolon CSV without losing decimal commas", async () => {
    const records = await extractTabularRecords(Buffer.from("SKU;Produto;Preço\nA-1;Garrafa;19,90", "utf8"), "CSV");
    expect(records[0]?.values).toEqual({ SKU: "A-1", Produto: "Garrafa", Preço: "19,90" });
  });
  it("reads XLSX headers and typed values", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Catálogo");
    sheet.addRow(["SKU", "Produto", "Preço"]); sheet.addRow(["X-2", "Caneca", 25.5]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const records = await extractTabularRecords(buffer, "XLSX");
    expect(records[0]?.values).toEqual({ SKU: "X-2", Produto: "Caneca", Preço: 25.5 });
  });
});
