import { describe, expect, it } from "vitest";
import { AmazonPageObservationAdapter, AmazonSpApiAdapter, EstimatedAmazonFeesProvider, buildMonthlySalesTrend, estimateMonthlySalesFromRank, type AmazonSpApiClient } from "./index.js";

const client: AmazonSpApiClient = {
  async getCatalogItem() { return { summaries: [{ itemName: "Café Premium", brand: "Marca" }], salesRanks: { classificationRanks: [{ rank: 321, title: "Alimentos" }] } }; },
  async getCompetitiveSummary() { return { body: { offerCount: 2, featuredBuyingOptions: [{ listingPrice: { amount: 42 }, landedPrice: { amount: 47 }, shippingPrice: { amount: 5 } }], lowestPricedOffers: [{ sellerId: "AMAZON", fulfillmentType: "AMAZON" }, { sellerId: "SELLER" }] } }; },
  async getFeesEstimate() { return { FeesEstimateResult: { FeesEstimate: { FeeDetailList: [{ FeeType: "ReferralFee", FinalFee: { Amount: 6.3 } }, { FeeType: "FBAFulfillmentFee", FinalFee: { Amount: 8.9 } }] } } }; },
};

describe("AmazonSpApiAdapter", () => {
  it("maps official data as REAL/HIGH without fabricating ratings", async () => {
    const adapter = new AmazonSpApiAdapter(client);
    const catalog = await adapter.findByAsin("B012345678");
    const pricing = await adapter.getPricing("B012345678");
    const rank = await adapter.getSalesRank("B012345678");
    expect(catalog?.title).toMatchObject({ value: "Café Premium", origin: "REAL", confidence: "HIGH" });
    expect(catalog?.rating).toBeUndefined();
    expect(pricing?.price.value).toBe(47);
    expect(rank?.rank.value).toBe(321);
  });
  it("maps fees and competitive signals independently", async () => {
    const adapter = new AmazonSpApiAdapter(client);
    const fees = await adapter.getFeesEstimate({ asin: "B012345678", price: 42 });
    const competition = await adapter.getCompetition("B012345678");
    expect(fees.commission.value).toBe(6.3);
    expect(fees.logistics.value).toBe(8.9);
    expect(competition?.sellerCount.value).toBe(2);
    expect(competition?.amazonIsSeller.value).toBe(true);
  });
});

describe("fallback adapters", () => {
  it("labels visible page observations as REAL/MEDIUM", async () => {
    const adapter = new AmazonPageObservationAdapter({ asin: "B012345678", title: "Produto", price: 99.9, rating: 4.7 });
    expect((await adapter.getPricing("B012345678"))?.price).toMatchObject({ origin: "REAL", confidence: "MEDIUM", value: 99.9 });
    expect((await adapter.findByAsin("B012345678"))?.historyAvailable).toMatchObject({ origin: "INFERRED", confidence: "LOW" });
  });
  it("never presents configured fee assumptions as real", async () => {
    const fees = await new EstimatedAmazonFeesProvider(0.15, 9).getFeesEstimate({ asin: "B012345678", price: 100 });
    expect(fees.commission).toMatchObject({ value: 15, origin: "ESTIMATED", confidence: "MEDIUM" });
    expect(fees.logistics).toMatchObject({ value: 9, origin: "ESTIMATED", confidence: "LOW" });
  });
  it("maps a visible page sales rank without upgrading its confidence", async () => {
    const adapter = new AmazonPageObservationAdapter({ asin: "B012345678", salesRank: 14400, salesRankCategory: "Cozinha" });
    expect(await adapter.getSalesRank("B012345678")).toMatchObject({ rank: { value: 14400, origin: "REAL", confidence: "MEDIUM" }, category: { value: "Cozinha" } });
  });
});

describe("monthly sales trend", () => {
  it("returns the last three calendar months and leaves missing months empty", () => {
    const result = buildMonthlySalesTrend([
      { salesRank: 10000, timestamp: "2026-07-20T12:00:00.000Z" },
      { salesRank: 6400, timestamp: "2026-08-10T12:00:00.000Z" },
      { salesRank: 3600, timestamp: "2026-09-05T12:00:00.000Z" },
    ], new Date("2026-09-07T12:00:00.000Z"));
    expect(result.map((point) => point.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(result.map((point) => point.estimatedUnits)).toEqual([120, 150, 200]);
    expect(result.every((point) => point.origin === "INFERRED" && point.confidence === "LOW")).toBe(true);
  });
  it("uses only the latest rank in a month so refreshes do not inflate sales", () => {
    const result = buildMonthlySalesTrend([
      { salesRank: 10000, timestamp: "2026-09-01T12:00:00.000Z" },
      { salesRank: 14400, timestamp: "2026-09-06T12:00:00.000Z" },
      { salesRank: 14400, timestamp: "2026-09-06T12:01:00.000Z" },
    ], new Date("2026-09-07T12:00:00.000Z"));
    expect(result[2]).toMatchObject({ estimatedUnits: estimateMonthlySalesFromRank(14400), latestRank: 14400, observations: 3 });
    expect(result[0].estimatedUnits).toBeNull();
  });
});
