// ============================================================
// WealthIQ OLAP Analytics Engine
// Multi-Dimensional Financial Analysis, Two-Cube Constellation,
// Roll-up, Drill-down, Slice, Dice & Cross-Tab Pivot Engine
// ============================================================

import type { Database } from '@/lib/supabase/types';

export type IncomeRow = Database['public']['Tables']['income_records']['Row'];
export type ExpenseRow = Database['public']['Tables']['expense_records']['Row'];
export type SavingsRow = Database['public']['Tables']['savings_records']['Row'];
export type FinancialHistoryRow = Database['public']['Tables']['financial_history']['Row'];
export type DebtRow = Database['public']['Tables']['debts']['Row'];
export type InvestmentRow = Database['public']['Tables']['investments']['Row'];
export type FDRow = Database['public']['Tables']['fixed_deposits']['Row'];

// --- OLAP Dimension Types ---
export type OlapActivity = 'INCOME' | 'EXPENSE' | 'SAVINGS_CONTRIBUTION';
export type OlapExpenseType = 'essential' | 'discretionary' | 'not_applicable';
export type OlapTimeGrain = 'day' | 'month' | 'quarter' | 'year';

export type OlapDimensionKey =
  | 'time'
  | 'activity'
  | 'category'
  | 'expense_type'
  | 'income_type';

export type OlapPivotDimension =
  | 'category'
  | 'activity'
  | 'expense_type'
  | 'income_type'
  | 'month'
  | 'quarter'
  | 'year'
  | 'day';

export type OlapMeasureKey =
  | 'total_income'
  | 'total_expenses'
  | 'net_cash_flow'
  | 'transaction_count'
  | 'avg_amount';

// --- Canonical Fact Grain 1: Transaction Fact ---
export interface OlapTransactionFact {
  id: string;
  user_id: string;
  activity: OlapActivity;
  category: string;
  expense_type: OlapExpenseType;
  income_type: string;
  amount: number;
  record_date: string; // 'YYYY-MM-DD'
  day: string; // 'YYYY-MM-DD'
  month: string; // 'YYYY-MM'
  quarter: string; // 'YYYY-Q#'
  year: number;
  description?: string | null;
  created_at?: string;
}

// --- Canonical Fact Grain 2: Monthly Financial Snapshot Fact ---
export interface OlapSnapshotFact {
  id: string;
  user_id: string;
  month: string; // 'YYYY-MM'
  year: number;
  quarter: string;
  income: number;
  expenses: number;
  savings: number;
  debt: number;
  investments: number;
  fd_value: number;
  net_worth: number;
  created_at?: string;
  isAuthenticSnapshot: boolean;
}

// --- Measure Aggregates ---
export interface OlapCubeMeasures {
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  transaction_count: number;
  avg_amount: number;
}

export interface OlapAggregateRow {
  key: string;
  label: string;
  dimension: string;
  dimensionValue: string | number;
  measures: OlapCubeMeasures;
  factsCount: number;
}

export interface OlapSliceFilter {
  dimension: OlapPivotDimension;
  value: string | number;
}

export interface OlapDiceCriteria {
  dateRange?: {
    start?: string; // 'YYYY-MM-DD'
    end?: string; // 'YYYY-MM-DD'
  };
  activities?: OlapActivity[];
  categories?: string[];
  expenseTypes?: ('essential' | 'discretionary')[];
  incomeTypes?: string[];
}

export interface OlapPivotResult {
  rowDimension: OlapPivotDimension;
  columnDimension: OlapPivotDimension;
  measure: OlapMeasureKey;
  rows: string[];
  columns: string[];
  matrix: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

export interface OlapReconciliation {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  isReconciled: boolean;
  discrepancy: number;
  verificationNotes: string[];
}

// ============================================================
// 1. Timezone-Safe Temporal Extraction Utilities
// ============================================================

export function extractDateParts(dateStr: string | null | undefined): {
  day: string;
  month: string;
  quarter: string;
  year: number;
} | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(0[1-9]|1[0-2])(-(\d{2}))?/);
  if (!match) return null;

  const yearNum = parseInt(match[1], 10);
  const monthNum = parseInt(match[2], 10);
  const dayStr = match[4] ? `${match[1]}-${match[2]}-${match[4]}` : `${match[1]}-${match[2]}-01`;
  const monthStr = `${match[1]}-${match[2]}`;
  const quarterNum = Math.ceil(monthNum / 3);
  const quarterStr = `${yearNum}-Q${quarterNum}`;

  return {
    day: dayStr,
    month: monthStr,
    quarter: quarterStr,
    year: yearNum,
  };
}

export function formatTimeLabel(grain: OlapTimeGrain, value: string | number): string {
  const str = String(value);
  if (grain === 'year') return `FY ${str}`;
  if (grain === 'quarter') {
    const parts = str.split('-Q');
    if (parts.length === 2) return `Q${parts[1]} ${parts[0]}`;
    return str;
  }
  if (grain === 'month') {
    const parts = str.split('-');
    if (parts.length === 2) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${monthNames[monthIdx]} ${parts[0]}`;
      }
    }
    return str;
  }
  return str;
}

// ============================================================
// 2. Fact Table Builders (Two-Cube Isolation)
// ============================================================

/**
 * Builds the canonical Cashflow Transactions Cube facts from raw records.
 *
 * Strict Rules Applied:
 * 1. Cumulative savings records (e.g. 'Total Savings', 'Emergency Fund') represent
 *    static account balances (STOCKS), NOT additive cash flow movements. They are
 *    STRICTLY EXCLUDED from the Transaction Flow Cube to prevent double-counting.
 * 2. Only explicit contribution records (e.g. 'Monthly Savings') can be treated as flows.
 * 3. Amount values are sanitized to non-negative finite numbers.
 */
export function buildTransactionFacts(
  incomeRecords: IncomeRow[] = [],
  expenseRecords: ExpenseRow[] = [],
  savingsRecords: SavingsRow[] = []
): OlapTransactionFact[] {
  const facts: OlapTransactionFact[] = [];

  // Inflow Facts
  for (const inc of incomeRecords) {
    const amount = Number(inc.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const parts = extractDateParts(inc.record_date);
    if (!parts) continue;

    facts.push({
      id: inc.id,
      user_id: inc.user_id,
      activity: 'INCOME',
      category: inc.income_type || 'Salary',
      expense_type: 'not_applicable',
      income_type: inc.income_type || 'Salary',
      amount: Math.round(amount * 100) / 100,
      record_date: parts.day,
      day: parts.day,
      month: parts.month,
      quarter: parts.quarter,
      year: parts.year,
      description: null,
      created_at: inc.created_at,
    });
  }

  // Outflow Facts
  for (const exp of expenseRecords) {
    const amount = Number(exp.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const parts = extractDateParts(exp.record_date);
    if (!parts) continue;

    facts.push({
      id: exp.id,
      user_id: exp.user_id,
      activity: 'EXPENSE',
      category: exp.category || 'Other',
      expense_type: exp.expense_type === 'essential' ? 'essential' : 'discretionary',
      income_type: 'not_applicable',
      amount: Math.round(amount * 100) / 100,
      record_date: parts.day,
      day: parts.day,
      month: parts.month,
      quarter: parts.quarter,
      year: parts.year,
      description: exp.description || null,
      created_at: exp.created_at,
    });
  }

  // Flow Savings Contributions (Strictly excluding cumulative balances like 'Total Savings')
  for (const sav of savingsRecords) {
    const type = (sav.savings_type || '').trim();
    // Exclude cumulative balances (Total Savings, Emergency Fund, etc.)
    if (type === 'Total Savings' || type === 'Emergency Fund') {
      continue;
    }

    // Only recognize verified monthly/goal periodic contributions
    if (type === 'Monthly Savings' || type === 'Goal Savings') {
      const amount = Number(sav.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const parts = extractDateParts(sav.record_date);
      if (!parts) continue;

      facts.push({
        id: sav.id,
        user_id: sav.user_id,
        activity: 'SAVINGS_CONTRIBUTION',
        category: `Savings (${type})`,
        expense_type: 'essential',
        income_type: 'not_applicable',
        amount: Math.round(amount * 100) / 100,
        record_date: parts.day,
        day: parts.day,
        month: parts.month,
        quarter: parts.quarter,
        year: parts.year,
        description: `Savings allocation: ${type}`,
        created_at: sav.created_at,
      });
    }
  }

  // Chronological sort: newest first
  return facts.sort((a, b) => b.record_date.localeCompare(a.record_date));
}

/**
 * Builds the canonical Monthly Financial Snapshot Cube facts.
 *
 * Strict Rule Applied:
 * - NEVER backfill or fabricate previous months with current financial numbers.
 * - Only genuine rows present in `financial_history` are parsed.
 */
export function buildSnapshotFacts(
  historyRows: FinancialHistoryRow[] = []
): OlapSnapshotFact[] {
  const monthMap = new Map<string, OlapSnapshotFact>();

  // Sort chronological by created_at so newest snapshot for a given month takes precedence
  const sortedRows = [...historyRows].sort((a, b) =>
    (a.created_at || '').localeCompare(b.created_at || '')
  );

  for (const row of sortedRows) {
    const parts = extractDateParts(row.month);
    if (!parts) continue;

    monthMap.set(parts.month, {
      id: row.id,
      user_id: row.user_id,
      month: parts.month,
      year: parts.year,
      quarter: parts.quarter,
      income: Number(row.income || 0),
      expenses: Number(row.expenses || 0),
      savings: Number(row.savings || 0),
      debt: Number(row.debt || 0),
      investments: Number(row.investments || 0),
      fd_value: Number(row.fd_value || 0),
      net_worth: Number(row.net_worth || 0),
      created_at: row.created_at,
      isAuthenticSnapshot: true,
    });
  }

  // Sort chronological ascending (oldest to newest for trajectory)
  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

// ============================================================
// 3. Measure Computation & Mathematical Reconciliation
// ============================================================

export function calculateMeasures(facts: OlapTransactionFact[]): OlapCubeMeasures {
  let total_income = 0;
  let total_expenses = 0;
  let total_savings_contributions = 0;

  for (const fact of facts) {
    if (fact.activity === 'INCOME') {
      total_income += fact.amount;
    } else if (fact.activity === 'EXPENSE') {
      total_expenses += fact.amount;
    } else if (fact.activity === 'SAVINGS_CONTRIBUTION') {
      total_savings_contributions += fact.amount;
    }
  }

  const transaction_count = facts.length;
  const net_cash_flow = total_income - total_expenses;
  const total_flow_volume = total_income + total_expenses + total_savings_contributions;
  const avg_amount = transaction_count > 0 ? total_flow_volume / transaction_count : 0;

  return {
    total_income: Math.round(total_income * 100) / 100,
    total_expenses: Math.round(total_expenses * 100) / 100,
    net_cash_flow: Math.round(net_cash_flow * 100) / 100,
    transaction_count,
    avg_amount: Math.round(avg_amount * 100) / 100,
  };
}

export function reconcileOlapTotals(
  rawIncome: IncomeRow[],
  rawExpenses: ExpenseRow[],
  facts: OlapTransactionFact[]
): OlapReconciliation {
  const verifiedRawIncome = rawIncome.reduce(
    (sum, r) =>
      sum +
      (Number.isFinite(Number(r.amount)) && Number(r.amount) > 0 && extractDateParts(r.record_date)
        ? Number(r.amount)
        : 0),
    0
  );
  const verifiedRawExpenses = rawExpenses.reduce(
    (sum, r) =>
      sum +
      (Number.isFinite(Number(r.amount)) && Number(r.amount) > 0 && extractDateParts(r.record_date)
        ? Number(r.amount)
        : 0),
    0
  );

  const measures = calculateMeasures(facts);
  const incomeDiff = Math.abs(measures.total_income - verifiedRawIncome);
  const expenseDiff = Math.abs(measures.total_expenses - verifiedRawExpenses);
  const discrepancy = Math.max(incomeDiff, expenseDiff);

  const isReconciled = discrepancy < 0.01;
  const verificationNotes: string[] = [];

  if (isReconciled) {
    verificationNotes.push('Income and expense measures match raw database records with ₹0.00 discrepancy.');
    verificationNotes.push(`Net Cash Flow reconciled: ₹${measures.total_income.toLocaleString('en-IN')} - ₹${measures.total_expenses.toLocaleString('en-IN')} = ₹${measures.net_cash_flow.toLocaleString('en-IN')}`);
  } else {
    verificationNotes.push(`Reconciliation variance detected: Income diff = ₹${incomeDiff}, Expense diff = ₹${expenseDiff}`);
  }

  return {
    totalIncome: measures.total_income,
    totalExpenses: measures.total_expenses,
    netCashFlow: measures.net_cash_flow,
    transactionCount: measures.transaction_count,
    incomeCount: rawIncome.length,
    expenseCount: rawExpenses.length,
    isReconciled,
    discrepancy,
    verificationNotes,
  };
}

// ============================================================
// 4. OLAP Operations: Roll-up, Drill-down, Slice, Dice, Pivot
// ============================================================

/**
 * Roll-up: Groups transaction facts by a specified Time Grain.
 * Aggregates Day -> Month -> Quarter -> Year.
 */
export function rollupOlap(
  facts: OlapTransactionFact[],
  grain: OlapTimeGrain
): OlapAggregateRow[] {
  const bucketMap = new Map<string, OlapTransactionFact[]>();

  for (const fact of facts) {
    let key: string;
    if (grain === 'year') key = String(fact.year);
    else if (grain === 'quarter') key = fact.quarter;
    else if (grain === 'month') key = fact.month;
    else key = fact.day;

    let bucket = bucketMap.get(key);
    if (!bucket) {
      bucket = [];
      bucketMap.set(key, bucket);
    }
    bucket.push(fact);
  }

  const rows: OlapAggregateRow[] = [];
  Array.from(bucketMap.entries()).forEach(([key, bucketFacts]) => {
    const measures = calculateMeasures(bucketFacts);
    rows.push({
      key,
      label: formatTimeLabel(grain, key),
      dimension: grain,
      dimensionValue: key,
      measures,
      factsCount: bucketFacts.length,
    });
  });

  // Sort chronological ascending
  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Drill-down: Drills down from a parent time coordinate into a secondary dimension
 * (e.g. Month '2026-10' -> Breakdown by Category or Expense Type).
 */
export function drilldownOlap(
  facts: OlapTransactionFact[],
  timeFilter: { grain: OlapTimeGrain; value: string | number },
  secondaryDimension: 'category' | 'expense_type' | 'activity' | 'income_type'
): OlapAggregateRow[] {
  const filtered = facts.filter((f) => {
    if (timeFilter.grain === 'year') return String(f.year) === String(timeFilter.value);
    if (timeFilter.grain === 'quarter') return f.quarter === String(timeFilter.value);
    if (timeFilter.grain === 'month') return f.month === String(timeFilter.value);
    return f.day === String(timeFilter.value);
  });

  const bucketMap = new Map<string, OlapTransactionFact[]>();
  for (const fact of filtered) {
    const key = String(fact[secondaryDimension] || 'Other');
    let bucket = bucketMap.get(key);
    if (!bucket) {
      bucket = [];
      bucketMap.set(key, bucket);
    }
    bucket.push(fact);
  }

  const rows: OlapAggregateRow[] = [];
  Array.from(bucketMap.entries()).forEach(([key, bucketFacts]) => {
    const measures = calculateMeasures(bucketFacts);
    rows.push({
      key,
      label: key,
      dimension: secondaryDimension,
      dimensionValue: key,
      measures,
      factsCount: bucketFacts.length,
    });
  });

  // Sort by highest expense descending
  return rows.sort((a, b) => b.measures.total_expenses - a.measures.total_expenses);
}

/**
 * Slice: Fixes a single dimension to a constant value.
 */
export function sliceOlap(
  facts: OlapTransactionFact[],
  filter: OlapSliceFilter
): OlapTransactionFact[] {
  const { dimension, value } = filter;
  const valStr = String(value);

  return facts.filter((f) => {
    if (dimension === 'month') return f.month === valStr;
    if (dimension === 'quarter') return f.quarter === valStr;
    if (dimension === 'year') return String(f.year) === valStr;
    if (dimension === 'day') return f.day === valStr;
    if (dimension === 'activity') return f.activity === valStr;
    if (dimension === 'category') return f.category.toLowerCase() === valStr.toLowerCase();
    if (dimension === 'expense_type') return f.expense_type === valStr;
    if (dimension === 'income_type') return f.income_type === valStr;
    return true;
  });
}

/**
 * Dice: Filters simultaneously across multiple dimensions with bounding box criteria.
 */
export function diceOlap(
  facts: OlapTransactionFact[],
  criteria: OlapDiceCriteria
): OlapTransactionFact[] {
  return facts.filter((f) => {
    // 1. Date Range
    if (criteria.dateRange?.start && f.record_date < criteria.dateRange.start) return false;
    if (criteria.dateRange?.end && f.record_date > criteria.dateRange.end) return false;

    // 2. Activities
    if (criteria.activities && criteria.activities.length > 0) {
      if (!criteria.activities.includes(f.activity)) return false;
    }

    // 3. Categories
    if (criteria.categories && criteria.categories.length > 0) {
      if (!criteria.categories.includes(f.category)) return false;
    }

    // 4. Expense Types
    if (criteria.expenseTypes && criteria.expenseTypes.length > 0) {
      if (f.activity === 'EXPENSE' && !criteria.expenseTypes.includes(f.expense_type as any)) {
        return false;
      }
    }

    // 5. Income Types
    if (criteria.incomeTypes && criteria.incomeTypes.length > 0) {
      if (f.activity === 'INCOME' && !criteria.incomeTypes.includes(f.income_type)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Pivot: Computes a cross-tabular matrix rotating two dimensions.
 * For example: Rows = Category, Columns = Month, Cell = Total Expenses.
 */
export function pivotOlap(
  facts: OlapTransactionFact[],
  rowDimension: OlapPivotDimension,
  columnDimension: OlapPivotDimension,
  measure: OlapMeasureKey = 'total_expenses'
): OlapPivotResult {
  const getDimensionValue = (fact: OlapTransactionFact, dim: OlapPivotDimension): string => {
    if (dim === 'category') return fact.category || 'Other';
    if (dim === 'activity') return fact.activity;
    if (dim === 'expense_type') return fact.expense_type;
    if (dim === 'income_type') return fact.income_type;
    if (dim === 'month') return fact.month;
    if (dim === 'quarter') return fact.quarter;
    if (dim === 'year') return String(fact.year);
    if (dim === 'day') return fact.day;
    return 'Other';
  };

  const rowKeySet = new Set<string>();
  const colKeySet = new Set<string>();
  const rowFactsMap = new Map<string, OlapTransactionFact[]>();
  const colFactsMap = new Map<string, OlapTransactionFact[]>();
  // cellBuckets: rowKey -> colKey -> OlapTransactionFact[]
  const cellBuckets = new Map<string, Map<string, OlapTransactionFact[]>>();

  for (const fact of facts) {
    const rKey = getDimensionValue(fact, rowDimension);
    const cKey = getDimensionValue(fact, columnDimension);

    rowKeySet.add(rKey);
    colKeySet.add(cKey);

    let rowFacts = rowFactsMap.get(rKey);
    if (!rowFacts) {
      rowFacts = [];
      rowFactsMap.set(rKey, rowFacts);
    }
    rowFacts.push(fact);

    let colFacts = colFactsMap.get(cKey);
    if (!colFacts) {
      colFacts = [];
      colFactsMap.set(cKey, colFacts);
    }
    colFacts.push(fact);

    let rowMap = cellBuckets.get(rKey);
    if (!rowMap) {
      rowMap = new Map<string, OlapTransactionFact[]>();
      cellBuckets.set(rKey, rowMap);
    }

    let cellList = rowMap.get(cKey);
    if (!cellList) {
      cellList = [];
      rowMap.set(cKey, cellList);
    }
    cellList.push(fact);
  }

  // Sorted rows and columns
  const isTimeDim = (d: OlapPivotDimension) => ['month', 'quarter', 'year', 'day'].includes(d);
  const rows = Array.from(rowKeySet).sort((a, b) =>
    isTimeDim(rowDimension) ? a.localeCompare(b) : a.localeCompare(b)
  );
  const columns = Array.from(colKeySet).sort((a, b) =>
    isTimeDim(columnDimension) ? a.localeCompare(b) : a.localeCompare(b)
  );

  const matrix: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};

  for (const r of rows) {
    matrix[r] = {};

    for (const c of columns) {
      const bucket = cellBuckets.get(r)?.get(c) || [];
      const cellMeasures = calculateMeasures(bucket);
      matrix[r][c] = cellMeasures[measure] || 0;
    }

    // Row total calculated over true row facts (weighted for non-additive avg_amount)
    const rowBucket = rowFactsMap.get(r) || [];
    const rowMeasures = calculateMeasures(rowBucket);
    rowTotals[r] = rowMeasures[measure] || 0;
  }

  // Column totals calculated over true column facts
  for (const c of columns) {
    const colBucket = colFactsMap.get(c) || [];
    const colMeasures = calculateMeasures(colBucket);
    colTotals[c] = colMeasures[measure] || 0;
  }

  // Grand total calculated across all active facts
  const grandMeasures = calculateMeasures(facts);
  const grandTotal = grandMeasures[measure] || 0;

  return {
    rowDimension,
    columnDimension,
    measure,
    rows,
    columns,
    matrix,
    rowTotals,
    colTotals,
    grandTotal,
  };
}

// ============================================================
// 5. Balance Sheet Current-State Evaluation (Point-in-Time Position)
// ============================================================

export interface CurrentBalanceSheetState {
  currentSavings: number;
  totalDebt: number;
  investmentValue: number;
  fdValue: number;
  fdPrincipal: number;
  currentNetWorth: number;
  timestamp: string;
}

export function evaluateCurrentBalanceSheetState(
  savingsRecords: SavingsRow[] = [],
  debtRecords: DebtRow[] = [],
  investmentRecords: InvestmentRow[] = [],
  fdRecords: FDRow[] = []
): CurrentBalanceSheetState {
  // 1. Savings: strictly prioritize 'Total Savings' cumulative balance if available
  const totalSavingsType = savingsRecords
    .filter((s) => s.savings_type === 'Total Savings')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const currentSavings =
    totalSavingsType > 0
      ? totalSavingsType
      : savingsRecords.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // 2. Debts: sum of remaining loan principal
  const totalDebt = debtRecords.reduce(
    (sum, d) => sum + Number(d.remaining_balance || 0),
    0
  );

  // 3. Investments: current market value
  const investmentValue = investmentRecords.reduce(
    (sum, i) => sum + Number(i.quantity || 0) * Number(i.current_value || 0),
    0
  );

  // 4. FDs: principal + simple interest
  const fdPrincipal = fdRecords.reduce(
    (sum, f) => sum + Number(f.principal || 0),
    0
  );

  const fdValue = fdRecords.reduce((sum, f) => {
    const p = Number(f.principal || 0);
    const r = Number(f.interest_rate || 0);
    const t = Number(f.tenure_months || 12);
    const interest = p * (r / 100) * (t / 12);
    return sum + p + interest;
  }, 0);

  // 5. Net Worth = Savings + Investments + FD Principal - Total Debt
  const currentNetWorth = currentSavings + investmentValue + fdPrincipal - totalDebt;

  return {
    currentSavings: Math.round(currentSavings * 100) / 100,
    totalDebt: Math.round(totalDebt * 100) / 100,
    investmentValue: Math.round(investmentValue * 100) / 100,
    fdValue: Math.round(fdValue * 100) / 100,
    fdPrincipal: Math.round(fdPrincipal * 100) / 100,
    currentNetWorth: Math.round(currentNetWorth * 100) / 100,
    timestamp: new Date().toISOString(),
  };
}
