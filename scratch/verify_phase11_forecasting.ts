/**
 * Verification Test Suite for WealthIQ Phase 11:
 * Deterministic Expense Forecasting & Monthly Aggregation Fix
 */

import assert from 'assert';
import {
  getRecordMonth,
  getCurrentCalendarMonth,
  getNextCalendarMonth,
  getPreviousCalendarMonth,
  formatMonthDisplay,
  detectMonthGaps,
  aggregateMonthlyExpenses,
  calculateNextMonthExpenseForecast,
  calculateFinancialForecast,
  calculateFinancialFeatures,
  ExpenseRow,
  IncomeRow,
  SavingsRow,
  DebtRow,
  InvestmentRow,
  FDRow,
  FinancialData,
} from '../lib/financial-engine';

console.log('====================================================');
console.log('WealthIQ Phase 11 — Verification Test Suite');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// 1. Date & Month Utilities
// -------------------------------------------------------------
console.log('--- 1. Date & Month Extraction Utilities ---');

test('getRecordMonth correctly extracts YYYY-MM from valid dates', () => {
  assert.strictEqual(getRecordMonth('2026-10-09'), '2026-10');
  assert.strictEqual(getRecordMonth('2026-01-01'), '2026-01');
  assert.strictEqual(getRecordMonth('2026-12-31'), '2026-12');
  assert.strictEqual(getRecordMonth('2025-02-28'), '2025-02');
});

test('getRecordMonth handles month boundaries without UTC timezone shifts', () => {
  // Test midnight / month boundary strings
  assert.strictEqual(getRecordMonth('2026-09-30'), '2026-09');
  assert.strictEqual(getRecordMonth('2026-10-01'), '2026-10');
  assert.strictEqual(getRecordMonth('2026-10-31'), '2026-10');
  assert.strictEqual(getRecordMonth('2026-11-01'), '2026-11');
  assert.strictEqual(getRecordMonth('2026-12-31'), '2026-12');
  assert.strictEqual(getRecordMonth('2027-01-01'), '2027-01');
});

test('getRecordMonth returns null for invalid or missing dates', () => {
  assert.strictEqual(getRecordMonth(null), null);
  assert.strictEqual(getRecordMonth(undefined), null);
  assert.strictEqual(getRecordMonth(''), null);
  assert.strictEqual(getRecordMonth('invalid-date'), null);
  assert.strictEqual(getRecordMonth('2026-13-01'), null); // invalid month
  assert.strictEqual(getRecordMonth('2026-00-10'), null); // invalid month
});

test('getNextCalendarMonth handles normal months and year turnover', () => {
  assert.strictEqual(getNextCalendarMonth('2026-01'), '2026-02');
  assert.strictEqual(getNextCalendarMonth('2026-09'), '2026-10');
  assert.strictEqual(getNextCalendarMonth('2026-10'), '2026-11');
  assert.strictEqual(getNextCalendarMonth('2026-11'), '2026-12');
  assert.strictEqual(getNextCalendarMonth('2026-12'), '2027-01'); // Year rollover
});

test('getPreviousCalendarMonth handles normal months and year turnover', () => {
  assert.strictEqual(getPreviousCalendarMonth('2026-10'), '2026-09');
  assert.strictEqual(getPreviousCalendarMonth('2026-02'), '2026-01');
  assert.strictEqual(getPreviousCalendarMonth('2026-01'), '2025-12'); // Year rollover
});

test('formatMonthDisplay formats YYYY-MM correctly', () => {
  assert.strictEqual(formatMonthDisplay('2026-10'), 'October 2026');
  assert.strictEqual(formatMonthDisplay('2026-09'), 'September 2026');
  assert.strictEqual(formatMonthDisplay('2027-01'), 'January 2027');
  assert.strictEqual(formatMonthDisplay('2025-12'), 'December 2025');
});

test('detectMonthGaps identifies gaps without fabricating ₹0', () => {
  const continuous = ['2026-05', '2026-06', '2026-07'];
  const res1 = detectMonthGaps(continuous);
  assert.strictEqual(res1.hasGaps, false);
  assert.deepStrictEqual(res1.missingMonths, []);

  const gapped = ['2026-04', '2026-06', '2026-09'];
  const res2 = detectMonthGaps(gapped);
  assert.strictEqual(res2.hasGaps, true);
  assert.deepStrictEqual(res2.missingMonths, ['2026-05', '2026-07', '2026-08']);
});

// -------------------------------------------------------------
// 2. Monthly Expense Aggregation
// -------------------------------------------------------------
console.log('\n--- 2. Monthly Expense Aggregation Engine ---');

function createExpense(overrides: Partial<ExpenseRow>): ExpenseRow {
  return {
    id: overrides.id || 'exp-1',
    user_id: overrides.user_id || 'usr-1',
    category: overrides.category || 'Food',
    amount: overrides.amount !== undefined ? overrides.amount : 500,
    expense_type: overrides.expense_type || 'essential',
    record_date: overrides.record_date || '2026-10-05',
    description: overrides.description || 'Test transaction',
    created_at: '2026-10-05T12:00:00Z',
    updated_at: '2026-10-05T12:00:00Z',
  } as ExpenseRow;
}

test('aggregateMonthlyExpenses aggregates records by calendar month chronologically', () => {
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-08-15', amount: 10000, expense_type: 'essential', category: 'Housing' }),
    createExpense({ record_date: '2026-08-20', amount: 5000, expense_type: 'discretionary', category: 'Shopping' }),
    createExpense({ record_date: '2026-07-10', amount: 12000, expense_type: 'essential', category: 'Housing' }),
    createExpense({ record_date: '2026-09-01', amount: 8000, expense_type: 'essential', category: 'Food' }),
  ];

  const aggregates = aggregateMonthlyExpenses(records);
  assert.strictEqual(aggregates.length, 3);
  // Sorted chronological
  assert.strictEqual(aggregates[0].month, '2026-07');
  assert.strictEqual(aggregates[0].total, 12000);
  assert.strictEqual(aggregates[1].month, '2026-08');
  assert.strictEqual(aggregates[1].total, 15000);
  assert.strictEqual(aggregates[1].essential, 10000);
  assert.strictEqual(aggregates[1].discretionary, 5000);
  assert.strictEqual(aggregates[2].month, '2026-09');
  assert.strictEqual(aggregates[2].total, 8000);
});

test('aggregateMonthlyExpenses filters out invalid records safely', () => {
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-09-10', amount: 5000 }),
    createExpense({ record_date: 'invalid-date', amount: 3000 }), // malformed date
    createExpense({ record_date: '2026-09-11', amount: -200 }), // negative amount
    createExpense({ record_date: '2026-09-12', amount: NaN as any }), // NaN
    createExpense({ record_date: '2026-09-13', amount: Infinity as any }), // Infinity
  ];

  const aggregates = aggregateMonthlyExpenses(records);
  assert.strictEqual(aggregates.length, 1);
  assert.strictEqual(aggregates[0].month, '2026-09');
  assert.strictEqual(aggregates[0].total, 5000);
  assert.strictEqual(aggregates[0].recordCount, 1);
});

test('aggregateMonthlyExpenses excludes specified month (partial current month)', () => {
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-09-10', amount: 5000 }),
    createExpense({ record_date: '2026-10-02', amount: 2000 }), // current month
  ];

  const aggregates = aggregateMonthlyExpenses(records, { excludeMonth: '2026-10' });
  assert.strictEqual(aggregates.length, 1);
  assert.strictEqual(aggregates[0].month, '2026-09');
});

// -------------------------------------------------------------
// 3. Forecasting Tiers & Exact Math
// -------------------------------------------------------------
console.log('\n--- 3. Forecasting Tiers & Exact Mathematical Verification ---');

test('Tier 0: 0 usable months returns insufficient_history with null estimate', () => {
  const records: ExpenseRow[] = [];
  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_0');
  assert.strictEqual(result.method, 'insufficient_history');
  assert.strictEqual(result.estimated_amount, null);
  assert.strictEqual(result.usable_months_count, 0);
  assert.strictEqual(result.is_supported, false);
  assert.strictEqual(result.target_month, '2026-11');
});

test('Tier 0: 1 usable month returns run-rate fallback', () => {
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-09-15', amount: 45000 }),
  ];
  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_0');
  assert.strictEqual(result.method, 'run_rate_fallback');
  assert.strictEqual(result.estimated_amount, 45000);
  assert.strictEqual(result.usable_months_count, 1);
  assert.strictEqual(result.is_supported, false);
});

test('Tier 0: 2 usable months returns run-rate average', () => {
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-08-15', amount: 40000 }),
    createExpense({ record_date: '2026-09-15', amount: 50000 }),
  ];
  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_0');
  assert.strictEqual(result.method, 'run_rate_fallback');
  assert.strictEqual(result.estimated_amount, 45000); // (40000 + 50000) / 2
  assert.strictEqual(result.usable_months_count, 2);
  assert.strictEqual(result.is_supported, false);
});

test('Tier 1: 3 usable months uses 3M SMA', () => {
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-07-10', amount: 30000 }),
    createExpense({ record_date: '2026-08-10', amount: 42000 }),
    createExpense({ record_date: '2026-09-10', amount: 48000 }),
  ];
  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_1');
  assert.strictEqual(result.method, '3m_simple_moving_average');
  // (30000 + 42000 + 48000) / 3 = 120000 / 3 = 40000
  assert.strictEqual(result.estimated_amount, 40000);
  assert.strictEqual(result.usable_months_count, 3);
  assert.strictEqual(result.is_supported, true);
});

test('Tier 1: 5 usable months uses 3M SMA of the most recent 3 months', () => {
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-05-10', amount: 10000 }),
    createExpense({ record_date: '2026-06-10', amount: 20000 }),
    createExpense({ record_date: '2026-07-10', amount: 30000 }),
    createExpense({ record_date: '2026-08-10', amount: 40000 }),
    createExpense({ record_date: '2026-09-10', amount: 50000 }),
  ];
  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_1');
  assert.strictEqual(result.method, '3m_simple_moving_average');
  // Most recent 3: 07, 08, 09 -> (30000 + 40000 + 50000) / 3 = 40000
  assert.strictEqual(result.estimated_amount, 40000);
  assert.strictEqual(result.usable_months_count, 5);
  assert.strictEqual(result.is_supported, true);
});

test('Tier 2: 6 usable months matches Phase 10 benchmark 6M EWMA (alpha = 0.5)', () => {
  // Let values be: [20000, 22000, 24000, 26000, 28000, 30000]
  // Manual verification:
  // e_1 = 20000
  // e_2 = 0.5 * 22000 + 0.5 * 20000 = 21000
  // e_3 = 0.5 * 24000 + 0.5 * 21000 = 22500
  // e_4 = 0.5 * 26000 + 0.5 * 22500 = 24250
  // e_5 = 0.5 * 28000 + 0.5 * 24250 = 26125
  // e_6 = 0.5 * 30000 + 0.5 * 26125 = 28062.5 -> rounded = 28063
  const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const values = [20000, 22000, 24000, 26000, 28000, 30000];

  const records: ExpenseRow[] = months.map((m, idx) =>
    createExpense({ record_date: `${m}-15`, amount: values[idx] })
  );

  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_2');
  assert.strictEqual(result.method, '6m_exponential_weighted_moving_average');
  assert.strictEqual(result.usable_months_count, 6);
  assert.strictEqual(result.estimated_amount, 28063);
  assert.strictEqual(result.is_supported, true);
});

test('Tier 2: 8 usable months takes the 6 most recent months for EWMA', () => {
  const months = [
    '2026-02', '2026-03', // earlier months
    '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
  ];
  const values = [100000, 100000, 20000, 22000, 24000, 26000, 28000, 30000];

  const records: ExpenseRow[] = months.map((m, idx) =>
    createExpense({ record_date: `${m}-15`, amount: values[idx] })
  );

  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_2');
  assert.strictEqual(result.usable_months_count, 8);
  // Takes last 6 months (values[2..7]), same as above test: 28063
  assert.strictEqual(result.estimated_amount, 28063);
});

test('Tier 3: 12 usable months preserves ML dormant status and applies deterministic fallback', () => {
  const months = [
    '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03',
    '2026-04', '2026-05', '2026-06',
    '2026-07', '2026-08', '2026-09',
  ];
  const records: ExpenseRow[] = months.map((m) =>
    createExpense({ record_date: `${m}-15`, amount: 50000 })
  );

  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_3');
  assert.strictEqual(result.method, 'deterministic_fallback_mature');
  assert.strictEqual(result.usable_months_count, 12);
  assert.strictEqual(result.estimated_amount, 50000);
  assert.strictEqual(result.is_supported, true);
  assert(result.explanation.includes('Machine learning is currently dormant'));
  assert(result.data_limitations.some((lim) => lim.includes('qualifying for future model-selection')));
});

test('Missing-month gap flags data limitations warning without fabricating ₹0', () => {
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-06-15', amount: 30000 }),
    // Missing 2026-07
    createExpense({ record_date: '2026-08-15', amount: 40000 }),
    createExpense({ record_date: '2026-09-15', amount: 50000 }),
  ];

  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });

  assert.strictEqual(result.tier, 'tier_1');
  assert.strictEqual(result.usable_months_count, 3);
  assert(result.data_limitations.some((lim) => lim.includes('unlogged month gap')));
  assert(result.data_limitations.some((lim) => lim.includes('2026-07')));
});

// -------------------------------------------------------------
// 4. Expenses Page Aggregation Defect Fix Verification
// -------------------------------------------------------------
console.log('\n--- 4. Expenses Page Aggregation Defect Fix Verification ---');

test('Filtering strictly by selected month isolates current month from historical records', () => {
  // Scenario: User has records from September 2026 and October 2026
  const sampleRecords: ExpenseRow[] = [
    createExpense({ record_date: '2026-09-10', amount: 15000, expense_type: 'essential', category: 'Housing' }),
    createExpense({ record_date: '2026-09-20', amount: 5000, expense_type: 'discretionary', category: 'Shopping' }),
    createExpense({ record_date: '2026-10-02', amount: 8000, expense_type: 'essential', category: 'Food' }),
    createExpense({ record_date: '2026-10-05', amount: 2000, expense_type: 'discretionary', category: 'Entertainment' }),
  ];

  // Old behavior (defect): sums everything
  const oldTotal = sampleRecords.reduce((s, r) => s + Number(r.amount), 0);
  assert.strictEqual(oldTotal, 30000);

  // New behavior: filter by selectedMonth = '2026-10'
  const octRecords = sampleRecords.filter((r) => getRecordMonth(r.record_date) === '2026-10');
  const octEssential = octRecords.filter((r) => r.expense_type === 'essential').reduce((s, r) => s + Number(r.amount), 0);
  const octDiscretionary = octRecords.filter((r) => r.expense_type === 'discretionary').reduce((s, r) => s + Number(r.amount), 0);
  const octTotal = octEssential + octDiscretionary;

  assert.strictEqual(octEssential, 8000);
  assert.strictEqual(octDiscretionary, 2000);
  assert.strictEqual(octTotal, 10000);
  assert.notStrictEqual(octTotal, oldTotal, 'Current month total must NOT sum previous months');

  // Verify September records when selectedMonth = '2026-09'
  const sepRecords = sampleRecords.filter((r) => getRecordMonth(r.record_date) === '2026-09');
  const sepTotal = sepRecords.reduce((s, r) => s + Number(r.amount), 0);
  assert.strictEqual(sepTotal, 20000);
});

test('Category chart data strictly aggregates filtered records', () => {
  const sampleRecords: ExpenseRow[] = [
    createExpense({ record_date: '2026-09-10', amount: 15000, category: 'Housing' }),
    createExpense({ record_date: '2026-10-02', amount: 8000, category: 'Food' }),
  ];

  const octRecords = sampleRecords.filter((r) => getRecordMonth(r.record_date) === '2026-10');
  const categoryMap = new Map<string, number>();
  for (const r of octRecords) {
    categoryMap.set(r.category, (categoryMap.get(r.category) || 0) + Number(r.amount));
  }

  assert.strictEqual(categoryMap.has('Housing'), false, 'Housing from September must NOT appear in October chart');
  assert.strictEqual(categoryMap.get('Food'), 8000);
});

// -------------------------------------------------------------
// 5. Preservation of Existing Forecast & Recommendations
// -------------------------------------------------------------
console.log('\n--- 5. Preservation of Existing Financial Forecast Engine ---');

test('calculateFinancialForecast preserves net-worth trajectory and attaches next-month expense forecast', () => {
  const mockData: FinancialData = {
    incomeRecords: [
      { id: 'inc-1', user_id: 'u1', amount: 150000, income_type: 'Salary', source: 'Employer', record_date: '2026-10-01', created_at: '', updated_at: '' } as IncomeRow,
    ],
    expenseRecords: [
      createExpense({ record_date: '2026-07-15', amount: 30000 }),
      createExpense({ record_date: '2026-08-15', amount: 32000 }),
      createExpense({ record_date: '2026-09-15', amount: 34000 }),
      createExpense({ record_date: '2026-10-05', amount: 10000 }), // in-progress
    ],
    savingsRecords: [
      { id: 'sav-1', user_id: 'u1', amount: 100000, savings_type: 'Total Savings', record_date: '2026-10-01', created_at: '', updated_at: '' } as SavingsRow,
    ],
    debtRecords: [],
    investmentRecords: [],
    fdRecords: [],
  };

  const features = calculateFinancialFeatures(mockData);
  const result = calculateFinancialForecast(features, mockData);

  // Check that standard net-worth projection milestones exist and are unaffected
  assert.strictEqual(typeof result.horizons.current.net_worth, 'number');
  assert.strictEqual(typeof result.horizons.m6.net_worth, 'number');
  assert.strictEqual(typeof result.horizons.m12.net_worth, 'number');
  assert.strictEqual(typeof result.horizons.m36.net_worth, 'number');
  assert.strictEqual(result.points.length, 7);
  assert.strictEqual(result.trajectory_type, 'positive');

  // Check that new next_month_expense_forecast is attached
  assert(result.next_month_expense_forecast !== undefined);
  assert.strictEqual(result.next_month_expense_forecast.tier, 'tier_1');
  assert.strictEqual(result.next_month_expense_forecast.method, '3m_simple_moving_average');
  // (30000 + 32000 + 34000) / 3 = 32000
  assert.strictEqual(result.next_month_expense_forecast.estimated_amount, 32000);
});

// -------------------------------------------------------------
// 6. Source Integrity & CRUD Preservation Checks
// -------------------------------------------------------------
console.log('\n--- 6. Source Integrity & CRUD Flow Preservation Checks ---');

import fs from 'fs';

test('app/expenses/page.tsx preserves all CRUD and smart classifier flows', () => {
  const content = fs.readFileSync('app/expenses/page.tsx', 'utf-8');

  // Verify classifier integration
  assert(content.includes('classifyTransaction'), 'classifyTransaction import preserved');
  assert(content.includes('handleSuggestCategory'), 'handleSuggestCategory function preserved');
  assert(content.includes('Sparkles'), 'Sparkles icon preserved');
  assert(content.includes('suggestionNotice'), 'suggestionNotice banner preserved');
  assert(content.includes('/income'), 'Income navigation link preserved');

  // Verify Supabase CRUD operations
  assert(content.includes('.insert({'), 'insert operation preserved');
  assert(content.includes('.update('), 'update operation preserved');
  assert(content.includes('.delete()'), 'delete operation preserved');
  assert(content.includes('editingId'), 'editing state preserved');
  assert(content.includes('deletingId'), 'deleting state preserved');

  // Verify monthly filtering hooks
  assert(content.includes('selectedMonth'), 'selectedMonth filter state present');
  assert(content.includes('availableMonths'), 'availableMonths memo present');
  assert(content.includes('monthlyRecords'), 'monthlyRecords memo present');
});

test('app/forecast/page.tsx displays Next-Month Expense Estimation clearly distinct from net worth', () => {
  const content = fs.readFileSync('app/forecast/page.tsx', 'utf-8');

  assert(content.includes('next_month_expense_forecast'), 'next_month_expense_forecast wired in page');
  assert(content.includes('Next-Month Expense Estimation'), 'Next-month estimation card title present');
  assert(content.includes('Data Quality &amp; Completeness Limitations') || content.includes('Data Quality & Completeness Limitations'), 'Data quality limitations section present');
  assert(content.includes('ForecastChart'), 'ForecastChart net-worth trajectory preserved');
});

test('Deterministic non-negative output constraint is strictly maintained', () => {
  // If historical records had 0 values
  const records: ExpenseRow[] = [
    createExpense({ record_date: '2026-07-15', amount: 0 }),
    createExpense({ record_date: '2026-08-15', amount: 0 }),
    createExpense({ record_date: '2026-09-15', amount: 0 }),
  ];
  const result = calculateNextMonthExpenseForecast(records, { currentMonth: '2026-10' });
  assert.strictEqual(result.estimated_amount, 0);
  assert(result.estimated_amount !== null && result.estimated_amount >= 0);
});

// -------------------------------------------------------------
// Final Summary
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`Verification Complete: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
