import { describe, expect, it } from "vitest";
import {
  analyzeResearchCandidate,
  calculateBreakEvenPrice,
  calculateFinancials,
  calculateMargin,
  calculateMaxPurchasePrice,
  calculateOpportunityScore,
  calculateProfit,
  calculateRecommendedQuantity,
  calculateROI,
  rankResearchCandidates,
} from "./index.js";

describe("financial calculations", () => {
  it("reports the arithmetic of the supplied expenses without inventing a cost", () => {
    const result = calculateFinancials({
      salePrice: 47.98,
      productCost: 25,
      taxRate: 0.04,
      amazonLogistics: 5.85,
      amazonCommission: 7.2,
    });
    expect(result.totalExpensesPerUnit).toBe(39.97);
    expect(result.netProfitPerUnit).toBe(8.01);
    expect(result.netMarginPercent).toBe(16.69);
    expect(result.roiPercent).toBe(32.04);
  });
  it("documents the additional expense required by the requested R$ 7.36 profit", () => {
    const result = calculateFinancials({
      salePrice: 47.98,
      productCost: 25,
      taxRate: 0.04,
      amazonLogistics: 5.85,
      amazonCommission: 7.2,
      otherExpenses: 0.65,
    });
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
    const input = {
      salePrice: 100,
      productCost: 40,
      taxRate: 0.1,
      amazonCommission: 15,
      amazonLogistics: 8,
    };
    expect(calculateBreakEvenPrice(input)).toBe(70);
    expect(calculateMaxPurchasePrice({ ...input, targetMarginRate: 0.15 })).toBe(52);
  });
});

describe("decision engine", () => {
  it("scores an attractive product with explainable output", () => {
    const result = calculateOpportunityScore({
      monthlySales: 90,
      netMarginPercent: 20,
      roiPercent: 38,
      priceStability: 92,
      sellerCount: 4,
      demandStability: 85,
      amazonIsSeller: false,
      inventoryRisk: 20,
    });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.positives.length).toBeGreaterThan(2);
  });
  it("limits an unvalidated product to five percent of available capital", () => {
    expect(
      calculateRecommendedQuantity({
        monthlySalesEstimate: 100,
        sellerCount: 3,
        score: 90,
        capitalAvailable: 2000,
        unitCost: 30,
        riskLevel: "LOW",
      }),
    ).toBe(3);
  });
});

describe("phase 2 product research", () => {
  const criteria = {
    minimumMarginPercent: 15,
    idealMarginPercent: 18,
    minimumRoiPercent: 25,
    maximumTurnoverDays: 30,
    maximumSellerCount: 5,
    maximumCapitalExposure: 500,
  };
  const branded = {
    id: "brand",
    name: "Produto de marca",
    strategyType: "BRANDED_RESELL" as const,
    estimatedCost: 40,
    amazonPrice: 80,
    estimatedDemand: 80,
    sellerCount: 3,
    rating: 4.6,
    reviewCount: 180,
    historyAvailable: true,
    estimatedTurnoverDays: 20,
    amazonIsSeller: false,
    brandApprovalStatus: "APPROVED" as const,
    amazonApprovalStatus: "APPROVED" as const,
  };

  it("recommends a financially attractive and approved branded test", () => {
    const result = analyzeResearchCandidate(branded, criteria);
    expect(result.recommendation).toBe("BUY_TEST");
    expect(result.strategySignals.join(" ")).toContain("Buy Box");
  });

  it.each(["REJECTED", "UNAVAILABLE"] as const)(
    "forces AVOID when Amazon approval is %s",
    (status) => {
      expect(
        analyzeResearchCandidate({ ...branded, amazonApprovalStatus: status }, criteria)
          .recommendation,
      ).toBe("AVOID");
    },
  );

  it("keeps approval restrictions explicit instead of hiding them in the score", () => {
    const result = analyzeResearchCandidate(
      { ...branded, amazonApprovalStatus: "REQUIRES_LOA" },
      criteria,
    );
    expect(result.recommendation).toBe("WATCH");
    expect(result.restrictions).toContain(
      "Amazon exige carta de autorização (LOA): risco elevado de aprovação.",
    );
    expect(result.score).toBeGreaterThan(0);
  });

  it("uses generic-listing signals and explains the ranking", () => {
    const generic = {
      ...branded,
      id: "generic",
      name: "Anúncio genérico",
      strategyType: "GENERIC_LISTING" as const,
      brandApprovalStatus: "UNKNOWN" as const,
      amazonApprovalStatus: "NOT_CHECKED" as const,
      reviewCount: 0,
      historyAvailable: false,
    };
    const ranked = rankResearchCandidates([generic, branded], criteria);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.comparisonReason).toContain("candidato anterior");
    expect(
      ranked.find((item) => item.candidate.id === "generic")?.analysis.strategySignals.join(" "),
    ).toContain("ranqueamento");
  });

  it("blocks a branded buy recommendation while brand approval is required", () => {
    expect(
      analyzeResearchCandidate({ ...branded, brandApprovalStatus: "REQUIRED" }, criteria)
        .recommendation,
    ).toBe("WATCH");
  });
});
