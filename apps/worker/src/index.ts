export interface CatalogImportJob { catalogImportId: string; sourceType: "PDF_UPLOAD" | "CSV" | "XLSX"; }
export const processCatalogImport = async (_job: CatalogImportJob): Promise<never> => { throw new Error("Catalog jobs start in Phase 2"); };
