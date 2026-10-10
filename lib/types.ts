// ============================================================
// WealthIQ Type Definitions
// Phase 1 — UI foundation types (mock data layer)
// These types will later be used to shape real API responses.
// ============================================================

export type HealthCategory = 'Critical' | 'Weak' | 'Moderate' | 'Healthy' | 'Excellent';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type ExpenseType = 'essential' | 'discretionary';
export type IncomeStability = 'stable' | 'variable' | 'seasonal' | 'freelance';
export type EmploymentType = 'full-time' | 'part-time' | 'self-employed' | 'student' | 'retired' | 'unemployed';
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

// --- Profile ---

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  age: number;
  country: string;
  employment_type: EmploymentType;
  income_stability: IncomeStability;
  financial_goal: string;
  risk_tolerance: RiskTolerance;
  created_at: string;
  updated_at: string;
}

// --- Financial records ---

export interface IncomeRecord {
  id: string;
  user_id: string;
  amount: number;
  income_type: string;
  record_date: string;
  created_at: string;
}

export interface ExpenseRecord {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  expense_type: ExpenseType;
  record_date: string;
  description?: string;
  created_at: string;
}

export interface SavingsRecord {
  id: string;
  user_id: string;
  amount: number;
  record_date: string;
  savings_type: string;
  created_at: string;
}

export interface DebtRecord {
  id: string;
  user_id: string;
  debt_type: string;
  original_principal: number;
  remaining_balance: number;
  interest_rate: number;
  monthly_emi: number;
  remaining_months: number;
  created_at: string;
  updated_at: string;
}

export interface InvestmentRecord {
  id: string;
  user_id: string;
  asset_type: string;
  symbol: string;
  quantity: number;
  purchase_price: number;
  current_value: number;
  created_at: string;
  updated_at: string;
}

export interface FixedDepositRecord {
  id: string;
  user_id: string;
  bank_name: string;
  principal: number;
  interest_rate: number;
  tenure_months: number;
  start_date: string;
  maturity_date: string;
  senior_citizen: boolean;
  created_at: string;
}

// --- Engineered features (computed in Phase 3, mocked in Phase 1) ---

export interface FinancialFeatures {
  monthly_income: number;
  monthly_expenses: number;
  essential_expenses: number;
  discretionary_expenses: number;
  current_savings: number;
  emergency_fund: number;
  total_debt: number;
  monthly_emi: number;
  investment_value: number;
  fd_value: number;
  savings_rate: number;
  expense_ratio: number;
  discretionary_expense_ratio: number;
  debt_to_income: number;
  emergency_fund_months: number;
  net_worth: number;
}

// --- Scores (Phase 9 engine, mocked in Phase 1) ---

export interface FinancialScore {
  id: string;
  user_id: string;
  health_score: number;
  health_category: HealthCategory;
  spending_risk: RiskLevel;
  savings_rate: number;
  expense_ratio: number;
  debt_to_income: number;
  emergency_fund_months: number;
  model_version: string;
  created_at: string;
}

export interface ScoreBreakdown {
  savings_score: number;
  expense_score: number;
  debt_score: number;
  emergency_score: number;
  investment_score: number;
  income_score: number;
  health_score: number;
  health_category: HealthCategory;
}


// --- Financial history (Phase 8 forecast, mocked in Phase 1) ---

export interface FinancialHistoryPoint {
  id: string;
  user_id: string;
  month: string;
  income: number;
  expenses: number;
  savings: number;
  debt: number;
  investments: number;
  fd_value: number;
  net_worth: number;
  created_at: string;
}

export interface ForecastPoint {
  month: string;
  savings: number | null;
  net_worth: number | null;
  isForecast?: boolean;
}

// --- Market insights (Phase 12, mocked in Phase 1) ---

export type DistanceCategory =
  | 'Very Near 52W High'
  | 'Near 52W High'
  | 'Moderate Distance'
  | 'Far From 52W High';

export interface MarketInsight {
  symbol: string;
  name: string;
  current_price: number;
  week_52_high: number;
  week_52_low: number;
  daily_change: number;
  daily_change_percent: number;
  volume: number;
  distance_from_52w_high: number;
  distance_category: DistanceCategory;
}

// --- FD comparison (Phase 11, mocked in Phase 1) ---

export interface FDRate {
  bank_name: string;
  tenure_months: number;
  regular_interest_rate: number;
  senior_citizen_interest_rate: number;
  minimum_amount: number;
  premature_withdrawal_notes: string;
  last_updated: string;
  source_url?: string;
  effective_date?: string;
  deposit_limit?: string;
  compounding_notes?: string;
}

export interface FDComparisonResult {
  bank_name: string;
  tenure_months: number;
  interest_rate: number;
  maturity_value: number;
  interest_earned: number;
  is_best_match: boolean;
  last_updated: string;
}

// --- Chart data ---

export interface ExpenseChartData {
  category: string;
  amount: number;
  type: ExpenseType;
}

export interface NetWorthChartData {
  month: string;
  net_worth: number;
  savings: number;
  investments: number;
  fd: number;
  debt: number;
}
