// ============================================================
// MOCK DATA — Phase 1 placeholder
// ============================================================
// IMPORTANT: This data is clearly marked mock UI data for Phase 1.
// It will be replaced by real API responses from the FastAPI
// backend and Supabase in later phases.
// Do NOT treat these values as real financial analysis.
// ============================================================

import type {
  FinancialScore,
  ScoreBreakdown,
  FinancialHistoryPoint,
  ForecastPoint,
  ExpenseChartData,
  NetWorthChartData,
  MarketInsight,
  FDRate,
  FinancialFeatures,
  UserProfile,
  ExpenseRecord,
  DebtRecord,
  InvestmentRecord,
  FixedDepositRecord,
  SavingsRecord,
  IncomeRecord,
} from './types';

export const MOCK_PROFILE: UserProfile = {
  id: 'mock-profile-1',
  user_id: 'mock-user-1',
  full_name: 'Demo User',
  age: 28,
  country: 'India',
  employment_type: 'full-time',
  income_stability: 'stable',
  financial_goal: 'Build emergency fund and start investing',
  risk_tolerance: 'moderate',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const MOCK_FEATURES: FinancialFeatures = {
  monthly_income: 85000,
  monthly_expenses: 52000,
  essential_expenses: 38000,
  discretionary_expenses: 14000,
  current_savings: 120000,
  emergency_fund: 95000,
  total_debt: 320000,
  monthly_emi: 14500,
  investment_value: 85000,
  fd_value: 150000,
  savings_rate: 0.388,
  expense_ratio: 0.612,
  discretionary_expense_ratio: 0.165,
  debt_to_income: 0.171,
  emergency_fund_months: 2.5,
  net_worth: 235000,
};

export const MOCK_SCORE: FinancialScore = {
  id: 'mock-score-1',
  user_id: 'mock-user-1',
  health_score: 68,
  health_category: 'Moderate',
  spending_risk: 'Medium',
  savings_rate: 0.388,
  expense_ratio: 0.612,
  debt_to_income: 0.171,
  emergency_fund_months: 2.5,
  model_version: 'mock-v0.1',
  created_at: new Date().toISOString(),
};

export const MOCK_SCORE_BREAKDOWN: ScoreBreakdown = {
  savings_score: 72,
  expense_score: 58,
  debt_score: 75,
  emergency_score: 42,
  investment_score: 65,
  income_score: 80,
  health_score: 68,
  health_category: 'Moderate',
};



export const MOCK_HISTORY: FinancialHistoryPoint[] = [
  { id: 'h1', user_id: 'mock-user-1', month: 'Jan', income: 82000, expenses: 55000, savings: 27000, debt: 350000, investments: 70000, fd_value: 140000, net_worth: 187000, created_at: '' },
  { id: 'h2', user_id: 'mock-user-1', month: 'Feb', income: 83000, expenses: 53000, savings: 30000, debt: 345000, investments: 73000, fd_value: 142000, net_worth: 200000, created_at: '' },
  { id: 'h3', user_id: 'mock-user-1', month: 'Mar', income: 85000, expenses: 51000, savings: 34000, debt: 340000, investments: 76000, fd_value: 144000, net_worth: 214000, created_at: '' },
  { id: 'h4', user_id: 'mock-user-1', month: 'Apr', income: 85000, expenses: 54000, savings: 31000, debt: 335000, investments: 78000, fd_value: 146000, net_worth: 221000, created_at: '' },
  { id: 'h5', user_id: 'mock-user-1', month: 'May', income: 86000, expenses: 50000, savings: 36000, debt: 330000, investments: 81000, fd_value: 147000, net_worth: 228000, created_at: '' },
  { id: 'h6', user_id: 'mock-user-1', month: 'Jun', income: 85000, expenses: 52000, savings: 33000, debt: 325000, investments: 83000, fd_value: 149000, net_worth: 232000, created_at: '' },
  { id: 'h7', user_id: 'mock-user-1', month: 'Jul', income: 87000, expenses: 49000, savings: 38000, debt: 320000, investments: 85000, fd_value: 150000, net_worth: 235000, created_at: '' },
];

export const MOCK_FORECAST: ForecastPoint[] = [
  ...MOCK_HISTORY.map((h) => ({
    month: h.month,
    savings: h.savings,
    net_worth: h.net_worth,
    isForecast: false,
  })),
  { month: 'Aug', savings: 35000, net_worth: 248000, isForecast: true },
  { month: 'Sep', savings: 36000, net_worth: 262000, isForecast: true },
  { month: 'Oct', savings: 37000, net_worth: 276000, isForecast: true },
  { month: 'Nov', savings: 38000, net_worth: 291000, isForecast: true },
  { month: 'Dec', savings: 39000, net_worth: 306000, isForecast: true },
];

export const MOCK_EXPENSE_CHART: ExpenseChartData[] = [
  { category: 'Housing', amount: 18000, type: 'essential' },
  { category: 'Food', amount: 12000, type: 'essential' },
  { category: 'Transportation', amount: 5000, type: 'essential' },
  { category: 'Utilities', amount: 3000, type: 'essential' },
  { category: 'Healthcare', amount: 2000, type: 'essential' },
  { category: 'Education', amount: 3000, type: 'essential' },
  { category: 'Entertainment', amount: 6000, type: 'discretionary' },
  { category: 'Shopping', amount: 5000, type: 'discretionary' },
  { category: 'Other', amount: 3000, type: 'discretionary' },
];

export const MOCK_NET_WORTH_CHART: NetWorthChartData[] = MOCK_HISTORY.map((h) => ({
  month: h.month,
  net_worth: h.net_worth,
  savings: h.savings,
  investments: h.investments,
  fd: h.fd_value,
  debt: h.debt,
}));

export const MOCK_MARKET_INSIGHTS: MarketInsight[] = [
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    current_price: 2890,
    week_52_high: 3100,
    week_52_low: 2220,
    daily_change: 45,
    daily_change_percent: 1.58,
    volume: 8500000,
    distance_from_52w_high: 6.77,
    distance_category: 'Very Near 52W High',
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    current_price: 3650,
    week_52_high: 4150,
    week_52_low: 3100,
    daily_change: -30,
    daily_change_percent: -0.82,
    volume: 3200000,
    distance_from_52w_high: 12.05,
    distance_category: 'Near 52W High',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank',
    current_price: 1520,
    week_52_high: 1800,
    week_52_low: 1360,
    daily_change: 12,
    daily_change_percent: 0.79,
    volume: 5400000,
    distance_from_52w_high: 15.56,
    distance_category: 'Moderate Distance',
  },
  {
    symbol: 'INFY',
    name: 'Infosys',
    current_price: 1480,
    week_52_high: 1950,
    week_52_low: 1350,
    daily_change: -18,
    daily_change_percent: -1.20,
    volume: 4100000,
    distance_from_52w_high: 24.10,
    distance_category: 'Far From 52W High',
  },
];

export const MOCK_FD_RATES: FDRate[] = [
  {
    bank_name: 'SBI',
    tenure_months: 12,
    regular_interest_rate: 6.25,
    senior_citizen_interest_rate: 6.75,
    minimum_amount: 1000,
    premature_withdrawal_notes: '0.50% penalty up to ₹5L; 1.00% above ₹5L on applicable card rate',
    last_updated: '2026-10-10',
    effective_date: '2025-12-15 (Current in Oct 2026)',
    source_url: 'https://sbi.bank.in/web/interest-rates/deposit-rates/retail-domestic-term-deposits',
    deposit_limit: 'Retail (< ₹3 Crore)',
    compounding_notes: 'Quarterly compounding on cumulative reinvestment deposits',
  },
  {
    bank_name: 'HDFC',
    tenure_months: 12,
    regular_interest_rate: 6.25,
    senior_citizen_interest_rate: 6.75,
    minimum_amount: 5000,
    premature_withdrawal_notes: '1.00% penalty on applicable rate. Senior citizen benefit applies to domestic deposits',
    last_updated: '2026-10-10',
    effective_date: '2026-08-19 (Current in Oct 2026)',
    source_url: 'https://www.hdfc.bank.in/fixed-deposit/fd-interest-rate',
    deposit_limit: 'Retail (< ₹3 Crore)',
    compounding_notes: 'Quarterly compounding for cumulative deposits',
  },
  {
    bank_name: 'ICICI',
    tenure_months: 12,
    regular_interest_rate: 6.25,
    senior_citizen_interest_rate: 6.75,
    minimum_amount: 10000,
    premature_withdrawal_notes: '0.50% penalty for < 1 yr; 1.00% penalty for >= 1 yr on contracted rate',
    last_updated: '2026-10-10',
    effective_date: '2026-10-09 (Current in Oct 2026)',
    source_url: 'https://www.icici.bank.in/personal-banking/deposits/fixed-deposit/fd-interest-rates',
    deposit_limit: 'Retail (< ₹3 Crore)',
    compounding_notes: 'Quarterly compounding on cumulative deposits',
  },
  {
    bank_name: 'RBL',
    tenure_months: 12,
    regular_interest_rate: 7.40,
    senior_citizen_interest_rate: 8.00,
    minimum_amount: 1000,
    premature_withdrawal_notes: '1.00% penalty on applicable rate. Senior citizens (+0.50%) and Super Senior (+0.75%) applicable',
    last_updated: '2026-10-10',
    effective_date: '2026-10-01 (Current in Oct 2026)',
    source_url: 'https://www.rbl.bank.in/interest-rates?tab=fixed-deposit',
    deposit_limit: 'Retail (< ₹3 Crore)',
    compounding_notes: 'Quarterly compounding for >= 181 days; simple interest for < 181 days',
  },
];

export const MOCK_INCOME_RECORDS: IncomeRecord[] = [
  { id: 'inc-1', user_id: 'mock-user-1', amount: 85000, income_type: 'Salary', record_date: '2024-07-01', created_at: '' },
  { id: 'inc-2', user_id: 'mock-user-1', amount: 5000, income_type: 'Freelance', record_date: '2024-07-15', created_at: '' },
];

export const MOCK_EXPENSE_RECORDS: ExpenseRecord[] = [
  { id: 'exp-1', user_id: 'mock-user-1', category: 'Housing', amount: 18000, expense_type: 'essential', record_date: '2024-07-01', description: 'Rent', created_at: '' },
  { id: 'exp-2', user_id: 'mock-user-1', category: 'Food', amount: 12000, expense_type: 'essential', record_date: '2024-07-01', description: 'Groceries and dining', created_at: '' },
  { id: 'exp-3', user_id: 'mock-user-1', category: 'Entertainment', amount: 6000, expense_type: 'discretionary', record_date: '2024-07-01', description: 'Streaming and outings', created_at: '' },
  { id: 'exp-4', user_id: 'mock-user-1', category: 'Shopping', amount: 5000, expense_type: 'discretionary', record_date: '2024-07-01', description: 'Clothing and accessories', created_at: '' },
];

export const MOCK_SAVINGS_RECORDS: SavingsRecord[] = [
  { id: 'sav-1', user_id: 'mock-user-1', amount: 120000, record_date: '2024-07-01', savings_type: 'Total Savings', created_at: '' },
  { id: 'sav-2', user_id: 'mock-user-1', amount: 95000, record_date: '2024-07-01', savings_type: 'Emergency Fund', created_at: '' },
];

export const MOCK_DEBT_RECORDS: DebtRecord[] = [
  { id: 'debt-1', user_id: 'mock-user-1', debt_type: 'Home Loan', original_principal: 2500000, remaining_balance: 280000, interest_rate: 8.5, monthly_emi: 12000, remaining_months: 28, created_at: '', updated_at: '' },
  { id: 'debt-2', user_id: 'mock-user-1', debt_type: 'Car Loan', original_principal: 500000, remaining_balance: 40000, interest_rate: 9.2, monthly_emi: 2500, remaining_months: 18, created_at: '', updated_at: '' },
];

export const MOCK_INVESTMENT_RECORDS: InvestmentRecord[] = [
  { id: 'inv-1', user_id: 'mock-user-1', asset_type: 'Stock', symbol: 'RELIANCE', quantity: 20, purchase_price: 2400, current_value: 58000, created_at: '', updated_at: '' },
  { id: 'inv-2', user_id: 'mock-user-1', asset_type: 'Mutual Fund', symbol: 'SIP-GROWTH', quantity: 1, purchase_price: 20000, current_value: 27000, created_at: '', updated_at: '' },
];

export const MOCK_FD_RECORDS: FixedDepositRecord[] = [
  { id: 'fd-1', user_id: 'mock-user-1', bank_name: 'HDFC', principal: 100000, interest_rate: 7.0, tenure_months: 12, start_date: '2024-01-01', maturity_date: '2025-01-01', senior_citizen: false, created_at: '' },
  { id: 'fd-2', user_id: 'mock-user-1', bank_name: 'SBI', principal: 50000, interest_rate: 6.8, tenure_months: 6, start_date: '2024-03-01', maturity_date: '2024-09-01', senior_citizen: false, created_at: '' },
];
