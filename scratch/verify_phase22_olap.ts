/**
 * WealthIQ Phase 22 — OLAP Analytical Layer Verification Suite
 * Tests multi-dimensional two-cube architecture, Roll-up, Drill-down,
 * Slice, Dice, Cross-Tab Pivot, Reconciliation, and Data Integrity Guardrails.
 */

import assert from 'assert';
import {
  extractDateParts,
  formatTimeLabel,
  buildTransactionFacts,
  buildSnapshotFacts,
  calculateMeasures,
  rollupOlap,
  drilldownOlap,
  sliceOlap,
  diceOlap,
  pivotOlap,
  reconcileOlapTotals,
  evaluateCurrentBalanceSheetState,
  IncomeRow,
  ExpenseRow,
  SavingsRow,
  FinancialHistoryRow,
  DebtRow,
  InvestmentRow,
  FDRow,
} from '../lib/olap-engine';

console.log('====================================================');
console.log('WealthIQ Phase 22 — OLAP Analytical Verification Suite');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. Temporal Extraction & Quarter Calculations
// -------------------------------------------------------------
console.log('--- 1. Temporal Extraction Utilities ---');

test('extractDateParts correctly extracts day, month, quarter, and year', () => {
  const parts1 = extractDateParts('2026-10-15');
  assert(parts1);
  assert.strictEqual(parts1.day, '2026-10-15');
  assert.strictEqual(parts1.month, '2026-10');
  assert.strictEqual(parts1.quarter, '2026-Q4');
  assert.strictEqual(parts1.year, 2026);

  const parts2 = extractDateParts('2026-02-28');
  assert(parts2);
  assert.strictEqual(parts2.quarter, '2026-Q1');

  const parts3 = extractDateParts('2026-07-01');
  assert(parts3);
  assert.strictEqual(parts3.quarter, '2026-Q3');
});

test('extractDateParts handles leap years and month boundaries without UTC shift', () => {
  const leapDay = extractDateParts('2028-02-29');
  assert(leapDay);
  assert.strictEqual(leapDay.day, '2028-02-29');
  assert.strictEqual(leapDay.month, '2028-02');
  assert.strictEqual(leapDay.quarter, '2028-Q1');
  assert.strictEqual(leapDay.year, 2028);

  const yearEnd = extractDateParts('2026-12-31');
  assert(yearEnd);
  assert.strictEqual(yearEnd.month, '2026-12');
  assert.strictEqual(yearEnd.quarter, '2026-Q4');
  assert.strictEqual(yearEnd.year, 2026);
});

// -------------------------------------------------------------
// 2. Fact Table Construction & Savings Balance Isolation
// -------------------------------------------------------------
console.log('\n--- 2. Two-Cube Isolation & Savings Balance Rules ---');

test('buildTransactionFacts strictly excludes cumulative balances (Total Savings, Emergency Fund)', () => {
  const rawSavings: SavingsRow[] = [
    {
      id: 's1',
      user_id: 'u1',
      amount: 500000,
      record_date: '2026-10-01',
      savings_type: 'Total Savings',
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 's2',
      user_id: 'u1',
      amount: 150000,
      record_date: '2026-10-01',
      savings_type: 'Emergency Fund',
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 's3',
      user_id: 'u1',
      amount: 10000,
      record_date: '2026-10-05',
      savings_type: 'Monthly Savings',
      created_at: '2026-10-05T00:00:00Z',
    },
  ];

  const facts = buildTransactionFacts([], [], rawSavings);

  // Must only contain the Monthly Savings flow, NOT the 5,00,000 balance!
  assert.strictEqual(facts.length, 1);
  assert.strictEqual(facts[0].id, 's3');
  assert.strictEqual(facts[0].amount, 10000);
  assert.strictEqual(facts[0].activity, 'SAVINGS_CONTRIBUTION');
});

test('buildTransactionFacts correctly normalizes income and expense records', () => {
  const rawIncome: IncomeRow[] = [
    {
      id: 'i1',
      user_id: 'u1',
      amount: 80000,
      income_type: 'Salary',
      record_date: '2026-10-01',
      created_at: '2026-10-01T00:00:00Z',
    },
  ];
  const rawExpenses: ExpenseRow[] = [
    {
      id: 'e1',
      user_id: 'u1',
      category: 'Housing',
      amount: 25000,
      expense_type: 'essential',
      record_date: '2026-10-02',
      description: 'Rent',
      created_at: '2026-10-02T00:00:00Z',
    },
    {
      id: 'e2',
      user_id: 'u1',
      category: 'Entertainment',
      amount: 4500,
      expense_type: 'discretionary',
      record_date: '2026-10-10',
      description: 'Concert',
      created_at: '2026-10-10T00:00:00Z',
    },
  ];

  const facts = buildTransactionFacts(rawIncome, rawExpenses, []);
  assert.strictEqual(facts.length, 3);

  const inc = facts.find((f) => f.id === 'i1')!;
  assert.strictEqual(inc.activity, 'INCOME');
  assert.strictEqual(inc.amount, 80000);
  assert.strictEqual(inc.quarter, '2026-Q4');

  const exp1 = facts.find((f) => f.id === 'e1')!;
  assert.strictEqual(exp1.activity, 'EXPENSE');
  assert.strictEqual(exp1.expense_type, 'essential');

  const exp2 = facts.find((f) => f.id === 'e2')!;
  assert.strictEqual(exp2.activity, 'EXPENSE');
  assert.strictEqual(exp2.expense_type, 'discretionary');
});

// -------------------------------------------------------------
// 3. Measure Computation & Mathematical Reconciliation
// -------------------------------------------------------------
console.log('\n--- 3. Measures & Reconciliation ---');

test('calculateMeasures correctly calculates net cash flow and average amount', () => {
  const rawIncome: IncomeRow[] = [
    { id: 'i1', user_id: 'u1', amount: 100000, income_type: 'Salary', record_date: '2026-10-01', created_at: '' },
    { id: 'i2', user_id: 'u1', amount: 20000, income_type: 'Freelance', record_date: '2026-10-15', created_at: '' },
  ];
  const rawExpenses: ExpenseRow[] = [
    { id: 'e1', user_id: 'u1', category: 'Housing', amount: 30000, expense_type: 'essential', record_date: '2026-10-02', description: null, created_at: '' },
    { id: 'e2', user_id: 'u1', category: 'Food', amount: 15000, expense_type: 'essential', record_date: '2026-10-05', description: null, created_at: '' },
    { id: 'e3', user_id: 'u1', category: 'Shopping', amount: 5000, expense_type: 'discretionary', record_date: '2026-10-12', description: null, created_at: '' },
  ];

  const facts = buildTransactionFacts(rawIncome, rawExpenses, []);
  const measures = calculateMeasures(facts);

  assert.strictEqual(measures.total_income, 120000);
  assert.strictEqual(measures.total_expenses, 50000);
  assert.strictEqual(measures.net_cash_flow, 70000); // 1,20,000 - 50,000
  assert.strictEqual(measures.transaction_count, 5);
  assert.strictEqual(measures.avg_amount, 34000); // (120000 + 50000) / 5
});

test('reconcileOlapTotals verifies zero discrepancy between underlying records and facts', () => {
  const rawIncome: IncomeRow[] = [
    { id: 'i1', user_id: 'u1', amount: 54321.5, income_type: 'Salary', record_date: '2026-10-01', created_at: '' },
  ];
  const rawExpenses: ExpenseRow[] = [
    { id: 'e1', user_id: 'u1', category: 'Utilities', amount: 4321.5, expense_type: 'essential', record_date: '2026-10-03', description: null, created_at: '' },
  ];

  const facts = buildTransactionFacts(rawIncome, rawExpenses, []);
  const recon = reconcileOlapTotals(rawIncome, rawExpenses, facts);

  assert.strictEqual(recon.isReconciled, true);
  assert.strictEqual(recon.discrepancy, 0);
  assert.strictEqual(recon.totalIncome, 54321.5);
  assert.strictEqual(recon.totalExpenses, 4321.5);
  assert.strictEqual(recon.netCashFlow, 50000);
});

// -------------------------------------------------------------
// 4. OLAP Operations: Roll-up, Drill-down, Slice, Dice, Pivot
// -------------------------------------------------------------
console.log('\n--- 4. OLAP Operations Mechanics ---');

// Test dataset spanning multi-month and multi-quarter
const testIncome: IncomeRow[] = [
  { id: 'i1', user_id: 'u1', amount: 50000, income_type: 'Salary', record_date: '2026-07-01', created_at: '' },
  { id: 'i2', user_id: 'u1', amount: 50000, income_type: 'Salary', record_date: '2026-08-01', created_at: '' },
  { id: 'i3', user_id: 'u1', amount: 50000, income_type: 'Salary', record_date: '2026-09-01', created_at: '' },
  { id: 'i4', user_id: 'u1', amount: 60000, income_type: 'Salary', record_date: '2026-10-01', created_at: '' },
];
const testExpenses: ExpenseRow[] = [
  { id: 'e1', user_id: 'u1', category: 'Housing', amount: 20000, expense_type: 'essential', record_date: '2026-07-05', description: null, created_at: '' },
  { id: 'e2', user_id: 'u1', category: 'Food', amount: 10000, expense_type: 'essential', record_date: '2026-07-15', description: null, created_at: '' },
  { id: 'e3', user_id: 'u1', category: 'Housing', amount: 20000, expense_type: 'essential', record_date: '2026-08-05', description: null, created_at: '' },
  { id: 'e4', user_id: 'u1', category: 'Food', amount: 12000, expense_type: 'essential', record_date: '2026-08-12', description: null, created_at: '' },
  { id: 'e5', user_id: 'u1', category: 'Entertainment', amount: 8000, expense_type: 'discretionary', record_date: '2026-08-20', description: null, created_at: '' },
  { id: 'e6', user_id: 'u1', category: 'Housing', amount: 20000, expense_type: 'essential', record_date: '2026-09-05', description: null, created_at: '' },
  { id: 'e7', user_id: 'u1', category: 'Food', amount: 11000, expense_type: 'essential', record_date: '2026-09-15', description: null, created_at: '' },
  { id: 'e8', user_id: 'u1', category: 'Housing', amount: 22000, expense_type: 'essential', record_date: '2026-10-05', description: null, created_at: '' },
];

const testFacts = buildTransactionFacts(testIncome, testExpenses, []);

test('rollupOlap correctly aggregates to Month, Quarter, and Year grains', () => {
  // Monthly Rollup
  const monthlyRollup = rollupOlap(testFacts, 'month');
  assert.strictEqual(monthlyRollup.length, 4); // Jul, Aug, Sep, Oct
  assert.strictEqual(monthlyRollup[0].key, '2026-07');
  assert.strictEqual(monthlyRollup[0].measures.total_income, 50000);
  assert.strictEqual(monthlyRollup[0].measures.total_expenses, 30000);
  assert.strictEqual(monthlyRollup[0].measures.net_cash_flow, 20000);

  // Quarterly Rollup
  const quarterlyRollup = rollupOlap(testFacts, 'quarter');
  assert.strictEqual(quarterlyRollup.length, 2); // 2026-Q3 and 2026-Q4
  const q3 = quarterlyRollup.find((r) => r.key === '2026-Q3')!;
  assert.strictEqual(q3.measures.total_income, 150000); // 3 * 50k
  assert.strictEqual(q3.measures.total_expenses, 101000); // 30k + 40k + 31k

  // Annual Rollup
  const annualRollup = rollupOlap(testFacts, 'year');
  assert.strictEqual(annualRollup.length, 1);
  assert.strictEqual(annualRollup[0].key, '2026');
  assert.strictEqual(annualRollup[0].measures.total_income, 210000);
  assert.strictEqual(annualRollup[0].measures.total_expenses, 123000);
});

test('drilldownOlap drills down from a month into its constituent categories', () => {
  // All facts drilldown for August (contains Salary, Housing, Food, Entertainment)
  const augDrilldown = drilldownOlap(
    testFacts,
    { grain: 'month', value: '2026-08' },
    'category'
  );

  assert.strictEqual(augDrilldown.length, 4); // Salary (inflow), Housing, Food, Entertainment
  const salary = augDrilldown.find((r) => r.dimensionValue === 'Salary')!;
  assert.strictEqual(salary.measures.total_income, 50000);

  const housing = augDrilldown.find((r) => r.dimensionValue === 'Housing')!;
  assert.strictEqual(housing.measures.total_expenses, 20000);

  const entertainment = augDrilldown.find((r) => r.dimensionValue === 'Entertainment')!;
  assert.strictEqual(entertainment.measures.total_expenses, 8000);

  // Category sum must reconcile with August total expenses (₹40,000)
  const augExpenseSum = augDrilldown.reduce((s, r) => s + r.measures.total_expenses, 0);
  assert.strictEqual(augExpenseSum, 40000);

  // Expense-only drilldown (sliced)
  const expenseFacts = sliceOlap(testFacts, { dimension: 'activity', value: 'EXPENSE' });
  const augExpenseOnly = drilldownOlap(
    expenseFacts,
    { grain: 'month', value: '2026-08' },
    'category'
  );
  assert.strictEqual(augExpenseOnly.length, 3); // Housing, Food, Entertainment
});

test('sliceOlap filters strictly along a single dimension', () => {
  // Slice on essential expenses only
  const essentialSlice = sliceOlap(testFacts, { dimension: 'expense_type', value: 'essential' });
  assert.strictEqual(essentialSlice.length, 7); // All expenses except e5 (Entertainment)
  const entertainmentFound = essentialSlice.some((f) => f.category === 'Entertainment');
  assert.strictEqual(entertainmentFound, false);

  // Slice on Category 'Housing'
  const housingSlice = sliceOlap(testFacts, { dimension: 'category', value: 'Housing' });
  assert.strictEqual(housingSlice.length, 4);
  const totalHousing = housingSlice.reduce((s, f) => s + f.amount, 0);
  assert.strictEqual(totalHousing, 82000); // 20k + 20k + 20k + 22k
});

test('diceOlap filters simultaneously along multiple dimensions (bounding box)', () => {
  const diced = diceOlap(testFacts, {
    dateRange: { start: '2026-08-01', end: '2026-09-30' },
    activities: ['EXPENSE'],
    categories: ['Housing', 'Entertainment'],
  });

  // Aug Housing (20k), Aug Entertainment (8k), Sep Housing (20k)
  assert.strictEqual(diced.length, 3);
  const totalDiced = diced.reduce((s, f) => s + f.amount, 0);
  assert.strictEqual(totalDiced, 48000);
});

test('pivotOlap calculates a dynamic cross-tab matrix with verified row and col totals', () => {
  const pivot = pivotOlap(testFacts, 'category', 'month', 'total_expenses');

  assert(pivot.rows.includes('Housing'));
  assert(pivot.rows.includes('Food'));
  assert(pivot.rows.includes('Entertainment'));
  assert.deepStrictEqual(pivot.columns, ['2026-07', '2026-08', '2026-09', '2026-10']);

  // Cell assertions
  assert.strictEqual(pivot.matrix['Housing']['2026-07'], 20000);
  assert.strictEqual(pivot.matrix['Housing']['2026-10'], 22000);
  assert.strictEqual(pivot.matrix['Entertainment']['2026-08'], 8000);
  assert.strictEqual(pivot.matrix['Entertainment']['2026-07'], 0); // zero when absent

  // Row total assertion
  assert.strictEqual(pivot.rowTotals['Housing'], 82000);
  assert.strictEqual(pivot.rowTotals['Food'], 33000);
  assert.strictEqual(pivot.rowTotals['Entertainment'], 8000);

  // Column total assertion
  assert.strictEqual(pivot.colTotals['2026-07'], 30000);
  assert.strictEqual(pivot.colTotals['2026-08'], 40000);
  assert.strictEqual(pivot.colTotals['2026-09'], 31000);
  assert.strictEqual(pivot.colTotals['2026-10'], 22000);

  // Grand total assertion: sum of all expenses = 1,23,000
  assert.strictEqual(pivot.grandTotal, 123000);
});

// -------------------------------------------------------------
// 5. Cube 2: Snapshot Facts & Current State Isolation
// -------------------------------------------------------------
console.log('\n--- 5. Cube 2: Snapshots & Current Balance Sheet State ---');

test('buildSnapshotFacts never fabricates fake past months when history is empty', () => {
  const snapshots = buildSnapshotFacts([]);
  assert.strictEqual(snapshots.length, 0); // Zero artificial backfill!
});

test('buildSnapshotFacts preserves genuine snapshot rows chronologically', () => {
  const rawHistory: FinancialHistoryRow[] = [
    {
      id: 'h2',
      user_id: 'u1',
      month: '2026-09',
      income: 80000,
      expenses: 45000,
      savings: 200000,
      debt: 100000,
      investments: 150000,
      fd_value: 50000,
      net_worth: 300000,
      created_at: '2026-09-30T00:00:00Z',
    },
    {
      id: 'h1',
      user_id: 'u1',
      month: '2026-08',
      income: 80000,
      expenses: 50000,
      savings: 180000,
      debt: 110000,
      investments: 140000,
      fd_value: 50000,
      net_worth: 260000,
      created_at: '2026-08-31T00:00:00Z',
    },
  ];

  const snapshots = buildSnapshotFacts(rawHistory);
  assert.strictEqual(snapshots.length, 2);
  // Must be sorted chronologically ascending
  assert.strictEqual(snapshots[0].month, '2026-08');
  assert.strictEqual(snapshots[1].month, '2026-09');
  assert.strictEqual(snapshots[0].net_worth, 260000);
  assert.strictEqual(snapshots[1].net_worth, 300000);
});

test('evaluateCurrentBalanceSheetState isolates current debts and investments as live state', () => {
  const rawSavings: SavingsRow[] = [
    { id: 's1', user_id: 'u1', amount: 250000, savings_type: 'Total Savings', record_date: '2026-10-01', created_at: '' },
  ];
  const rawDebts: DebtRow[] = [
    { id: 'd1', user_id: 'u1', debt_type: 'Car Loan', original_principal: 500000, remaining_balance: 150000, interest_rate: 8.5, monthly_emi: 12000, remaining_months: 14, created_at: '', updated_at: '' },
  ];
  const rawInvestments: InvestmentRow[] = [
    { id: 'inv1', user_id: 'u1', asset_type: 'Stock', symbol: 'INFY', quantity: 100, purchase_price: 1500, current_value: 1800, created_at: '', updated_at: '' },
  ];
  const rawFDs: FDRow[] = [
    { id: 'f1', user_id: 'u1', bank_name: 'HDFC', principal: 100000, interest_rate: 7.0, tenure_months: 12, start_date: '2026-01-01', maturity_date: null, senior_citizen: false, created_at: '' },
  ];

  const state = evaluateCurrentBalanceSheetState(rawSavings, rawDebts, rawInvestments, rawFDs);

  assert.strictEqual(state.currentSavings, 250000);
  assert.strictEqual(state.totalDebt, 150000);
  assert.strictEqual(state.investmentValue, 180000); // 100 * 1800
  assert.strictEqual(state.fdPrincipal, 100000);
  assert.strictEqual(state.fdValue, 107000); // 100000 + 7000 interest
  // Net Worth = 2,50,000 + 1,80,000 + 1,00,000 - 1,50,000 = 3,80,000
  assert.strictEqual(state.currentNetWorth, 380000);
});

// -------------------------------------------------------------
// 6. Mathematical Safety & Edge Cases
// -------------------------------------------------------------
console.log('\n--- 6. Mathematical Safety & Boundary Edge Cases ---');

test('calculateMeasures handles empty facts array safely without NaN or crash', () => {
  const emptyMeasures = calculateMeasures([]);
  assert.strictEqual(emptyMeasures.total_income, 0);
  assert.strictEqual(emptyMeasures.total_expenses, 0);
  assert.strictEqual(emptyMeasures.net_cash_flow, 0);
  assert.strictEqual(emptyMeasures.transaction_count, 0);
  assert.strictEqual(emptyMeasures.avg_amount, 0);
  assert(!isNaN(emptyMeasures.avg_amount));
});

test('pivotOlap correctly computes non-additive average amount without averaging averages', () => {
  // Scenario:
  // Month 1: 1 large transaction of 90,000 (avg = 90,000)
  // Month 2: 9 small transactions of 10,000 each = 90,000 (avg = 10,000)
  // Correct combined average: (90,000 + 90,000) / (1 + 9) = 180,000 / 10 = 18,000.
  // WRONG naive average: (90,000 + 10,000) / 2 = 50,000.
  const weightedExpenses: ExpenseRow[] = [
    { id: 'we1', user_id: 'u1', category: 'Equipment', amount: 90000, expense_type: 'essential', record_date: '2026-01-10', description: null, created_at: '' },
    ...Array.from({ length: 9 }).map((_, i) => ({
      id: `we_sub_${i}`,
      user_id: 'u1',
      category: 'Equipment',
      amount: 10000,
      expense_type: 'essential' as const,
      record_date: '2026-02-10',
      description: null,
      created_at: '',
    })),
  ];

  const weightedFacts = buildTransactionFacts([], weightedExpenses, []);
  const pivot = pivotOlap(weightedFacts, 'category', 'month', 'avg_amount');

  assert.strictEqual(pivot.matrix['Equipment']['2026-01'], 90000);
  assert.strictEqual(pivot.matrix['Equipment']['2026-02'], 10000);
  // Combined Row Total must equal true weighted average: 18,000 (1,80,000 / 10), not 1,00,000!
  assert.strictEqual(pivot.rowTotals['Equipment'], 18000);
  assert.strictEqual(pivot.grandTotal, 18000);
});

test('diceOlap gracefully handles missing bounds and returns all matching records', () => {
  const unboundedDice = diceOlap(testFacts, {});
  assert.strictEqual(unboundedDice.length, testFacts.length);
});

test('buildTransactionFacts filters out non-finite or negative transaction amounts', () => {
  const invalidExpenses: ExpenseRow[] = [
    { id: 'inv1', user_id: 'u1', category: 'Food', amount: -500, expense_type: 'essential', record_date: '2026-10-01', description: null, created_at: '' },
    { id: 'inv2', user_id: 'u1', category: 'Food', amount: NaN as any, expense_type: 'essential', record_date: '2026-10-01', description: null, created_at: '' },
    { id: 'inv3', user_id: 'u1', category: 'Food', amount: 0, expense_type: 'essential', record_date: '2026-10-01', description: null, created_at: '' },
    { id: 'val1', user_id: 'u1', category: 'Food', amount: 250, expense_type: 'essential', record_date: '2026-10-01', description: null, created_at: '' },
  ];

  const facts = buildTransactionFacts([], invalidExpenses, []);
  assert.strictEqual(facts.length, 1);
  assert.strictEqual(facts[0].id, 'val1');
  assert.strictEqual(facts[0].amount, 250);
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`Test Execution Finished: ${passed} passed, ${failed} failed.`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
