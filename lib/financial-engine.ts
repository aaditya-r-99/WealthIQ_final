// ============================================================
// WealthIQ Financial Intelligence Engine (Phase 3C Step 1)
// Transparent, Deterministic Financial Health Scoring & Spending Risk
// NOTE: Educational & demo financial model; not professional advice.
// ============================================================

import type { Database } from '@/lib/supabase/types';
import type {
  HealthCategory,
  RiskLevel,
  FinancialFeatures,
  ForecastPoint,
} from '@/lib/types';
import { supabase } from '@/lib/supabase/client';

export type IncomeRow = Database['public']['Tables']['income_records']['Row'];
export type ExpenseRow = Database['public']['Tables']['expense_records']['Row'];
export type SavingsRow = Database['public']['Tables']['savings_records']['Row'];
export type DebtRow = Database['public']['Tables']['debts']['Row'];
export type InvestmentRow = Database['public']['Tables']['investments']['Row'];
export type FDRow = Database['public']['Tables']['fixed_deposits']['Row'];
export type ScoreRow = Database['public']['Tables']['financial_scores']['Row'];

export interface FinancialData {
  incomeRecords: IncomeRow[];
  expenseRecords: ExpenseRow[];
  savingsRecords: SavingsRow[];
  debtRecords: DebtRow[];
  investmentRecords: InvestmentRow[];
  fdRecords: FDRow[];
}

export interface ScoreBreakdown {
  savings_score: number;
  expense_score: number;
  debt_score: number;
  emergency_score: number;
  investment_score: number;
}

export interface FinancialScoreResult {
  health_score: number;
  health_category: HealthCategory;
  spending_risk: RiskLevel;
  breakdown: ScoreBreakdown;
  features: FinancialFeatures;
}

export interface ForecastHorizonPoint {
  months: number;
  label: string;
  savings: number;
  net_worth: number;
  debt: number;
}

export type ForecastingTier = 'tier_0' | 'tier_1' | 'tier_2' | 'tier_3';

export type ForecastingMethod =
  | 'insufficient_history'
  | 'run_rate_fallback'
  | '3m_simple_moving_average'
  | '6m_exponential_weighted_moving_average'
  | 'deterministic_fallback_mature';

export interface MonthlyExpenseAggregate {
  month: string; // 'YYYY-MM'
  total: number;
  essential: number;
  discretionary: number;
  recordCount: number;
  categories: Record<string, number>;
}

export interface NextMonthExpenseForecastResult {
  tier: ForecastingTier;
  method: ForecastingMethod;
  method_name: string;
  estimated_amount: number | null;
  usable_months_count: number;
  usable_months: string[];
  target_month: string; // 'YYYY-MM'
  is_supported: boolean;
  explanation: string;
  data_limitations: string[];
  historical_aggregates: MonthlyExpenseAggregate[];
}

export interface FinancialForecastResult {
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  current_savings: number;
  current_investments: number;
  current_fd_principal: number;
  current_debt: number;
  current_net_worth: number;
  trajectory_type: 'positive' | 'neutral' | 'deficit';
  trajectory_label: string;
  points: ForecastPoint[];
  horizons: {
    current: ForecastHorizonPoint;
    m6: ForecastHorizonPoint;
    m12: ForecastHorizonPoint;
    m24: ForecastHorizonPoint;
    m36: ForecastHorizonPoint;
  };
  assumptions: string[];
  next_month_expense_forecast?: NextMonthExpenseForecastResult;
}

/**
 * Weights used for combining component scores into the 0-100 Financial Health Score.
 * Explicit 5 components:
 * 1. savings behavior: 25%
 * 2. expense burden: 25%
 * 3. debt burden: 20%
 * 4. emergency fund coverage: 15%
 * 5. investments/assets: 15%
 * Total sum = 100%.
 */
export const SCORE_WEIGHTS = {
  savings: 0.25, // 25%
  expense: 0.25, // 25%
  debt: 0.20, // 20%
  emergency: 0.15, // 15%
  investment: 0.15, // 15%
} as const;

/**
 * Spending risk classification thresholds.
 */
export const RISK_THRESHOLDS = {
  high: {
    expense_ratio: 0.85, // Expenses > 85% of income
    debt_to_income: 0.45, // Monthly EMI > 45% of income
  },
  medium: {
    expense_ratio: 0.65, // Expenses > 65% of income
    discretionary_ratio: 0.25, // Discretionary > 25% of income
    debt_to_income: 0.30, // Monthly EMI > 30% of income
    savings_rate: 0.10, // Saving < 10% of income
  },
} as const;

function clamp(min: number, max: number, val: number): number {
  if (isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Step 2: Feature Engineering from user's Supabase records.
 * Guaranteed never to produce NaN or Infinity.
 */
export function calculateFinancialFeatures(data: FinancialData): FinancialFeatures {
  const {
    incomeRecords,
    expenseRecords,
    savingsRecords,
    debtRecords,
    investmentRecords,
    fdRecords,
  } = data;

  // 1. Income
  const monthly_income = incomeRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // 2. Expenses
  const essential_expenses = expenseRecords
    .filter((e) => e.expense_type === 'essential')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const discretionary_expenses = expenseRecords
    .filter((e) => e.expense_type === 'discretionary')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const monthly_expenses = essential_expenses + discretionary_expenses;

  // 3. Savings
  const totalSavingsType = savingsRecords
    .filter((s) => s.savings_type === 'Total Savings')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const current_savings =
    totalSavingsType > 0
      ? totalSavingsType
      : savingsRecords.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const emergency_fund = savingsRecords
    .filter((s) => s.savings_type === 'Emergency Fund')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // 4. Debts
  const total_debt = debtRecords.reduce((sum, d) => sum + Number(d.remaining_balance || 0), 0);
  const monthly_emi = debtRecords.reduce((sum, d) => sum + Number(d.monthly_emi || 0), 0);

  // 5. Investments & FDs
  const investment_value = investmentRecords.reduce(
    (sum, i) => sum + Number(i.quantity || 0) * Number(i.current_value || 0),
    0
  );
  const fd_value = fdRecords.reduce((sum, f) => {
    const principal = Number(f.principal || 0);
    const rate = Number(f.interest_rate || 0);
    const tenure = Number(f.tenure_months || 12);
    const interest = principal * (rate / 100) * (tenure / 12);
    return sum + principal + interest;
  }, 0);
  const fd_principal = fdRecords.reduce((sum, f) => sum + Number(f.principal || 0), 0);

  // 6. Net Worth Formula
  // Net Worth = Current Savings + Investment Value + FD Principal - Total Debt
  const net_worth = current_savings + investment_value + fd_principal - total_debt;

  // 7. Ratios (safe division)
  const savings_rate =
    monthly_income > 0
      ? clamp(0, 1, (monthly_income - monthly_expenses) / monthly_income)
      : current_savings > 0 && monthly_expenses === 0
      ? 1.0
      : 0.0;

  const expense_ratio =
    monthly_income > 0
      ? clamp(0, 2, monthly_expenses / monthly_income)
      : monthly_expenses > 0
      ? 1.0
      : 0.0;

  const discretionary_expense_ratio =
    monthly_income > 0
      ? clamp(0, 1, discretionary_expenses / monthly_income)
      : 0.0;

  const debt_to_income =
    monthly_income > 0
      ? clamp(0, 2, monthly_emi / monthly_income)
      : monthly_emi > 0
      ? 1.0
      : 0.0;

  const benchmarkEssential =
    essential_expenses > 0
      ? essential_expenses
      : monthly_expenses > 0
      ? monthly_expenses
      : 0;

  const emergency_fund_months =
    benchmarkEssential > 0
      ? clamp(0, 24, emergency_fund / benchmarkEssential)
      : emergency_fund > 0
      ? 6.0
      : 0.0;

  return {
    monthly_income,
    monthly_expenses,
    essential_expenses,
    discretionary_expenses,
    current_savings,
    emergency_fund,
    total_debt,
    monthly_emi,
    investment_value,
    fd_value,
    savings_rate,
    expense_ratio,
    discretionary_expense_ratio,
    debt_to_income,
    emergency_fund_months,
    net_worth,
  };
}

/**
 * Step 3: Transparent, deterministic scoring engine (0-100).
 */
export function calculateHealthScore(
  features: FinancialFeatures,
  data: FinancialData
): {
  health_score: number;
  health_category: HealthCategory;
  breakdown: ScoreBreakdown;
} {
  const hasAnyRecords =
    data.incomeRecords.length > 0 ||
    data.expenseRecords.length > 0 ||
    data.savingsRecords.length > 0 ||
    data.debtRecords.length > 0 ||
    data.investmentRecords.length > 0 ||
    data.fdRecords.length > 0;

  if (!hasAnyRecords) {
    return {
      health_score: 0,
      health_category: 'Moderate',
      breakdown: {
        savings_score: 0,
        expense_score: 0,
        debt_score: 0,
        emergency_score: 0,
        investment_score: 0,
      },
    };
  }

  // 1. Savings Behavior (0-100) — Benchmark: 20%+ savings rate gets 100
  let savings_score = 0;
  if (features.monthly_income > 0) {
    savings_score = clamp(0, 100, Math.round((features.savings_rate / 0.20) * 100));
  } else if (features.current_savings > 0) {
    savings_score = 50;
  }

  // 2. Expense Burden (0-100) — Benchmark: <= 40% expenses is 100, scaling down as expenses exceed
  let expense_score = 0;
  if (features.monthly_income > 0) {
    expense_score = clamp(0, 100, Math.round(100 - Math.max(0, features.expense_ratio - 0.40) * 140));
  } else if (features.monthly_expenses === 0) {
    expense_score = 75;
  } else {
    expense_score = 20;
  }

  // 3. Debt Burden (0-100) — Benchmark: 0 DTI is 100, scaling down with higher monthly EMI burden
  let debt_score = 0;
  if (features.total_debt === 0 && features.monthly_emi === 0) {
    debt_score = 100; // Debt-free bonus
  } else if (features.monthly_income > 0) {
    debt_score = clamp(0, 100, Math.round(100 - features.debt_to_income * 180));
  } else {
    debt_score = 20;
  }

  // 4. Emergency Fund Coverage (0-100) — Benchmark: 6 months of expenses gets 100
  const emergency_score = clamp(
    0,
    100,
    Math.round((features.emergency_fund_months / 6) * 100)
  );

  // 5. Investments & Assets (0-100) — Benchmark: 6 months of income (or min ₹1,00,000)
  let investment_score = 0;
  const totalAssets = features.investment_value + (data.fdRecords.reduce((s, f) => s + Number(f.principal || 0), 0));
  if (totalAssets > 0) {
    const targetAssetBenchmark =
      features.monthly_income > 0 ? features.monthly_income * 6 : 100000;
    investment_score = clamp(0, 100, Math.round((totalAssets / targetAssetBenchmark) * 100));
  }

  // Weighted combination across the 5 explicit components
  const weightedSum =
    savings_score * SCORE_WEIGHTS.savings +
    expense_score * SCORE_WEIGHTS.expense +
    debt_score * SCORE_WEIGHTS.debt +
    emergency_score * SCORE_WEIGHTS.emergency +
    investment_score * SCORE_WEIGHTS.investment;

  const health_score = clamp(0, 100, Math.round(weightedSum));

  // Determine Category
  let health_category: HealthCategory = 'Moderate';
  if (health_score >= 80) health_category = 'Excellent';
  else if (health_score >= 65) health_category = 'Healthy';
  else if (health_score >= 50) health_category = 'Moderate';
  else if (health_score >= 35) health_category = 'Weak';
  else health_category = 'Critical';

  return {
    health_score,
    health_category,
    breakdown: {
      savings_score,
      expense_score,
      debt_score,
      emergency_score,
      investment_score,
    },
  };
}

/**
 * Step 4: Deterministic Spending Risk Classifier.
 */
export function classifySpendingRisk(features: FinancialFeatures): RiskLevel {
  const { monthly_income, monthly_expenses, expense_ratio, discretionary_expense_ratio, debt_to_income, savings_rate } =
    features;

  // High Risk conditions
  if (
    (monthly_income === 0 && monthly_expenses > 0) ||
    monthly_expenses > monthly_income ||
    expense_ratio > RISK_THRESHOLDS.high.expense_ratio ||
    debt_to_income > RISK_THRESHOLDS.high.debt_to_income
  ) {
    return 'High';
  }

  // Medium Risk conditions
  if (
    expense_ratio > RISK_THRESHOLDS.medium.expense_ratio ||
    discretionary_expense_ratio > RISK_THRESHOLDS.medium.discretionary_ratio ||
    debt_to_income > RISK_THRESHOLDS.medium.debt_to_income ||
    (monthly_income > 0 && savings_rate < RISK_THRESHOLDS.medium.savings_rate)
  ) {
    return 'Medium';
  }

  // Otherwise healthy / Low Risk
  return 'Low';
}

/**
 * Step 5: Master calculation and persistence into financial_scores.
 */
export async function evaluateAndPersistFinancialScore(
  userId: string,
  data: FinancialData,
  lastKnownScore?: ScoreRow | null
): Promise<FinancialScoreResult> {
  const features = calculateFinancialFeatures(data);
  const { health_score, health_category, breakdown } = calculateHealthScore(features, data);
  const spending_risk = classifySpendingRisk(features);

  const roundedSavingsRate = Math.round(features.savings_rate * 1000) / 1000;
  const roundedExpenseRatio = Math.round(features.expense_ratio * 1000) / 1000;
  const roundedDebtToIncome = Math.round(features.debt_to_income * 1000) / 1000;
  const roundedEmergencyMonths = Math.round(features.emergency_fund_months * 10) / 10;

  // Determine if a new record needs to be inserted into financial_scores
  const isChanged =
    !lastKnownScore ||
    Number(lastKnownScore.health_score) !== health_score ||
    lastKnownScore.health_category !== health_category ||
    lastKnownScore.spending_risk !== spending_risk ||
    Number(lastKnownScore.expense_ratio) !== roundedExpenseRatio ||
    Number(lastKnownScore.savings_rate) !== roundedSavingsRate ||
    Number(lastKnownScore.debt_to_income) !== roundedDebtToIncome;

  if (isChanged && userId) {
    const payload = {
      user_id: userId,
      health_score,
      health_category,
      spending_risk,
      savings_rate: roundedSavingsRate,
      expense_ratio: roundedExpenseRatio,
      debt_to_income: roundedDebtToIncome,
      emergency_fund_months: roundedEmergencyMonths,
      model_version: 'v1.0-deterministic',
    };

    try {
      const { error } = await (supabase.from('financial_scores') as any).insert(payload);
      if (error) {
        console.error('Error persisting financial_scores record:', error);
      }
    } catch (err) {
      console.error('Failed to persist financial_scores:', err);
    }
  }

  return {
    health_score,
    health_category,
    spending_risk,
    breakdown,
    features,
  };
}

/**
 * Step 6: Deterministic Financial Forecast.
 * Projects Net Worth and Savings over 6, 12, 24, and 36 months based on
 * current income, expenses, and cash surplus/deficit.
 * Does NOT invent speculative market returns.
 */
export function calculateFinancialForecast(
  features: FinancialFeatures,
  data: FinancialData
): FinancialForecastResult {
  const monthly_income = Math.max(0, features.monthly_income || 0);
  const monthly_expenses = Math.max(0, features.monthly_expenses || 0);
  const monthly_surplus = monthly_income - monthly_expenses;
  const current_savings = Math.max(0, features.current_savings || 0);
  const current_investments = Math.max(0, features.investment_value || 0);
  const current_fd_principal = Math.max(
    0,
    (data.fdRecords || []).reduce((sum, f) => sum + Number(f.principal || 0), 0)
  );
  const current_debt = Math.max(0, features.total_debt || 0);
  const monthly_emi = Math.max(0, features.monthly_emi || 0);
  const current_net_worth = current_savings + current_investments + current_fd_principal - current_debt;

  let trajectory_type: 'positive' | 'neutral' | 'deficit' = 'neutral';
  let trajectory_label = 'Neutral cash flow: Monthly income matches expenses exactly.';

  if (monthly_surplus > 0) {
    trajectory_type = 'positive';
    trajectory_label = `Positive trajectory: Generating ₹${Math.round(monthly_surplus).toLocaleString('en-IN')}/month in net surplus.`;
  } else if (monthly_surplus < 0) {
    trajectory_type = 'deficit';
    trajectory_label = `Deficit trajectory: Monthly expenses exceed income by ₹${Math.round(Math.abs(monthly_surplus)).toLocaleString('en-IN')}.`;
  }

  // Helper for computing horizon at m months
  const computePoint = (m: number, label: string): ForecastHorizonPoint => {
    let projected_savings = current_savings;
    let projected_net_worth = current_net_worth;
    const projected_debt = Math.max(0, current_debt - monthly_emi * m);

    if (monthly_surplus > 0) {
      projected_savings = current_savings + monthly_surplus * m;
      projected_net_worth = projected_savings + current_investments + current_fd_principal - projected_debt;
    } else if (monthly_surplus < 0) {
      const totalDeficit = Math.abs(monthly_surplus) * m;
      projected_savings = Math.max(0, current_savings - totalDeficit);
      projected_net_worth = current_net_worth + monthly_surplus * m;
    } else {
      projected_savings = current_savings;
      projected_net_worth = projected_savings + current_investments + current_fd_principal - projected_debt;
    }

    return {
      months: m,
      label,
      savings: Math.round(projected_savings),
      net_worth: Math.round(projected_net_worth),
      debt: Math.round(projected_debt),
    };
  };

  const current = computePoint(0, 'Current');
  const m6 = computePoint(6, '6 Months');
  const m12 = computePoint(12, '12 Months');
  const m24 = computePoint(24, '24 Months');
  const m36 = computePoint(36, '36 Months');

  // Chart milestones: Now (0), 6M, 12M, 18M, 24M, 30M, 36M
  const chartMilestones = [
    { m: 0, label: 'Now', isForecast: false },
    { m: 6, label: '6M', isForecast: true },
    { m: 12, label: '12M', isForecast: true },
    { m: 18, label: '18M', isForecast: true },
    { m: 24, label: '24M', isForecast: true },
    { m: 30, label: '30M', isForecast: true },
    { m: 36, label: '36M', isForecast: true },
  ];

  const points: ForecastPoint[] = chartMilestones.map((ms) => {
    const pt = computePoint(ms.m, ms.label);
    return {
      month: ms.label,
      savings: pt.savings,
      net_worth: pt.net_worth,
      isForecast: ms.isForecast,
    };
  });

  const assumptions = [
    monthly_surplus > 0
      ? `Monthly surplus of ₹${Math.round(monthly_surplus).toLocaleString('en-IN')} is consistently added to liquid savings.`
      : monthly_surplus < 0
      ? `Monthly cash deficit of ₹${Math.round(Math.abs(monthly_surplus)).toLocaleString('en-IN')} drains existing liquidity.`
      : 'Cash flow is exactly balanced; no net accumulation or drain.',
    'Investments and fixed deposits are held at baseline recorded values with zero market speculation.',
    monthly_emi > 0
      ? `Active debt is amortized at the ongoing rate of ₹${Math.round(monthly_emi).toLocaleString('en-IN')}/month.`
      : 'No active debt liabilities are amortizing.',
  ];

  return {
    monthly_income,
    monthly_expenses,
    monthly_surplus,
    current_savings,
    current_investments,
    current_fd_principal,
    current_debt,
    current_net_worth,
    trajectory_type,
    trajectory_label,
    points,
    horizons: {
      current,
      m6,
      m12,
      m24,
      m36,
    },
    assumptions,
    next_month_expense_forecast: calculateNextMonthExpenseForecast(data.expenseRecords),
  };
}

// ============================================================
// Phase 11: Deterministic Expense Forecasting & Aggregation
// ============================================================

/**
 * Timezone-invariant extraction of calendar month (YYYY-MM) from an ISO date string (YYYY-MM-DD).
 * Avoids JavaScript `new Date()` shifts across negative UTC offset boundaries.
 */
export function getRecordMonth(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(0[1-9]|1[0-2])(-\d{2})?/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

/**
 * Returns the current local calendar month in 'YYYY-MM' format.
 */
export function getCurrentCalendarMonth(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Computes next calendar month in 'YYYY-MM' format (handles December -> January rollover).
 */
export function getNextCalendarMonth(monthStr: string): string {
  if (!monthStr || typeof monthStr !== 'string') return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return monthStr;
  month += 1;
  if (month > 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Computes previous calendar month in 'YYYY-MM' format (handles January -> December rollover).
 */
export function getPreviousCalendarMonth(monthStr: string): string {
  if (!monthStr || typeof monthStr !== 'string') return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return monthStr;
  month -= 1;
  if (month < 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Formats 'YYYY-MM' into human-readable month string (e.g., '2026-10' -> 'October 2026').
 */
export function formatMonthDisplay(monthStr: string): string {
  if (!monthStr || typeof monthStr !== 'string') return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${monthNames[monthIdx]} ${year}`;
  }
  return monthStr;
}

/**
 * Detects missing calendar months in an array of 'YYYY-MM' strings.
 */
export function detectMonthGaps(months: string[]): { hasGaps: boolean; missingMonths: string[] } {
  if (months.length <= 1) {
    return { hasGaps: false, missingMonths: [] };
  }
  const uniqueSorted = Array.from(new Set(months)).sort();
  const missingMonths: string[] = [];

  for (let i = 0; i < uniqueSorted.length - 1; i++) {
    const curr = uniqueSorted[i];
    const next = uniqueSorted[i + 1];
    let candidate = getNextCalendarMonth(curr);
    while (candidate && candidate < next) {
      missingMonths.push(candidate);
      candidate = getNextCalendarMonth(candidate);
    }
  }

  return {
    hasGaps: missingMonths.length > 0,
    missingMonths,
  };
}

/**
 * Aggregates expense records chronologically into monthly buckets.
 * - Filters out invalid dates, non-finite amounts, and negative expenses.
 * - Optionally excludes a specified month (e.g. the incomplete current month).
 * - Preserves category breakdowns and essential vs. discretionary sums.
 */
export function aggregateMonthlyExpenses(
  records: ExpenseRow[],
  options?: {
    excludeMonth?: string;
  }
): MonthlyExpenseAggregate[] {
  const monthMap = new Map<string, MonthlyExpenseAggregate>();

  for (const rec of records) {
    const month = getRecordMonth(rec.record_date);
    if (!month) continue; // Skip invalid or missing date
    if (options?.excludeMonth && month === options.excludeMonth) continue;

    const amount = Number(rec.amount);
    // Sanity check: must be finite and non-negative
    if (!Number.isFinite(amount) || amount < 0) continue;

    let agg = monthMap.get(month);
    if (!agg) {
      agg = {
        month,
        total: 0,
        essential: 0,
        discretionary: 0,
        recordCount: 0,
        categories: {},
      };
      monthMap.set(month, agg);
    }

    agg.total += amount;
    agg.recordCount += 1;
    if (rec.expense_type === 'essential') {
      agg.essential += amount;
    } else if (rec.expense_type === 'discretionary') {
      agg.discretionary += amount;
    }

    const cat = rec.category || 'Other';
    agg.categories[cat] = (agg.categories[cat] || 0) + amount;
  }

  // Sort chronological ascending (oldest to newest)
  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Step 8: Deterministic Next-Month Expense Forecasting Engine
 * Evaluates chronological monthly aggregates against candidate history tiers:
 * - Tier 0: < 3 completed months (run-rate fallback or insufficient history)
 * - Tier 1: 3 to 5 completed months (3-month SMA)
 * - Tier 2: 6 to 11 completed months (6-month EWMA alpha = 0.5)
 * - Tier 3: 12+ completed months (mature history reserved for future ML; 6M EWMA deterministic fallback)
 *
 * Missing-month & data eligibility safeguards:
 * - Incomplete current month is excluded from historical moving averages by default.
 * - Missing months are NOT fabricated as ₹0. Gaps are identified in data_limitations.
 * - Output is strictly non-negative.
 * - Zero database writes; pure deterministic calculation.
 */
export function calculateNextMonthExpenseForecast(
  records: ExpenseRow[],
  options?: {
    currentMonth?: string;
    excludeCurrentMonth?: boolean;
  }
): NextMonthExpenseForecastResult {
  const currentMonth = options?.currentMonth || getCurrentCalendarMonth();
  const excludeCurrent = options?.excludeCurrentMonth !== false; // default true

  // Aggregate completed historical months
  const completedAggregates = aggregateMonthlyExpenses(records, {
    excludeMonth: excludeCurrent ? currentMonth : undefined,
  });

  const usable_months = completedAggregates.map((a) => a.month);
  const N = usable_months.length;
  const target_month = getNextCalendarMonth(currentMonth);

  // Check for month gaps in history
  const { hasGaps, missingMonths } = detectMonthGaps(usable_months);

  const baseLimitations: string[] = [
    'Missing logging completeness indicator: an absent month does not confirm zero expenditure; only observed records are factored.',
    'Cash or untracked transactions outside the app are not captured.',
    'Forecast is a deterministic mathematical baseline, not a machine learning model.',
  ];

  if (hasGaps) {
    baseLimitations.unshift(
      `Historical record sequence contains ${missingMonths.length} unlogged month gap(s) (${missingMonths.join(', ')}). Averages are computed strictly across observed months.`
    );
  }

  // Tier 0: Insufficient History (< 3 usable completed months)
  if (N < 3) {
    if (N === 0) {
      // Check if current month has any expenses logged
      const currentMonthRecords = records.filter(
        (r) => getRecordMonth(r.record_date) === currentMonth && Number(r.amount) >= 0
      );
      const currentMonthLoggedTotal = currentMonthRecords.reduce((s, r) => s + Number(r.amount), 0);

      const limitations = [...baseLimitations];
      if (currentMonthRecords.length > 0) {
        limitations.unshift(
          `Current month (${currentMonth}) has ${currentMonthRecords.length} record(s) totaling ₹${Math.round(currentMonthLoggedTotal).toLocaleString('en-IN')}, but is still in progress and excluded from historical baseline.`
        );
      }

      return {
        tier: 'tier_0',
        method: 'insufficient_history',
        method_name: 'Insufficient History',
        estimated_amount: null,
        usable_months_count: 0,
        usable_months: [],
        target_month,
        is_supported: false,
        explanation:
          'Insufficient completed historical expense data. WealthIQ requires at least 1 completed month of recorded expenses to establish a run-rate estimate, and 3+ completed months for trend forecasting.',
        data_limitations: limitations,
        historical_aggregates: completedAggregates,
      };
    }

    // 1 or 2 completed months available: Run-rate fallback
    const totalSum = completedAggregates.reduce((s, a) => s + a.total, 0);
    const runRate = totalSum / N;
    const estimated_amount = Math.max(0, Math.round(runRate));

    const limitations = [
      `Only ${N} completed month(s) of history observed (${usable_months.join(', ')}). Minimum 3 completed months required for moving-average trend forecasting.`,
      ...baseLimitations,
    ];

    return {
      tier: 'tier_0',
      method: 'run_rate_fallback',
      method_name: 'Deterministic Run-Rate Fallback',
      estimated_amount,
      usable_months_count: N,
      usable_months,
      target_month,
      is_supported: false,
      explanation: `Deterministic run-rate baseline calculated as the average across ${N} completed month(s) (₹${estimated_amount.toLocaleString('en-IN')}/mo). Not a validated trend forecast.`,
      data_limitations: limitations,
      historical_aggregates: completedAggregates,
    };
  }

  // Tier 1: 3 to 5 usable completed months (3M SMA)
  if (N >= 3 && N <= 5) {
    const recent3 = completedAggregates.slice(-3);
    const sma3 = recent3.reduce((s, a) => s + a.total, 0) / 3;
    const estimated_amount = Math.max(0, Math.round(sma3));

    return {
      tier: 'tier_1',
      method: '3m_simple_moving_average',
      method_name: '3-Month Simple Moving Average (SMA)',
      estimated_amount,
      usable_months_count: N,
      usable_months,
      target_month,
      is_supported: true,
      explanation: `Calculated as the unweighted 3-month simple moving average across the 3 most recent completed months (${recent3.map((a) => a.month).join(', ')}).`,
      data_limitations: baseLimitations,
      historical_aggregates: completedAggregates,
    };
  }

  // Tier 2: 6 to 11 usable completed months (6M EWMA alpha = 0.5)
  if (N >= 6 && N <= 11) {
    const recent6 = completedAggregates.slice(-6);
    const subset = recent6.map((a) => a.total);
    let ewma = subset[0];
    const alpha = 0.5;
    for (let i = 1; i < subset.length; i++) {
      ewma = alpha * subset[i] + (1.0 - alpha) * ewma;
    }
    const estimated_amount = Math.max(0, Math.round(ewma));

    return {
      tier: 'tier_2',
      method: '6m_exponential_weighted_moving_average',
      method_name: '6-Month Exponentially Weighted Moving Average (EWMA)',
      estimated_amount,
      usable_months_count: N,
      usable_months,
      target_month,
      is_supported: true,
      explanation: `Calculated using a 6-month exponentially weighted moving average (alpha = 0.5) weighting recent months higher across (${recent6.map((a) => a.month).join(', ')}).`,
      data_limitations: baseLimitations,
      historical_aggregates: completedAggregates,
    };
  }

  // Tier 3: 12 or more months (Mature history - ML dormant, deterministic fallback)
  const recent6 = completedAggregates.slice(-6);
  const subset = recent6.map((a) => a.total);
  let ewma = subset[0];
  const alpha = 0.5;
  for (let i = 1; i < subset.length; i++) {
    ewma = alpha * subset[i] + (1.0 - alpha) * ewma;
  }
  const estimated_amount = Math.max(0, Math.round(ewma));

  const tier3Limitations = [
    `User has ${N} completed months of recorded history, qualifying for future model-selection and walk-forward backtesting experiments.`,
    'No machine learning model is currently active in this phase; deterministic 6M EWMA fallback is utilized.',
    ...baseLimitations,
  ];

  return {
    tier: 'tier_3',
    method: 'deterministic_fallback_mature',
    method_name: 'Deterministic Fallback (12+ Months Mature History)',
    estimated_amount,
    usable_months_count: N,
    usable_months,
    target_month,
    is_supported: true,
    explanation: `History depth (${N} months) qualifies for future model-selection experiments. Machine learning is currently dormant; deterministic 6-month EWMA fallback is applied.`,
    data_limitations: tier3Limitations,
    historical_aggregates: completedAggregates,
  };
}
