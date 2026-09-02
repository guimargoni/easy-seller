export interface FeesEstimate { commission: number; logistics: number; source: "REAL" | "ESTIMATED"; }
export interface PricingResult { price: number; buyBoxPrice: number | null; observedAt: string; }
export interface AmazonFeesProvider { getFeesEstimate(input: { asin: string; price: number }): Promise<FeesEstimate>; }
export interface AmazonPricingProvider { getPricing(asin: string): Promise<PricingResult>; }
export interface AmazonCatalogProvider { findByAsin(asin: string): Promise<{ asin: string; title: string } | null>; }
export interface AmazonCompetitiveProvider { getCompetition(asin: string): Promise<{ sellerCount: number; amazonIsSeller: boolean }>; }
export interface AmazonSalesRankProvider { getSalesRank(asin: string): Promise<{ rank: number; category: string } | null>; }

export class MockAmazonProvider implements AmazonFeesProvider, AmazonPricingProvider {
  async getFeesEstimate(input: { asin: string; price: number }): Promise<FeesEstimate> { return { commission: input.price * 0.15, logistics: 8.9, source: "ESTIMATED" }; }
  async getPricing(_asin: string): Promise<PricingResult> { return { price: 79.9, buyBoxPrice: 79.9, observedAt: new Date().toISOString() }; }
}
