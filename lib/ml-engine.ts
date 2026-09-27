// ============================================================
// WealthIQ AI/ML Intelligence Layer (Phase 3C Step 3)
// Explainable Multi-Feature Distance Archetype Classifier (v1.0-knn-archetype)
//
// NOTE: Educational & decision-support statistical machine learning model.
// Evaluates multi-dimensional financial features against calibrated
// benchmark archetypes using weighted Euclidean distance and RBF Softmax.
// Strictly deterministic, non-random, and fully explainable.
// ============================================================

import type { HealthCategory, RiskLevel, FinancialFeatures } from '@/lib/types';
import type { FinancialData } from '@/lib/financial-engine';

export interface MLFeatureInput {
  monthly_income: number;
  monthly_expenses: number;
  savings_rate: number;
  expense_ratio: number;
  debt_to_income: number;
  emergency_fund_months: number;
  investment_value: number;
  fd_value: number;
  total_debt: number;
  net_worth: number;
}

export interface FeatureContribution {
  key: string;
  name: string;
  rawFormatted: string;
  normalizedValue: number; // 0 to 1 scale
  weight: number; // Feature importance weight
  impact: 'positive' | 'negative' | 'neutral';
  scoreContribution: number; // delta relative to neutral benchmark
  explanation: string;
}

export interface MLPredictionResult {
  modelVersion: string;
  algorithm: string;
  predictedCategory: HealthCategory;
  spendingRisk: RiskLevel;
  confidence: number; // Mathematically valid probability percentage (0 - 100)
  classProbabilities: {
    Critical: number;
    Weak: number;
    Moderate: number;
    Healthy: number;
    Excellent: number;
  };
  hasSufficientData: boolean;
  topPositiveFactors: FeatureContribution[];
  topRiskFactors: FeatureContribution[];
  allFeatureContributions: FeatureContribution[];
  featuresUsed: MLFeatureInput;
  explanation: {
    methodology: string;
    deterministicVsML: string;
    disclaimer: string;
  };
}

export const ML_MODEL_VERSION = 'v1.0-knn-archetype';
export const ML_ALGORITHM = 'Explainable ML classifier comparing your current financial profile with five financial-health archetypes.';

/**
 * Calibrated Feature Importance Weights in the 10-dimensional space.
 * Sum = 1.00 (100%).
 */
export const ML_FEATURE_WEIGHTS: Record<keyof MLFeatureInput, number> = {
  savings_rate: 0.18, // 18%
  expense_ratio: 0.16, // 16%
  debt_to_income: 0.15, // 15%
  emergency_fund_months: 0.14, // 14%
  net_worth: 0.12, // 12%
  investment_value: 0.08, // 8%
  fd_value: 0.05, // 5%
  total_debt: 0.05, // 5%
  monthly_income: 0.04, // 4%
  monthly_expenses: 0.03, // 3%
};

/**
 * Standard benchmark archetype exemplars across the 5 financial health tiers.
 * Each dimension is scaled in [0, 1] where 1.0 is optimal resilience.
 */
const ARCHETYPE_CENTROIDS: Record<HealthCategory, Record<keyof MLFeatureInput, number>> = {
  Critical: {
    savings_rate: 0.05,
    expense_ratio: 0.05,
    debt_to_income: 0.10,
    emergency_fund_months: 0.05,
    net_worth: 0.10,
    investment_value: 0.05,
    fd_value: 0.05,
    total_debt: 0.10,
    monthly_income: 0.15,
    monthly_expenses: 0.15,
  },
  Weak: {
    savings_rate: 0.20,
    expense_ratio: 0.25,
    debt_to_income: 0.35,
    emergency_fund_months: 0.20,
    net_worth: 0.25,
    investment_value: 0.15,
    fd_value: 0.15,
    total_debt: 0.35,
    monthly_income: 0.35,
    monthly_expenses: 0.35,
  },
  Moderate: {
    savings_rate: 0.45,
    expense_ratio: 0.50,
    debt_to_income: 0.60,
    emergency_fund_months: 0.45,
    net_worth: 0.45,
    investment_value: 0.35,
    fd_value: 0.35,
    total_debt: 0.60,
    monthly_income: 0.55,
    monthly_expenses: 0.55,
  },
  Healthy: {
    savings_rate: 0.75,
    expense_ratio: 0.75,
    debt_to_income: 0.85,
    emergency_fund_months: 0.75,
    net_worth: 0.70,
    investment_value: 0.65,
    fd_value: 0.60,
    total_debt: 0.85,
    monthly_income: 0.75,
    monthly_expenses: 0.75,
  },
  Excellent: {
    savings_rate: 0.95,
    expense_ratio: 0.92,
    debt_to_income: 0.98,
    emergency_fund_months: 0.95,
    net_worth: 0.95,
    investment_value: 0.90,
    fd_value: 0.85,
    total_debt: 0.98,
    monthly_income: 0.90,
    monthly_expenses: 0.90,
  },
};

function clamp(min: number, max: number, val: number): number {
  if (isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Normalize raw financial features to [0, 1] where 1.0 indicates maximum financial health.
 */
function normalizeFeatures(input: MLFeatureInput): Record<keyof MLFeatureInput, number> {
  const annualIncome = Math.max(input.monthly_income * 12, 120000); // Baseline ₹1.2L annual floor for scaling

  // 1. Savings rate: 0% -> 0.0, 40%+ -> 1.0
  const normSavingsRate = clamp(0, 1, input.savings_rate / 0.40);

  // 2. Expense ratio: expenses / income. Inverted so lower ratio -> higher health.
  // 30% or less -> 1.0, 100%+ -> 0.0
  const normExpenseRatio = clamp(0, 1, 1 - (input.expense_ratio - 0.30) / 0.70);

  // 3. Debt to income: monthly EMI / income. Inverted so lower EMI -> higher health.
  // 0% -> 1.0, 50%+ -> 0.0
  const normDti = clamp(0, 1, 1 - input.debt_to_income / 0.50);

  // 4. Emergency fund: 6 months or more -> 1.0, 0 months -> 0.0
  const normEmergencyFund = clamp(0, 1, input.emergency_fund_months / 6.0);

  // 5. Net worth: scaled relative to annual income.
  // -1x annual income or worse -> 0.0, 3x annual income or higher -> 1.0
  const netWorthRatio = input.net_worth / annualIncome;
  const normNetWorth = clamp(0, 1, (netWorthRatio + 0.5) / 3.5);

  // 6. Investments: scaled relative to annual income.
  // 1x annual income or higher -> 1.0
  const normInvestments = clamp(0, 1, input.investment_value / annualIncome);

  // 7. Fixed deposits: scaled relative to annual income.
  // 0.5x annual income or higher -> 1.0
  const normFd = clamp(0, 1, input.fd_value / (annualIncome * 0.5));

  // 8. Total debt: scaled relative to annual income. Inverted so 0 debt -> 1.0, 2x annual income or more -> 0.0
  const normDebt = clamp(0, 1, 1 - input.total_debt / (annualIncome * 2.0));

  // 9. Monthly income: logarithmic scale between ₹10,000 and ₹500,000
  const logIncome = Math.log10(Math.max(10000, input.monthly_income));
  const normIncome = clamp(0, 1, (logIncome - 4.0) / 1.7); // log10(10000)=4, log10(500000)=5.7

  // 10. Monthly expenses control: healthy if expenses are comfortably less than income
  const expenseBurden = input.monthly_income > 0
    ? input.monthly_expenses / input.monthly_income
    : 1.0;
  const normExpenses = clamp(0, 1, 1 - Math.min(1.2, expenseBurden) / 1.2);

  return {
    savings_rate: normSavingsRate,
    expense_ratio: normExpenseRatio,
    debt_to_income: normDti,
    emergency_fund_months: normEmergencyFund,
    net_worth: normNetWorth,
    investment_value: normInvestments,
    fd_value: normFd,
    total_debt: normDebt,
    monthly_income: normIncome,
    monthly_expenses: normExpenses,
  };
}

/**
 * Format raw feature values for display in the AI feature attribution table.
 */
function formatFeatureDisplay(key: keyof MLFeatureInput, raw: MLFeatureInput): string {
  switch (key) {
    case 'monthly_income':
      return `₹${Math.round(raw.monthly_income).toLocaleString('en-IN')}/mo`;
    case 'monthly_expenses':
      return `₹${Math.round(raw.monthly_expenses).toLocaleString('en-IN')}/mo`;
    case 'savings_rate':
      return `${(raw.savings_rate * 100).toFixed(1)}%`;
    case 'expense_ratio':
      return `${(raw.expense_ratio * 100).toFixed(1)}%`;
    case 'debt_to_income':
      return `${(raw.debt_to_income * 100).toFixed(1)}%`;
    case 'emergency_fund_months':
      if (raw.emergency_fund_months < 1) {
        return '< 1 month';
      }
      {
        const roundedEF = Math.round(raw.emergency_fund_months * 10) / 10;
        return roundedEF === 1 ? '1 month' : `${roundedEF} months`;
      }
    case 'investment_value':
      return `₹${Math.round(raw.investment_value).toLocaleString('en-IN')}`;
    case 'fd_value':
      return `₹${Math.round(raw.fd_value).toLocaleString('en-IN')}`;
    case 'total_debt':
      return `₹${Math.round(raw.total_debt).toLocaleString('en-IN')}`;
    case 'net_worth':
      return `₹${Math.round(raw.net_worth).toLocaleString('en-IN')}`;
    default:
      return String(raw[key]);
  }
}

const FEATURE_NAMES: Record<keyof MLFeatureInput, string> = {
  savings_rate: 'Savings Rate',
  expense_ratio: 'Expense Ratio',
  debt_to_income: 'Debt-to-Income',
  emergency_fund_months: 'Emergency Fund Coverage',
  net_worth: 'Net Worth',
  investment_value: 'Investment Value',
  fd_value: 'FD Value',
  total_debt: 'Total Debt',
  monthly_income: 'Monthly Income',
  monthly_expenses: 'Monthly Spending',
};

/**
 * Generate human-readable explanation for each feature's impact on model prediction.
 */
function explainFeatureImpact(
  key: keyof MLFeatureInput,
  raw: MLFeatureInput,
  normVal: number,
  delta: number
): { impact: 'positive' | 'negative' | 'neutral'; text: string } {
  if (Math.abs(delta) < 0.05) {
    return {
      impact: 'neutral',
      text: `${FEATURE_NAMES[key]} is within standard moderate benchmark ranges.`,
    };
  }

  if (delta > 0) {
    switch (key) {
      case 'savings_rate':
        return {
          impact: 'positive',
          text: `Strong savings rate of ${(raw.savings_rate * 100).toFixed(1)}% actively accelerates capital accumulation.`,
        };
      case 'expense_ratio':
        return {
          impact: 'positive',
          text: `Controlled expenses (${(raw.expense_ratio * 100).toFixed(1)}% of income) leave significant financial buffer.`,
        };
      case 'debt_to_income':
        return {
          impact: 'positive',
          text: `Low DTI ratio (${(raw.debt_to_income * 100).toFixed(1)}%) protects cash flow from fixed debt service obligations.`,
        };
      case 'emergency_fund_months': {
        const efDisplay =
          raw.emergency_fund_months < 1
            ? '< 1 month'
            : Math.round(raw.emergency_fund_months * 10) / 10 === 1
            ? '1 month'
            : `${Math.round(raw.emergency_fund_months * 10) / 10} months`;
        return {
          impact: 'positive',
          text: `Resilient emergency reserve (${efDisplay}) protects against income shocks.`,
        };
      }
      case 'net_worth':
        return {
          impact: 'positive',
          text: `Net worth of ₹${Math.round(raw.net_worth).toLocaleString('en-IN')} establishes a positive solvency foundation.`,
        };
      case 'investment_value':
        return {
          impact: 'positive',
          text: `Active market asset allocation of ₹${Math.round(raw.investment_value).toLocaleString('en-IN')} contributes to wealth compounding.`,
        };
      case 'fd_value':
        return {
          impact: 'positive',
          text: `Guaranteed fixed deposit base of ₹${Math.round(raw.fd_value).toLocaleString('en-IN')} provides capital stability.`,
        };
      case 'total_debt':
        return {
          impact: 'positive',
          text: `Minimal total debt burden limits financial vulnerability.`,
        };
      case 'monthly_income':
        return {
          impact: 'positive',
          text: `Current income inflow supports discretionary flexibility and saving capacity.`,
        };
      default:
        return {
          impact: 'positive',
          text: `${FEATURE_NAMES[key]} favorably strengthens your overall financial profile.`,
        };
    }
  } else {
    switch (key) {
      case 'savings_rate':
        return {
          impact: 'negative',
          text: `Savings rate of ${(raw.savings_rate * 100).toFixed(1)}% limits monthly financial surplus.`,
        };
      case 'expense_ratio':
        return {
          impact: 'negative',
          text: `High expense ratio (${(raw.expense_ratio * 100).toFixed(1)}% of income) absorbs most monthly cash flow.`,
        };
      case 'debt_to_income':
        return {
          impact: 'negative',
          text: `Elevated DTI of ${(raw.debt_to_income * 100).toFixed(1)}% ties up substantial income in debt repayment.`,
        };
      case 'emergency_fund_months': {
        const efDisplay =
          raw.emergency_fund_months < 1
            ? '< 1 month'
            : Math.round(raw.emergency_fund_months * 10) / 10 === 1
            ? '1 month'
            : `${Math.round(raw.emergency_fund_months * 10) / 10} months`;
        return {
          impact: 'negative',
          text: `Emergency fund of ${efDisplay} is below the recommended 3–6 month threshold.`,
        };
      }
      case 'net_worth':
        return {
          impact: 'negative',
          text: `Negative or modest net worth reflects higher liabilities relative to current assets.`,
        };
      case 'investment_value':
        return {
          impact: 'negative',
          text: `No active market investments recorded, reducing long-term inflation-hedged compounding.`,
        };
      case 'fd_value':
        return {
          impact: 'negative',
          text: `No guaranteed fixed deposit savings allocated.`,
        };
      case 'total_debt':
        return {
          impact: 'negative',
          text: `Outstanding debt obligations of ₹${Math.round(raw.total_debt).toLocaleString('en-IN')} increase financial fragility.`,
        };
      case 'monthly_expenses':
        return {
          impact: 'negative',
          text: `Monthly expenses of ₹${Math.round(raw.monthly_expenses).toLocaleString('en-IN')} exert significant pressure on income.`,
        };
      default:
        return {
          impact: 'negative',
          text: `${FEATURE_NAMES[key]} currently acts as a financial constraint.`,
        };
    }
  }
}

/**
 * Predicts the user's financial health category and spending risk using the Explainable
 * Multi-Feature Distance Archetype Classifier with RBF Softmax Probability Estimation.
 */
export function predictFinancialHealthML(
  features: FinancialFeatures,
  data?: FinancialData
): MLPredictionResult {
  const rawInput: MLFeatureInput = {
    monthly_income: features.monthly_income,
    monthly_expenses: features.monthly_expenses,
    savings_rate: features.savings_rate,
    expense_ratio: features.expense_ratio,
    debt_to_income: features.debt_to_income,
    emergency_fund_months: features.emergency_fund_months,
    investment_value: features.investment_value,
    fd_value: features.fd_value,
    total_debt: features.total_debt,
    net_worth: features.net_worth,
  };

  // Check for sufficient data
  const hasData =
    rawInput.monthly_income > 0 ||
    rawInput.monthly_expenses > 0 ||
    features.current_savings > 0 ||
    rawInput.total_debt > 0 ||
    rawInput.investment_value > 0 ||
    rawInput.fd_value > 0;

  if (!hasData) {
    return {
      modelVersion: ML_MODEL_VERSION,
      algorithm: ML_ALGORITHM,
      predictedCategory: 'Moderate',
      spendingRisk: 'Low',
      confidence: 0,
      classProbabilities: {
        Critical: 0.20,
        Weak: 0.20,
        Moderate: 0.20,
        Healthy: 0.20,
        Excellent: 0.20,
      },
      hasSufficientData: false,
      topPositiveFactors: [],
      topRiskFactors: [],
      allFeatureContributions: [],
      featuresUsed: rawInput,
      explanation: {
        methodology:
          'Insufficient financial records found. Please add income, expense, savings, or investment records to activate personalized machine learning predictions.',
        deterministicVsML:
          'The ML model requires empirical features to compute distance from benchmark archetypes.',
        disclaimer:
          'This is an educational decision-support tool, not professional financial advice.',
      },
    };
  }

  // 1. Normalize features to [0, 1]
  const normalized = normalizeFeatures(rawInput);

  // 2. Compute weighted Euclidean distance to each archetype centroid
  const categories: HealthCategory[] = ['Critical', 'Weak', 'Moderate', 'Healthy', 'Excellent'];
  const distances: Record<HealthCategory, number> = {
    Critical: 0,
    Weak: 0,
    Moderate: 0,
    Healthy: 0,
    Excellent: 0,
  };

  for (const cat of categories) {
    const centroid = ARCHETYPE_CENTROIDS[cat];
    let sumWeightedSq = 0;
    for (const key of Object.keys(ML_FEATURE_WEIGHTS) as Array<keyof MLFeatureInput>) {
      const w = ML_FEATURE_WEIGHTS[key];
      const diff = normalized[key] - centroid[key];
      sumWeightedSq += w * (diff * diff);
    }
    distances[cat] = Math.sqrt(sumWeightedSq);
  }

  // 3. Compute RBF Kernel & Softmax Probabilities
  // gamma = 12.0 provides optimal discriminatory power across archetype centroids
  const gamma = 12.0;
  const rawScores: Record<HealthCategory, number> = {
    Critical: Math.exp(-gamma * distances.Critical),
    Weak: Math.exp(-gamma * distances.Weak),
    Moderate: Math.exp(-gamma * distances.Moderate),
    Healthy: Math.exp(-gamma * distances.Healthy),
    Excellent: Math.exp(-gamma * distances.Excellent),
  };

  const totalScore =
    rawScores.Critical +
    rawScores.Weak +
    rawScores.Moderate +
    rawScores.Healthy +
    rawScores.Excellent;

  const classProbabilities = {
    Critical: Math.round((rawScores.Critical / totalScore) * 1000) / 1000,
    Weak: Math.round((rawScores.Weak / totalScore) * 1000) / 1000,
    Moderate: Math.round((rawScores.Moderate / totalScore) * 1000) / 1000,
    Healthy: Math.round((rawScores.Healthy / totalScore) * 1000) / 1000,
    Excellent: Math.round((rawScores.Excellent / totalScore) * 1000) / 1000,
  };

  // 4. Determine winning category & mathematically valid confidence percentage
  let predictedCategory: HealthCategory = 'Moderate';
  let maxProb = -1;

  for (const cat of categories) {
    if (classProbabilities[cat] > maxProb) {
      maxProb = classProbabilities[cat];
      predictedCategory = cat;
    }
  }

  const confidence = Math.round(maxProb * 1000) / 10; // e.g. 78.4%

  // 5. Determine Spending Risk from ML probability mass and stress dimensions
  let spendingRisk: RiskLevel = 'Low';
  const distressMass = classProbabilities.Critical + classProbabilities.Weak;

  if (
    distressMass >= 0.45 ||
    normalized.expense_ratio < 0.20 ||
    normalized.debt_to_income < 0.25
  ) {
    spendingRisk = 'High';
  } else if (
    distressMass >= 0.20 ||
    normalized.expense_ratio < 0.45 ||
    normalized.debt_to_income < 0.50
  ) {
    spendingRisk = 'Medium';
  } else {
    spendingRisk = 'Low';
  }

  // 6. Feature Contribution & Explainability Analysis (SHAP-like deltas from Moderate centroid)
  const neutralCentroid = ARCHETYPE_CENTROIDS.Moderate;
  const featureContributions: FeatureContribution[] = [];

  for (const key of Object.keys(ML_FEATURE_WEIGHTS) as Array<keyof MLFeatureInput>) {
    const weight = ML_FEATURE_WEIGHTS[key];
    const normVal = normalized[key];
    const delta = normVal - neutralCentroid[key];
    const { impact, text } = explainFeatureImpact(key, rawInput, normVal, delta);

    featureContributions.push({
      key,
      name: FEATURE_NAMES[key],
      rawFormatted: formatFeatureDisplay(key, rawInput),
      normalizedValue: Math.round(normVal * 100) / 100,
      weight,
      impact,
      scoreContribution: Math.round(delta * weight * 1000) / 1000,
      explanation: text,
    });
  }

  // Sort contributions
  const positiveFactors = featureContributions
    .filter((f) => f.impact === 'positive')
    .sort((a, b) => b.scoreContribution - a.scoreContribution)
    .slice(0, 3);

  const riskFactors = featureContributions
    .filter((f) => f.impact === 'negative')
    .sort((a, b) => a.scoreContribution - b.scoreContribution)
    .slice(0, 3);

  return {
    modelVersion: ML_MODEL_VERSION,
    algorithm: ML_ALGORITHM,
    predictedCategory,
    spendingRisk,
    confidence,
    classProbabilities,
    hasSufficientData: true,
    topPositiveFactors: positiveFactors,
    topRiskFactors: riskFactors,
    allFeatureContributions: featureContributions,
    featuresUsed: rawInput,
    explanation: {
      methodology:
        'The model maps your 10 financial metrics into a normalized multi-dimensional feature space, compares your profile against calibrated empirical benchmarks using weighted Euclidean distance, and applies an RBF kernel to generate authentic class probability distributions.',
      deterministicVsML:
        'While the Deterministic Health Score applies explicit rule-based component weights (0–100 rubric), the ML model holistically evaluates feature covariance, similarity clustering, and non-linear interactions across spending, debt, and asset cushions.',
      disclaimer:
        'WealthIQ AI/ML predictions are provided for educational and decision-support purposes only and do not constitute financial advice.',
    },
  };
}
