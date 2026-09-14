export type DataOrigin = "REAL" | "ESTIMATED" | "INFERRED";
export type DataConfidence = "HIGH" | "MEDIUM" | "LOW";
export interface AmazonSignal<T> { value: T; origin: DataOrigin; confidence: DataConfidence; source: string; observedAt: string; }
export interface CatalogResult { asin: string; title: AmazonSignal<string>; brand?: AmazonSignal<string>; imageUrl?: AmazonSignal<string>; rating?: AmazonSignal<number>; reviewCount?: AmazonSignal<number>; historyAvailable: AmazonSignal<boolean>; }
export interface PricingResult { price: AmazonSignal<number>; buyBoxPrice?: AmazonSignal<number | null>; shipping?: AmazonSignal<number | null>; }
export interface FeesEstimate { commission: AmazonSignal<number>; logistics: AmazonSignal<number>; }
export interface CompetitionResult { sellerCount: AmazonSignal<number>; fbaSellerCount?: AmazonSignal<number | null>; amazonIsSeller: AmazonSignal<boolean>; }
export interface SalesRankResult { rank: AmazonSignal<number>; category: AmazonSignal<string>; subcategoryRank?: AmazonSignal<number | null>; }
export interface MonthlySalesTrendPoint { month: string; estimatedUnits: number | null; latestRank: number | null; observations: number; observedAt: string | null; origin: "INFERRED"; confidence: "LOW"; source: "SALES_RANK_HEURISTIC_V1"; }
export interface AmazonFeesProvider { getFeesEstimate(input: { asin: string; price: number }): Promise<FeesEstimate>; }
export interface AmazonPricingProvider { getPricing(asin: string): Promise<PricingResult | null>; }
export interface AmazonCatalogProvider { findByAsin(asin: string): Promise<CatalogResult | null>; }
export interface AmazonCompetitiveProvider { getCompetition(asin: string): Promise<CompetitionResult | null>; }
export interface AmazonSalesRankProvider { getSalesRank(asin: string): Promise<SalesRankResult | null>; }

export interface AmazonSpApiClient { getCatalogItem(asin: string): Promise<unknown>; getCompetitiveSummary(asin: string): Promise<unknown>; getFeesEstimate(asin: string, price: number): Promise<unknown>; }
const now = () => new Date().toISOString();
const real = <T>(value: T, source: string): AmazonSignal<T> => ({ value, origin: "REAL", confidence: "HIGH", source, observedAt: now() });
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const competitiveBody = (value: unknown) => {
  const response = record(value);
  const first = record(array(response.responses)[0]);
  return record(first.body ?? response.body ?? response);
};

/** Adapter for official Catalog Items, Product Pricing and Product Fees SP-API responses. */
export class AmazonSpApiAdapter implements AmazonCatalogProvider, AmazonPricingProvider, AmazonFeesProvider, AmazonCompetitiveProvider, AmazonSalesRankProvider {
  constructor(private readonly client: AmazonSpApiClient) {}
  async findByAsin(asin: string): Promise<CatalogResult | null> {
    const item = record(await this.client.getCatalogItem(asin));
    const summary = record(array(item.summaries)[0]);
    const title = text(summary.itemName);
    if (!title) return null;
    const imageSet = record(array(item.images)[0] ?? array(record(item.images).MAIN)[0]);
    const image = record(array(imageSet.images).find((value) => record(value).variant === "MAIN") ?? array(imageSet.images)[0]);
    const rankSet = record(array(item.salesRanks)[0] ?? item.salesRanks);
    const ranks = array(rankSet.classificationRanks);
    return { asin, title: real(title, "AMAZON_SP_API_CATALOG_ITEMS"), ...(text(summary.brand) ? { brand: real(text(summary.brand)!, "AMAZON_SP_API_CATALOG_ITEMS") } : {}), ...(text(image.link) ? { imageUrl: real(text(image.link)!, "AMAZON_SP_API_CATALOG_ITEMS") } : {}), historyAvailable: real(ranks.length > 0, "AMAZON_SP_API_CATALOG_ITEMS") };
  }
  async getPricing(asin: string): Promise<PricingResult | null> {
    const body = competitiveBody(await this.client.getCompetitiveSummary(asin));
    const featured = record(array(body.featuredBuyingOptions)[0]);
    const lowest = record(array(body.lowestPricedOffers)[0]);
    const listing = record(featured.listingPrice ?? lowest.listingPrice);
    const landed = record(featured.landedPrice ?? lowest.landedPrice);
    const shipping = record(featured.shippingPrice ?? lowest.shippingPrice);
    const price = numeric(landed.amount) ?? numeric(listing.amount);
    if (price == null) return null;
    const source = "AMAZON_SP_API_PRODUCT_PRICING";
    return { price: real(price, source), buyBoxPrice: real(numeric(landed.amount) ?? null, source), shipping: real(numeric(shipping.amount) ?? null, source) };
  }
  async getCompetition(asin: string): Promise<CompetitionResult | null> {
    const body = competitiveBody(await this.client.getCompetitiveSummary(asin));
    const offers = array(body.lowestPricedOffers);
    const source = "AMAZON_SP_API_PRODUCT_PRICING";
    const explicitAmazon = offers.some((value) => record(value).isAmazon === true || text(record(value).sellerId)?.toUpperCase() === "AMAZON");
    const amazonIsSeller: AmazonSignal<boolean> = explicitAmazon
      ? real(true, source)
      : { value: false, origin: "INFERRED", confidence: "LOW", source: "AMAZON_SELLER_NOT_EXPLICIT_IN_SP_API_RESPONSE", observedAt: now() };
    return { sellerCount: real(numeric(body.offerCount) ?? offers.length, source), fbaSellerCount: real(offers.filter((x) => record(x).fulfillmentType === "AMAZON").length, source), amazonIsSeller };
  }
  async getSalesRank(asin: string): Promise<SalesRankResult | null> {
    const item = record(await this.client.getCatalogItem(asin));
    const rankSet = record(array(item.salesRanks)[0] ?? item.salesRanks);
    const first = record(array(rankSet.classificationRanks)[0]);
    const rank = numeric(first.rank);
    if (rank == null) return null;
    const source = "AMAZON_SP_API_CATALOG_ITEMS";
    return { rank: real(rank, source), category: real(text(first.title) ?? "Categoria não informada", source), subcategoryRank: real(null, source) };
  }
  async getFeesEstimate(input: { asin: string; price: number }): Promise<FeesEstimate> {
    const response = record(await this.client.getFeesEstimate(input.asin, input.price));
    const body = record(response.body ?? response);
    const result = record(body.FeesEstimateResult ?? body.feesEstimateResult ?? body);
    const estimate = record(result.FeesEstimate ?? result.feesEstimate ?? result);
    const details = array(estimate.FeeDetailList ?? estimate.feeDetailList);
    const sum = (matcher: RegExp) => details.reduce<number>((total, value) => { const detail = record(value); const fee = record(detail.FinalFee ?? detail.finalFee); return matcher.test(text(detail.FeeType ?? detail.feeType) ?? "") ? total + (numeric(fee.Amount ?? fee.amount) ?? 0) : total; }, 0);
    const source = "AMAZON_SP_API_PRODUCT_FEES";
    return { commission: real(sum(/referral|commission/i), source), logistics: real(sum(/fulfillment|fba|closing|shipping|handling/i), source) };
  }
}

export interface PageObservation { asin: string; title?: string; price?: number; buyBoxPrice?: number; rating?: number; reviewCount?: number; sellerCount?: number; amazonIsSeller?: boolean; salesRank?: number; salesRankCategory?: string; observedAt?: string; }
/** Adapter restricted to values visibly rendered on the product page opened by the user. */
export class AmazonPageObservationAdapter implements AmazonCatalogProvider, AmazonPricingProvider, AmazonCompetitiveProvider, AmazonSalesRankProvider {
  constructor(private readonly observation: PageObservation) {}
  private signal<T>(value: T): AmazonSignal<T> { return { value, origin: "REAL", confidence: "MEDIUM", source: "AMAZON_PRODUCT_PAGE_VISIBLE_DOM", observedAt: this.observation.observedAt ?? now() }; }
  async findByAsin(asin: string): Promise<CatalogResult | null> { if (asin !== this.observation.asin || !this.observation.title) return null; return { asin, title: this.signal(this.observation.title), ...(this.observation.rating != null ? { rating: this.signal(this.observation.rating) } : {}), ...(this.observation.reviewCount != null ? { reviewCount: this.signal(this.observation.reviewCount) } : {}), historyAvailable: { value: false, origin: "INFERRED", confidence: "LOW", source: "NO_HISTORY_SOURCE_CONFIGURED", observedAt: now() } }; }
  async getPricing(asin: string): Promise<PricingResult | null> { if (asin !== this.observation.asin || !this.observation.price) return null; return { price: this.signal(this.observation.price), ...(this.observation.buyBoxPrice != null ? { buyBoxPrice: this.signal(this.observation.buyBoxPrice) } : {}) }; }
  async getCompetition(asin: string): Promise<CompetitionResult | null> { if (asin !== this.observation.asin || this.observation.sellerCount == null || this.observation.amazonIsSeller == null) return null; return { sellerCount: this.signal(this.observation.sellerCount), amazonIsSeller: this.signal(this.observation.amazonIsSeller) }; }
  async getSalesRank(asin: string): Promise<SalesRankResult | null> { if (asin !== this.observation.asin || this.observation.salesRank == null) return null; return { rank: this.signal(this.observation.salesRank), category: this.signal(this.observation.salesRankCategory ?? "Categoria não informada") }; }
}

export function estimateMonthlySalesFromRank(rank: number) {
  return Math.max(1, Math.min(300, Math.round(12000 / Math.sqrt(rank))));
}

export function buildMonthlySalesTrend(
  snapshots: Array<{ salesRank: number; timestamp: Date | string }>,
  referenceDate = new Date(),
): MonthlySalesTrendPoint[] {
  return [2, 1, 0].map((monthsAgo) => {
    const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - monthsAgo, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const matching = snapshots
      .map((snapshot) => ({ ...snapshot, date: new Date(snapshot.timestamp) }))
      .filter((snapshot) => snapshot.date >= start && snapshot.date < end && Number.isFinite(snapshot.salesRank) && snapshot.salesRank > 0)
      .sort((left, right) => right.date.getTime() - left.date.getTime());
    const latest = matching[0];
    return {
      month: start.toISOString().slice(0, 7),
      estimatedUnits: latest ? estimateMonthlySalesFromRank(latest.salesRank) : null,
      latestRank: latest?.salesRank ?? null,
      observations: matching.length,
      observedAt: latest?.date.toISOString() ?? null,
      origin: "INFERRED" as const,
      confidence: "LOW" as const,
      source: "SALES_RANK_HEURISTIC_V1" as const,
    };
  });
}

/** Conservative fallback, used only when Amazon Product Fees is not configured. */
export class EstimatedAmazonFeesProvider implements AmazonFeesProvider {
  constructor(private readonly referralRate = 0.15, private readonly logisticsEstimate = 0) {}
  async getFeesEstimate(input: { asin: string; price: number }): Promise<FeesEstimate> { const observedAt = now(); return { commission: { value: input.price * this.referralRate, origin: "ESTIMATED", confidence: "MEDIUM", source: "CONFIGURED_REFERRAL_RATE", observedAt }, logistics: { value: this.logisticsEstimate, origin: "ESTIMATED", confidence: "LOW", source: "CONFIGURED_LOGISTICS_ESTIMATE", observedAt } }; }
}

/** HTTP transport for an authenticated SP-API gateway (LWA/SigV4 remain at the gateway boundary). */
export class HttpAmazonSpApiClient implements AmazonSpApiClient {
  constructor(private readonly baseUrl: string, private readonly accessToken: string, private readonly marketplaceId = "A2Q3Y263D00KWC") {}
  private async request(path: string, init?: RequestInit) { const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { ...init, headers: { authorization: `Bearer ${this.accessToken}`, "content-type": "application/json", ...init?.headers } }); if (!response.ok) throw new Error(`AMAZON_SP_API_${response.status}`); return response.json(); }
  getCatalogItem(asin: string) { return this.request(`/catalog/2022-04-01/items/${encodeURIComponent(asin)}?marketplaceIds=${this.marketplaceId}&includedData=summaries,images,salesRanks`); }
  getCompetitiveSummary(asin: string) { return this.request(`/batches/products/pricing/2022-05-01/items/competitiveSummary`, { method: "POST", body: JSON.stringify({ requests: [{ asin, marketplaceId: this.marketplaceId, includedData: ["featuredBuyingOptions", "lowestPricedOffers"] }] }) }); }
  getFeesEstimate(asin: string, price: number) { return this.request(`/products/fees/v0/items/${encodeURIComponent(asin)}/feesEstimate`, { method: "POST", body: JSON.stringify({ FeesEstimateRequest: { MarketplaceId: this.marketplaceId, IdType: "ASIN", IdValue: asin, Identifier: `easy-seller-${Date.now()}`, IsAmazonFulfilled: true, PriceToEstimateFees: { ListingPrice: { CurrencyCode: "BRL", Amount: price } } } }) }); }
}
