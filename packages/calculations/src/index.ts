export type Classification = "Excelente" | "Muito boa" | "Boa" | "Atenção" | "Alto risco";
export type Recommendation = "BUY_TEST" | "WATCH" | "AVOID";
export type ResearchStrategyType = "BRANDED_RESELL" | "GENERIC_LISTING";
export type BrandApprovalStatus = "UNKNOWN" | "NOT_REQUIRED" | "REQUIRED" | "APPROVED" | "REJECTED";
export type AmazonApprovalStatus =
  | "NOT_CHECKED"
  | "OPEN"
  | "REQUIRES_INVOICE"
  | "REQUIRES_10_UNITS"
  | "REQUIRES_LOA"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "UNAVAILABLE";

export interface ResearchCriteria {
  minimumMarginPercent: number;
  idealMarginPercent: number;
  minimumRoiPercent: number;
  maximumTurnoverDays: number;
  maximumSellerCount: number;
  maximumCapitalExposure: number;
}

export interface ResearchCandidateInput {
  id: string;
  name: string;
  strategyType: ResearchStrategyType;
  estimatedCost: number;
  amazonPrice: number;
  estimatedDemand: number;
  sellerCount: number;
  rating: number | null;
  reviewCount: number;
  historyAvailable: boolean;
  estimatedTurnoverDays: number | null;
  amazonIsSeller: boolean;
  brandApprovalStatus: BrandApprovalStatus;
  amazonApprovalStatus: AmazonApprovalStatus;
  minimumRequiredQuantity?: number | null;
}

export interface ResearchCandidateAnalysis {
  candidateId: string;
  score: number;
  recommendation: Recommendation;
  estimatedMarginPercent: number;
  estimatedRoiPercent: number;
  estimatedCapitalExposure: number;
  reasons: string[];
  restrictions: string[];
  strategySignals: string[];
}

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
  velocity: number;
  margin: number;
  roi: number;
  priceStability: number;
  competition: number;
  demandStability: number;
  amazonPresence: number;
  inventoryRisk: number;
}

export const FAST_CASH_WEIGHTS: ScoreWeights = {
  velocity: 25,
  margin: 20,
  roi: 15,
  priceStability: 10,
  competition: 10,
  demandStability: 10,
  amazonPresence: 5,
  inventoryRisk: 5,
};

export const BALANCED_WEIGHTS: ScoreWeights = {
  velocity: 20,
  margin: 20,
  roi: 15,
  priceStability: 15,
  competition: 10,
  demandStability: 10,
  amazonPresence: 5,
  inventoryRisk: 5,
};

export const HIGH_MARGIN_WEIGHTS: ScoreWeights = {
  velocity: 15,
  margin: 30,
  roi: 20,
  priceStability: 10,
  competition: 10,
  demandStability: 5,
  amazonPresence: 5,
  inventoryRisk: 5,
};

export type StrategyProfile = "FAST_CASH" | "BALANCED" | "HIGH_MARGIN";
export const getScoreWeights = (profile: StrategyProfile): ScoreWeights =>
  profile === "HIGH_MARGIN"
    ? HIGH_MARGIN_WEIGHTS
    : profile === "BALANCED"
      ? BALANCED_WEIGHTS
      : FAST_CASH_WEIGHTS;

const round = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

export const calculateProfit = (revenue: number, expenses: number): number =>
  round(revenue - expenses);
export const calculateMargin = (profit: number, salePrice: number): number =>
  salePrice > 0 ? round((profit / salePrice) * 100) : 0;
export const calculateROI = (profit: number, investedCapital: number): number =>
  investedCapital > 0 ? round((profit / investedCapital) * 100) : 0;

export const calculateBreakEvenPrice = (input: CalculationInput): number => {
  const fixed =
    input.productCost +
    (input.inboundShipping ?? 0) +
    (input.packaging ?? 0) +
    (input.amazonCommission ?? 0) +
    (input.amazonLogistics ?? 0) +
    (input.advertising ?? 0) +
    (input.otherExpenses ?? 0);
  const variableRate = input.taxRate ?? 0;
  return variableRate >= 1 ? Number.POSITIVE_INFINITY : round(fixed / (1 - variableRate));
};

export const calculateMaxPurchasePrice = (input: Omit<CalculationInput, "productCost">): number => {
  const targetMargin = input.targetMarginRate ?? 0.15;
  const taxes = input.salePrice * (input.taxRate ?? 0);
  const nonProductCosts =
    (input.inboundShipping ?? 0) +
    (input.packaging ?? 0) +
    (input.amazonCommission ?? 0) +
    (input.amazonLogistics ?? 0) +
    (input.advertising ?? 0) +
    (input.otherExpenses ?? 0);
  return round(Math.max(0, input.salePrice * (1 - targetMargin) - taxes - nonProductCosts));
};

export const calculateFinancials = (input: CalculationInput): CalculationResult => {
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const taxes = input.salePrice * (input.taxRate ?? 0);
  const totalExpenses =
    input.productCost +
    (input.inboundShipping ?? 0) +
    (input.packaging ?? 0) +
    taxes +
    (input.amazonCommission ?? 0) +
    (input.amazonLogistics ?? 0) +
    (input.advertising ?? 0) +
    (input.otherExpenses ?? 0);
  const profit = calculateProfit(input.salePrice, totalExpenses);
  const acquisitionCost = input.productCost + (input.inboundShipping ?? 0) + (input.packaging ?? 0);
  const breakEvenPrice = calculateBreakEvenPrice(input);
  return {
    revenue: round(input.salePrice * quantity),
    totalExpensesPerUnit: round(totalExpenses),
    netProfitPerUnit: profit,
    totalProfit: round(profit * quantity),
    netMarginPercent: calculateMargin(profit, input.salePrice),
    roiPercent: calculateROI(profit, acquisitionCost),
    markupPercent: calculateROI(input.salePrice - input.productCost, input.productCost),
    breakEvenPrice,
    minimumSalePrice: breakEvenPrice,
    maxPurchasePrice: calculateMaxPurchasePrice(input),
    requiredCapital: round(acquisitionCost * quantity),
  };
};

export const calculateOpportunityScore = (
  input: OpportunityScoreInput,
  weights = FAST_CASH_WEIGHTS,
) => {
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
  const score = Math.round(
    Object.entries(components).reduce(
      (sum, [key, value]) => sum + value * weights[key as keyof ScoreWeights],
      0,
    ) / totalWeight,
  );
  const classification: Classification =
    score >= 90
      ? "Excelente"
      : score >= 80
        ? "Muito boa"
        : score >= 70
          ? "Boa"
          : score >= 60
            ? "Atenção"
            : "Alto risco";
  const positives: string[] = [];
  const warnings: string[] = [];
  if (input.netMarginPercent >= 15) positives.push("Margem acima da meta de 15%");
  else warnings.push("Margem abaixo da meta de 15%");
  if (input.roiPercent >= 25) positives.push("ROI acima da meta de 25%");
  else warnings.push("ROI abaixo da meta de 25%");
  if (input.monthlySales >= 30) positives.push("Demanda estimada consistente");
  else warnings.push("Velocidade estimada baixa");
  if (input.sellerCount <= 5) positives.push("Concorrência controlada");
  if (input.sellerCount > 8) warnings.push("Muitos vendedores disputando a oferta");
  if (input.amazonIsSeller) warnings.push("A própria Amazon aparece como vendedora");
  if (input.priceStability < 60) warnings.push("Preço com instabilidade recente");
  return { score, classification, components, positives, warnings };
};

export const calculateRecommendedQuantity = (input: {
  monthlySalesEstimate: number;
  sellerCount: number;
  score: number;
  capitalAvailable: number;
  unitCost: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  expectedMarketShare?: number;
  maxExposurePercent?: number;
}): number => {
  if (input.unitCost <= 0 || input.capitalAvailable <= 0 || input.score < 60) return 0;
  const share = input.expectedMarketShare ?? Math.min(0.2, 1 / Math.max(2, input.sellerCount + 1));
  const demandTest = Math.max(1, Math.ceil(input.monthlySalesEstimate * share * 0.5));
  const riskCap = input.riskLevel === "HIGH" ? 3 : input.riskLevel === "MEDIUM" ? 6 : 10;
  const scoreCap = input.score >= 85 ? 10 : input.score >= 75 ? 6 : 3;
  const capitalCap = Math.floor(
    (input.capitalAvailable * ((input.maxExposurePercent ?? 5) / 100)) / input.unitCost,
  );
  return Math.max(0, Math.min(demandTest, riskCap, scoreCap, capitalCap));
};

export const generateOpportunitySummary = (analysis: OpportunityScoreInput & { score: number }) => {
  const detail = calculateOpportunityScore(analysis);
  const recommendation: Recommendation =
    analysis.score >= 75 && analysis.netMarginPercent >= 15 && analysis.roiPercent >= 25
      ? "BUY_TEST"
      : analysis.score >= 60
        ? "WATCH"
        : "AVOID";
  const headline =
    recommendation === "BUY_TEST"
      ? "Bom candidato para lote inicial."
      : recommendation === "WATCH"
        ? "Acompanhe antes de comprometer capital."
        : "Não recomendamos a compra neste momento.";
  return {
    recommendation,
    headline,
    summary: `${detail.classification}: ${detail.positives[0] ?? "faltam sinais positivos"}.`,
    positives: detail.positives,
    warnings: detail.warnings,
  };
};

const approvalRestrictions = (candidate: ResearchCandidateInput): string[] => {
  if (candidate.strategyType !== "BRANDED_RESELL") return [];
  const restrictions: string[] = [];
  if (candidate.brandApprovalStatus === "REJECTED")
    restrictions.push("Autorização da marca rejeitada.");
  if (candidate.brandApprovalStatus === "REQUIRED")
    restrictions.push("A marca exige autorização e ela ainda não foi aprovada.");
  if (candidate.brandApprovalStatus === "UNKNOWN")
    restrictions.push("Situação da autorização da marca ainda é desconhecida.");
  const messages: Partial<Record<AmazonApprovalStatus, string>> = {
    NOT_CHECKED: "Verificar autorização antes de comprar.",
    REQUIRES_INVOICE: "Amazon exige nota fiscal ou documento aceito.",
    REQUIRES_10_UNITS: "Amazon exige compra mínima de 10 unidades para aprovação.",
    REQUIRES_LOA: "Amazon exige carta de autorização (LOA): risco elevado de aprovação.",
    UNDER_REVIEW: "Autorização da Amazon está em análise.",
    REJECTED: "Autorização da Amazon foi rejeitada.",
    UNAVAILABLE: "Produto indisponível para venda nesta conta Amazon.",
  };
  const message = messages[candidate.amazonApprovalStatus];
  if (message) restrictions.push(message);
  return restrictions;
};

const approvalRecommendationCap = (candidate: ResearchCandidateInput): Recommendation | null => {
  if (candidate.strategyType !== "BRANDED_RESELL") return null;
  if (
    ["REJECTED", "UNAVAILABLE"].includes(candidate.amazonApprovalStatus) ||
    candidate.brandApprovalStatus === "REJECTED"
  )
    return "AVOID";
  if (!["OPEN", "APPROVED"].includes(candidate.amazonApprovalStatus)) return "WATCH";
  if (!["NOT_REQUIRED", "APPROVED"].includes(candidate.brandApprovalStatus)) return "WATCH";
  return null;
};

/**
 * Preliminary comparison for sourcing research. It intentionally keeps approval
 * restrictions outside the numeric score so a blocker can never be hidden.
 */
export const analyzeResearchCandidate = (
  candidate: ResearchCandidateInput,
  criteria: ResearchCriteria,
): ResearchCandidateAnalysis => {
  const grossProfit = candidate.amazonPrice - candidate.estimatedCost;
  const estimatedMarginPercent = calculateMargin(grossProfit, candidate.amazonPrice);
  const estimatedRoiPercent = calculateROI(grossProfit, candidate.estimatedCost);
  const requiredQuantity = Math.max(1, candidate.minimumRequiredQuantity ?? 1);
  const estimatedCapitalExposure = round(candidate.estimatedCost * requiredQuantity);
  const reasons: string[] = [];
  const restrictions = approvalRestrictions(candidate);
  const strategySignals: string[] = [];

  const marginScore = clamp(
    (estimatedMarginPercent / Math.max(1, criteria.idealMarginPercent)) * 100,
  );
  const roiScore = clamp(
    (estimatedRoiPercent / Math.max(1, criteria.minimumRoiPercent * 1.5)) * 100,
  );
  const demandScore = clamp(candidate.estimatedDemand / 1.2);
  const turnoverScore =
    candidate.estimatedTurnoverDays == null
      ? 45
      : clamp((criteria.maximumTurnoverDays / Math.max(1, candidate.estimatedTurnoverDays)) * 100);
  const capitalScore =
    criteria.maximumCapitalExposure <= 0
      ? 0
      : clamp(100 - (estimatedCapitalExposure / criteria.maximumCapitalExposure) * 70);

  let strategyScore: number;
  if (candidate.strategyType === "GENERIC_LISTING") {
    const rankingEffort = candidate.reviewCount === 0 ? 35 : clamp(100 - candidate.reviewCount / 5);
    const advertisingReadiness =
      estimatedMarginPercent >= criteria.idealMarginPercent + 5
        ? 90
        : estimatedMarginPercent >= criteria.idealMarginPercent
          ? 65
          : 30;
    const reviewSignal = candidate.rating == null ? 35 : clamp((candidate.rating / 5) * 100);
    const listingMaturity = candidate.historyAvailable ? 85 : 35;
    const entryRisk = clamp(
      100 - candidate.sellerCount * 8 - (candidate.reviewCount > 500 ? 20 : 0),
    );
    strategyScore =
      rankingEffort * 0.2 +
      advertisingReadiness * 0.25 +
      reviewSignal * 0.15 +
      listingMaturity * 0.15 +
      entryRisk * 0.25;
    strategySignals.push(
      candidate.historyAvailable
        ? "Há histórico para avaliar a maturidade do anúncio."
        : "Sem histórico: maturidade e ranqueamento ainda precisam ser validados.",
      advertisingReadiness >= 65
        ? "A margem preliminar deixa espaço para publicidade."
        : "A margem preliminar oferece pouco espaço para publicidade.",
      candidate.reviewCount > 500
        ? "Anúncios maduros elevam o risco de entrada."
        : "Barreira de avaliações ainda parece administrável.",
    );
  } else {
    const competition = clamp(100 - Math.max(0, candidate.sellerCount - 1) * 12);
    const buyBox = candidate.sellerCount <= criteria.maximumSellerCount ? 85 : 35;
    const price = estimatedMarginPercent >= criteria.idealMarginPercent ? 100 : marginScore;
    const amazonPresence = candidate.amazonIsSeller ? 15 : 100;
    strategyScore =
      competition * 0.25 + buyBox * 0.25 + price * 0.2 + turnoverScore * 0.2 + amazonPresence * 0.1;
    strategySignals.push(
      candidate.sellerCount <= criteria.maximumSellerCount
        ? "Concorrência compatível com a meta de Buy Box."
        : "Muitos concorrentes podem reduzir a participação na Buy Box.",
      candidate.amazonIsSeller
        ? "A própria Amazon disputa preço e Buy Box."
        : "Amazon não foi informada como vendedora.",
      candidate.estimatedTurnoverDays == null
        ? "Giro ainda não estimado."
        : `Giro estimado em ${candidate.estimatedTurnoverDays} dias.`,
    );
  }

  const score = Math.round(
    marginScore * 0.2 +
      roiScore * 0.15 +
      demandScore * 0.15 +
      turnoverScore * 0.15 +
      capitalScore * 0.1 +
      strategyScore * 0.25,
  );
  if (estimatedMarginPercent >= criteria.idealMarginPercent)
    reasons.push(`Margem estimada de ${estimatedMarginPercent}% alcança a meta ideal.`);
  else if (estimatedMarginPercent >= criteria.minimumMarginPercent)
    reasons.push(
      `Margem estimada de ${estimatedMarginPercent}% supera o mínimo, mas não a meta ideal.`,
    );
  else
    reasons.push(
      `Margem estimada de ${estimatedMarginPercent}% está abaixo do mínimo de ${criteria.minimumMarginPercent}%.`,
    );
  reasons.push(
    estimatedRoiPercent >= criteria.minimumRoiPercent
      ? `ROI estimado de ${estimatedRoiPercent}% supera o mínimo.`
      : `ROI estimado de ${estimatedRoiPercent}% está abaixo do mínimo de ${criteria.minimumRoiPercent}%.`,
  );
  if (estimatedCapitalExposure > criteria.maximumCapitalExposure)
    restrictions.push(
      `Exposição estimada de R$ ${estimatedCapitalExposure.toFixed(2)} excede o limite configurado.`,
    );
  if (candidate.sellerCount > criteria.maximumSellerCount)
    reasons.push(
      `${candidate.sellerCount} vendedores excedem o máximo configurado de ${criteria.maximumSellerCount}.`,
    );

  const financiallyEligible =
    estimatedMarginPercent >= criteria.minimumMarginPercent &&
    estimatedRoiPercent >= criteria.minimumRoiPercent &&
    estimatedCapitalExposure <= criteria.maximumCapitalExposure &&
    (candidate.estimatedTurnoverDays == null ||
      candidate.estimatedTurnoverDays <= criteria.maximumTurnoverDays);
  let recommendation: Recommendation =
    financiallyEligible && score >= 70 ? "BUY_TEST" : score >= 50 ? "WATCH" : "AVOID";
  const cap = approvalRecommendationCap(candidate);
  if (cap === "AVOID" || (cap === "WATCH" && recommendation === "BUY_TEST")) recommendation = cap;
  return {
    candidateId: candidate.id,
    score,
    recommendation,
    estimatedMarginPercent,
    estimatedRoiPercent,
    estimatedCapitalExposure,
    reasons,
    restrictions,
    strategySignals,
  };
};

export const rankResearchCandidates = (
  candidates: ResearchCandidateInput[],
  criteria: ResearchCriteria,
) =>
  candidates
    .map((candidate) => ({ candidate, analysis: analyzeResearchCandidate(candidate, criteria) }))
    .sort(
      (a, b) =>
        b.analysis.score - a.analysis.score ||
        b.analysis.estimatedRoiPercent - a.analysis.estimatedRoiPercent,
    )
    .map((entry, index, all) => ({
      rank: index + 1,
      ...entry,
      comparisonReason:
        index === 0
          ? "Lidera pela melhor combinação ponderada de retorno, giro, risco e sinais da estratégia."
          : `${Math.max(0, all[index - 1]!.analysis.score - entry.analysis.score)} pontos abaixo do candidato anterior na combinação ponderada.`,
    }));
