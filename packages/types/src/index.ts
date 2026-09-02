export type DataOrigin = "REAL" | "ESTIMATED" | "INFERRED";
export type DataConfidence = "HIGH" | "MEDIUM" | "LOW";
export type OpportunityStatus = "TEST" | "APPROVED" | "DISCARDED" | "WATCHING";
export interface Product { id: string; name: string; asin: string; ean: string | null; brand: string | null; category: string; cost: number; amazonPrice: number; monthlySalesEstimate: number; sellerCount: number; amazonIsSeller: boolean; status: OpportunityStatus; }
export interface Supplier { id: string; name: string; cnpj: string | null; contact: string | null; phone: string | null; email: string | null; city: string | null; state: string | null; minimumOrder: number | null; issuesInvoice: boolean; notes: string | null; }
