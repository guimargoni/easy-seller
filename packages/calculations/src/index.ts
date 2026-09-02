export type Classification = "Excelente" | "Muito boa" | "Boa" | "Atenção" | "Alto risco";
export type Recommendation = "BUY_TEST" | "WATCH" | "AVOID";

export interface CalculationInput {
  salePrice: number;
  productCost: number;
  inboundShipping?: number;
  packaging?: number;
  taxRate?: number;
  amazonCommission?: number;
  amazonLogistics?: number;
  advertising?: number;
  otherExpenses?: number;
  quantity?: number;
  targetMarginRate?: number;
}

export interface CalculationResult {
  revenue: number;
  totalExpensesPerUnit: number;
  netProfitPerUnit: number;
  totalProfit: number;
  netMarginPercent: number;
  roiPercent: number;
  markupPercent: number;
  breakEvenPrice: number;
  minimumSalePrice: number;
  maxPurchasePrice: number;
  requiredCapital: number;
}

export interface OpportunityScoreInput {
  monthlySales: number;
  netMarginPercent: number;
  roiPercent: number;
  priceStability: number;
  sellerCount: number;
  demandStability: number;
  amazonIsSeller: boolean;
  inventoryRisk: number;
}

export interface ScoreWeights {
  velocity: number; margin: number; roi: number; priceStability: number;
  competition: number; demandStability: number; amazonPresence: number; inventoryRisk: number;
}

export const FAST_CASH_WEIGHTS: ScoreWeights = {
  velocity: 25, margin: 20, roi: 15, priceStability: 10,
  competition: 10, demandStability: 10, amazonPresence: 5, inventoryRisk: 5,
};

const round = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

export const calculateProfit = (revenue: number, expenses: number): number => round(revenue - expenses);
export const calculateMargin = (profit: number, salePrice: number): number => salePrice > 0 ? round((profit / salePrice) * 100) : 0;
export const calculateROI = (profit: number, investedCapital: number): number => investedCapital > 0 ? round((profit / investedCapital) * 100) : 0;

export const calculateBreakEvenPrice = (input: CalculationInput): number => {
  const fixed = input.productCost + (input.inboundShipping ?? 0) + (input.packaging ?? 0) +
    (input.amazonCommission ?? 0) + (input.amazonLogistics ?? 0) + (input.advertising ?? 0) + (input.otherExpenses ?? 0);
  const variableRate = input.taxRate ?? 0;
  return variableRate >= 1 ? Number.POSITIVE_INFINITY : round(fixed / (1 - variableRate));
};

export const calculateMaxPurchasePrice = (input: Omit<CalculationInput, "productCost">): number => {
  const targetMargin = input.targetMarginRate ?? 0.15;
  const taxes = input.salePrice * (input.taxRate ?? 0);
  const nonProductCosts = (input.inboundShipping ?? 0) + (input.packaging ?? 0) + (input.amazonCommission ?? 0) +
    (input.amazonLogistics ?? 0) + (input.advertising ?? 0) + (input.otherExpenses ?? 0);
  return round(Math.max(0, input.salePrice * (1 - targetMargin) - taxes - nonProductCosts));
};

export const calculateFinancials = (input: CalculationInput): CalculationResult => {
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const taxes = input.salePrice * (input.taxRate ?? 0);
  const totalExpenses = input.productCost + (input.inboundShipping ?? 0) + (input.packaging ?? 0) + taxes +
    (input.amazonCommission ?? 0) + (input.amazonLogistics ?? 0) + (input.advertising ?? 0) + (input.otherExpenses ?? 0);
  const profit = calculateProfit(input.salePrice, totalExpenses);
  const acquisitionCost = input.productCost + (input.inboundShipping ?? 0) + (input.packaging ?? 0);
  const breakEvenPrice = calculateBreakEvenPrice(input);
  return {
    revenue: round(input.salePrice * quantity), totalExpensesPerUnit: round(totalExpenses), netProfitPerUnit: profit,
    totalProfit: round(profit * quantity), netMarginPercent: calculateMargin(profit, input.salePrice),
    roiPercent: calculateROI(profit, acquisitionCost), markupPercent: calculateROI(input.salePrice - input.productCost, input.productCost),
    breakEvenPrice, minimumSalePrice: breakEvenPrice,
    maxPurchasePrice: calculateMaxPurchasePrice(input), requiredCapital: round(acquisitionCost * quantity),
  };
};

export const calculateOpportunityScore = (input: OpportunityScoreInput, weights = FAST_CASH_WEIGHTS) => {
  const components = {
    velocity: clamp(input.monthlySales / 1.2),
    margin: clamp((input.netMarginPercent / 25) * 100),
    roi: clamp((input.roiPercent / 50) * 100),
    priceStability: clamp(input.priceStability),
    competition: clamp(100 - Math.max(0, input.sellerCount - 1) * 11),
    demandStability: clamp(input.demandStability),
    amazonPresence: input.amazonIsSeller ? 25 : 100,
    inventoryRisk: clamp(100 - input.inventoryRisk),
  };
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const score = Math.round(Object.entries(components).reduce((sum, [key, value]) => sum + value * weights[key as keyof ScoreWeights], 0) / totalWeight);
  const classification: Classification = score >= 90 ? "Excelente" : score >= 80 ? "Muito boa" : score >= 70 ? "Boa" : score >= 60 ? "Atenção" : "Alto risco";
  const positives: string[] = [];
  const warnings: string[] = [];
  if (input.netMarginPercent >= 15) positives.push("Margem acima da meta de 15%"); else warnings.push("Margem abaixo da meta de 15%");
  if (input.roiPercent >= 25) positives.push("ROI acima da meta de 25%"); else warnings.push("ROI abaixo da meta de 25%");
  if (input.monthlySales >= 30) positives.push("Demanda estimada consistente"); else warnings.push("Velocidade estimada baixa");
  if (input.sellerCount <= 5) positives.push("Concorrência controlada");
  if (input.sellerCount > 8) warnings.push("Muitos vendedores disputando a oferta");
  if (input.amazonIsSeller) warnings.push("A própria Amazon aparece como vendedora");
  if (input.priceStability < 60) warnings.push("Preço com instabilidade recente");
  return { score, classification, components, positives, warnings };
};

export const calculateRecommendedQuantity = (input: {
  monthlySalesEstimate: number; sellerCount: number; score: number; capitalAvailable: number;
  unitCost: number; riskLevel: "LOW" | "MEDIUM" | "HIGH"; expectedMarketShare?: number;
}): number => {
  if (input.unitCost <= 0 || input.capitalAvailable <= 0 || input.score < 60) return 0;
  const share = input.expectedMarketShare ?? Math.min(0.2, 1 / Math.max(2, input.sellerCount + 1));
  const demandTest = Math.max(1, Math.ceil(input.monthlySalesEstimate * share * 0.5));
  const riskCap = input.riskLevel === "HIGH" ? 3 : input.riskLevel === "MEDIUM" ? 6 : 10;
  const scoreCap = input.score >= 85 ? 10 : input.score >= 75 ? 6 : 3;
  const capitalCap = Math.floor((input.capitalAvailable * 0.05) / input.unitCost);
  return Math.max(0, Math.min(demandTest, riskCap, scoreCap, capitalCap));
};

export const generateOpportunitySummary = (analysis: OpportunityScoreInput & { score: number }) => {
  const detail = calculateOpportunityScore(analysis);
  const recommendation: Recommendation = analysis.score >= 75 && analysis.netMarginPercent >= 15 && analysis.roiPercent >= 25
    ? "BUY_TEST" : analysis.score >= 60 ? "WATCH" : "AVOID";
  const headline = recommendation === "BUY_TEST" ? "Bom candidato para lote inicial." : recommendation === "WATCH"
    ? "Acompanhe antes de comprometer capital." : "Não recomendamos a compra neste momento.";
  return { recommendation, headline, summary: `${detail.classification}: ${detail.positives[0] ?? "faltam sinais positivos"}.`, positives: detail.positives, warnings: detail.warnings };
};
