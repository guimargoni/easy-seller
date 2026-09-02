import { describe, expect, it } from "vitest";
import { calculateBreakEvenPrice, calculateFinancials, calculateMargin, calculateMaxPurchasePrice, calculateOpportunityScore, calculateProfit, calculateRecommendedQuantity, calculateROI } from "./index.js";

describe("financial calculations", () => {
  it("reproduces the supplied real scenario including R$ 0.65 other expenses", () => {
    const result = calculateFinancials({ salePrice: 47.98, productCost: 25, taxRate: 0.04, amazonLogistics: 5.85, amazonCommission: 7.20, otherExpenses: 0.65 });
    expect(result.totalExpensesPerUnit).toBe(40.62);
    expect(result.netProfitPerUnit).toBe(7.36);
    expect(result.netMarginPercent).toBe(15.34);
    expect(result.roiPercent).toBe(29.44);
  });
  it("separates profit, margin and ROI", () => {
    expect(calculateProfit(100, 70)).toBe(30);
    expect(calculateMargin(30, 100)).toBe(30);
    expect(calculateROI(30, 50)).toBe(60);
  });
  it("calculates break-even and maximum purchase price", () => {
    const input = { salePrice: 100, productCost: 40, taxRate: 0.1, amazonCommission: 15, amazonLogistics: 8 };
    expect(calculateBreakEvenPrice(input)).toBe(70);
    expect(calculateMaxPurchasePrice({ ...input, targetMarginRate: 0.15 })).toBe(52);
  });
});

describe("decision engine", () => {
  it("scores an attractive product with explainable output", () => {
    const result = calculateOpportunityScore({ monthlySales: 90, netMarginPercent: 20, roiPercent: 38, priceStability: 92, sellerCount: 4, demandStability: 85, amazonIsSeller: false, inventoryRisk: 20 });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.positives.length).toBeGreaterThan(2);
  });
  it("limits an unvalidated product to five percent of available capital", () => {
    expect(calculateRecommendedQuantity({ monthlySalesEstimate: 100, sellerCount: 3, score: 90, capitalAvailable: 2000, unitCost: 30, riskLevel: "LOW" })).toBe(3);
  });
});
