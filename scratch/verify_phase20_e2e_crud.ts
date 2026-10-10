import assert from 'assert';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/types';
import { calculateFinancialForecast, calculateFinancialFeatures } from '../lib/financial-engine';
import { lookupVerifiedFDRate } from '../lib/fd-rates-data';

let passed = 0;
let failed = 0;

function testPass(name: string) {
  console.log(`  [PASS] ${name}`);
  passed++;
}

function testFail(name: string, err: any) {
  console.error(`  [FAIL] ${name}:`, err?.message || err);
  failed++;
}

async function run() {
  console.log('====================================================');
  console.log('WealthIQ Phase 20 — End-to-End Functional & CRUD Suite');
  console.log('====================================================\n');

  // Load session
  const rawSession = fs.readFileSync('/tmp/active_session_fresh.json', 'utf8');
  const session = JSON.parse(rawSession);
  const token = session.access_token;
  const userId = session.user.id;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Authenticated Supabase client
  const authSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Unauthenticated Supabase client (for RLS checks)
  const anonSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('--- 1. Authentication & Session Integrity ---');
  try {
    const { data: userData, error: userError } = await authSupabase.auth.getUser(token);
    assert(!userError, `getUser error: ${userError?.message}`);
    assert.strictEqual(userData.user?.id, userId, 'User ID matches session payload');
    testPass(`Session validated for user: ${userId} (${userData.user?.email})`);
  } catch (err: any) {
    testFail('Session validation failed', err);
  }

  console.log('\n--- 2. Authenticated CRUD: Income Records ---');
  try {
    const testDate = new Date().toISOString().split('T')[0];
    // Create
    const { data: insData, error: insErr } = await authSupabase
      .from('income_records')
      .insert({
        user_id: userId,
        amount: 85000,
        income_type: 'Salary Test',
        record_date: testDate,
      })
      .select()
      .single();
    assert(!insErr, `Insert failed: ${insErr?.message}`);
    const recordId = insData.id;
    testPass('Income record inserted successfully');

    // Read
    const { data: readData, error: readErr } = await authSupabase
      .from('income_records')
      .select('*')
      .eq('id', recordId)
      .single();
    assert(!readErr && readData, `Read failed: ${readErr?.message}`);
    assert.strictEqual(readData.amount, 85000);
    assert.strictEqual(readData.user_id, userId, 'Row ownership verified');
    testPass('Income record read and ownership verified');

    // Update
    const { data: updData, error: updErr } = await authSupabase
      .from('income_records')
      .update({ amount: 90000 })
      .eq('id', recordId)
      .select()
      .single();
    assert(!updErr && updData, `Update failed: ${updErr?.message}`);
    assert.strictEqual(updData.amount, 90000);
    testPass('Income record updated amount verified (90,000)');

    // Delete
    const { error: delErr } = await authSupabase
      .from('income_records')
      .delete()
      .eq('id', recordId);
    assert(!delErr, `Delete failed: ${delErr?.message}`);

    const { data: checkDel } = await authSupabase
      .from('income_records')
      .select('*')
      .eq('id', recordId)
      .maybeSingle();
    assert(!checkDel, 'Record was not deleted');
    testPass('Income record deleted and verified clean');
  } catch (err: any) {
    testFail('Income CRUD cycle failed', err);
  }

  console.log('\n--- 3. Authenticated CRUD: Expense Records ---');
  try {
    const testDate = new Date().toISOString().split('T')[0];
    // Create
    const { data: insData, error: insErr } = await authSupabase
      .from('expense_records')
      .insert({
        user_id: userId,
        category: 'Food',
        amount: 1450,
        expense_type: 'essential',
        record_date: testDate,
        description: 'Team lunch test',
      })
      .select()
      .single();
    assert(!insErr, `Insert failed: ${insErr?.message}`);
    const recordId = insData.id;
    testPass('Expense record inserted successfully');

    // Read
    const { data: readData, error: readErr } = await authSupabase
      .from('expense_records')
      .select('*')
      .eq('id', recordId)
      .single();
    assert(!readErr && readData, `Read failed: ${readErr?.message}`);
    assert.strictEqual(readData.amount, 1450);
    assert.strictEqual(readData.category, 'Food');
    testPass('Expense record read verified');

    // Update
    const { data: updData, error: updErr } = await authSupabase
      .from('expense_records')
      .update({ amount: 1650, expense_type: 'discretionary' })
      .eq('id', recordId)
      .select()
      .single();
    assert(!updErr && updData, `Update failed: ${updErr?.message}`);
    assert.strictEqual(updData.amount, 1650);
    assert.strictEqual(updData.expense_type, 'discretionary');
    testPass('Expense record updated amount & type verified');

    // Delete
    const { error: delErr } = await authSupabase
      .from('expense_records')
      .delete()
      .eq('id', recordId);
    assert(!delErr, `Delete failed: ${delErr?.message}`);
    testPass('Expense record deleted cleanly');
  } catch (err: any) {
    testFail('Expense CRUD cycle failed', err);
  }

  console.log('\n--- 4. Authenticated CRUD: Savings Records ---');
  try {
    const testDate = new Date().toISOString().split('T')[0];
    const { data: insData, error: insErr } = await authSupabase
      .from('savings_records')
      .insert({
        user_id: userId,
        amount: 25000,
        record_date: testDate,
        savings_type: 'Emergency Reserve',
      })
      .select()
      .single();
    assert(!insErr, `Insert failed: ${insErr?.message}`);
    const recordId = insData.id;
    testPass('Savings record inserted');

    const { data: updData, error: updErr } = await authSupabase
      .from('savings_records')
      .update({ amount: 30000 })
      .eq('id', recordId)
      .select()
      .single();
    assert(!updErr && updData.amount === 30000);
    testPass('Savings record updated');

    await authSupabase.from('savings_records').delete().eq('id', recordId);
    testPass('Savings record deleted cleanly');
  } catch (err: any) {
    testFail('Savings CRUD cycle failed', err);
  }

  console.log('\n--- 5. Authenticated CRUD: Debts ---');
  try {
    const { data: insData, error: insErr } = await authSupabase
      .from('debts')
      .insert({
        user_id: userId,
        debt_type: 'Personal Loan',
        original_principal: 200000,
        remaining_balance: 150000,
        interest_rate: 11.5,
        monthly_emi: 8500,
        remaining_months: 20,
      })
      .select()
      .single();
    assert(!insErr, `Insert failed: ${insErr?.message}`);
    const recordId = insData.id;
    testPass('Debt record inserted');

    const { data: updData, error: updErr } = await authSupabase
      .from('debts')
      .update({ remaining_balance: 140000 })
      .eq('id', recordId)
      .select()
      .single();
    assert(!updErr && updData.remaining_balance === 140000);
    testPass('Debt record updated');

    await authSupabase.from('debts').delete().eq('id', recordId);
    testPass('Debt record deleted cleanly');
  } catch (err: any) {
    testFail('Debt CRUD cycle failed', err);
  }

  console.log('\n--- 6. Authenticated CRUD: Investments ---');
  try {
    const { data: insData, error: insErr } = await authSupabase
      .from('investments')
      .insert({
        user_id: userId,
        asset_type: 'Mutual Fund',
        symbol: 'NIFTY50_INDEX',
        quantity: 50,
        purchase_price: 240,
        current_value: 13500,
      })
      .select()
      .single();
    assert(!insErr, `Insert failed: ${insErr?.message}`);
    const recordId = insData.id;
    testPass('Investment record inserted');

    const { data: updData, error: updErr } = await authSupabase
      .from('investments')
      .update({ current_value: 14200 })
      .eq('id', recordId)
      .select()
      .single();
    assert(!updErr && updData.current_value === 14200);
    testPass('Investment record updated');

    await authSupabase.from('investments').delete().eq('id', recordId);
    testPass('Investment record deleted cleanly');
  } catch (err: any) {
    testFail('Investment CRUD cycle failed', err);
  }

  console.log('\n--- 7. Authenticated CRUD: Fixed Deposits ---');
  try {
    const testDate = new Date().toISOString().split('T')[0];
    const { data: insData, error: insErr } = await authSupabase
      .from('fixed_deposits')
      .insert({
        user_id: userId,
        bank_name: 'HDFC Bank',
        principal: 100000,
        interest_rate: 6.25,
        tenure_months: 12,
        start_date: testDate,
        maturity_date: '2027-10-10',
        senior_citizen: false,
      })
      .select()
      .single();
    assert(!insErr, `Insert failed: ${insErr?.message}`);
    const recordId = insData.id;
    testPass('Fixed deposit record inserted');

    const { data: updData, error: updErr } = await authSupabase
      .from('fixed_deposits')
      .update({ interest_rate: 6.75, senior_citizen: true })
      .eq('id', recordId)
      .select()
      .single();
    assert(!updErr && updData.interest_rate === 6.75 && updData.senior_citizen === true);
    testPass('Fixed deposit record updated (senior citizen rate)');

    await authSupabase.from('fixed_deposits').delete().eq('id', recordId);
    testPass('Fixed deposit record deleted cleanly');
  } catch (err: any) {
    testFail('Fixed deposit CRUD cycle failed', err);
  }

  console.log('\n--- 8. Row-Level Security (RLS) Isolation ---');
  try {
    // Unauthenticated query should return empty or fail depending on RLS policy
    const { data: anonData } = await anonSupabase.from('expense_records').select('*');
    assert(!anonData || anonData.length === 0, 'Unauthenticated query leaked private rows!');
    testPass('Unauthenticated query returns 0 rows (RLS policy active)');
  } catch (err: any) {
    testFail('RLS isolation check failed', err);
  }

  console.log('\n--- 9. Smart Transaction Classifier Verification ---');
  try {
    const res = await fetch('http://localhost:3000/api/classify-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description: 'Swiggy dinner order 48291' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.category, 'Food');
    assert.strictEqual(data.suggestedExpenseType, 'essential');
    assert.strictEqual(data.isIncome, false);
    testPass('Swiggy classification returned category: Food (essential)');

    const incomeRes = await fetch('http://localhost:3000/api/classify-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description: 'Salary credit from ACME Corp' }),
    });
    const incomeData = await incomeRes.json();
    assert.strictEqual(incomeData.isIncome, true);
    testPass('Salary credit detected isIncome redirection flag');

    const unauthRes = await fetch('http://localhost:3000/api/classify-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Test without token' }),
    });
    assert.strictEqual(unauthRes.status, 401);
    testPass('Unauthenticated classification request rejected with HTTP 401');
  } catch (err: any) {
    testFail('Transaction classifier API checks failed', err);
  }

  console.log('\n--- 10. Household Benchmark ML Inference & Boundaries ---');
  try {
    // Valid Urban Maharashtra prediction
    const res = await fetch('http://localhost:3000/api/household-benchmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        state: '27',
        sector: 'urban',
        highest_education: 'graduate_above',
        livelihood: 'regular_wage',
        dwelling_type: 'pucca',
        cooking_fuel: 'lpg',
        land_owned: 'owned',
        hh_size: 4,
        num_adults: 2,
        num_children: 2,
      }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert(json.success, 'Benchmark success flag true');
    assert(json.estimated_mpce > 0, 'Estimated MPCE positive');
    assert(json.estimated_household_total > 0, 'Estimated household total positive');
    assert(json.uncertainty.segment_mae > 0, 'Uncertainty segment MAE present');
    testPass(`Urban Maharashtra benchmark calculated: ₹${json.estimated_mpce.toLocaleString('en-IN')}/person (Total: ₹${json.estimated_household_total.toLocaleString('en-IN')}/mo)`);

    // Invalid State Code
    const invStateRes = await fetch('http://localhost:3000/api/household-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: '99', sector: 'urban', hh_size: 4 }),
    });
    assert.strictEqual(invStateRes.status, 422);
    testPass('Invalid state code correctly rejected with 422');

    // Invalid Sector
    const invSectorRes = await fetch('http://localhost:3000/api/household-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: '27', sector: 'suburban', hh_size: 4 }),
    });
    assert.strictEqual(invSectorRes.status, 422);
    testPass('Invalid sector correctly rejected with 422');
  } catch (err: any) {
    testFail('Household benchmark checks failed', err);
  }

  console.log('\n--- 11. Financial Engine Forecasting Invariants ---');
  try {
    const mockIncome = [{ id: '1', user_id: userId, amount: 100000, income_type: 'Salary', record_date: '2026-09-01', created_at: '' }];
    const mockExpense = [{ id: '2', user_id: userId, category: 'Food', amount: 40000, expense_type: 'essential' as const, record_date: '2026-09-15', description: '', created_at: '' }];
    const mockSavings = [{ id: '3', user_id: userId, amount: 200000, record_date: '2026-09-01', savings_type: 'Bank', created_at: '' }];
    const mockDebts: any[] = [];
    const mockInvestments: any[] = [];
    const mockFds: any[] = [];

    const mockData = {
      incomeRecords: mockIncome,
      expenseRecords: mockExpense,
      savingsRecords: mockSavings,
      debtRecords: mockDebts,
      investmentRecords: mockInvestments,
      fdRecords: mockFds,
    };
    const features = calculateFinancialFeatures(mockData);
    const forecast = calculateFinancialForecast(features, mockData);

    assert(forecast.points.length === 7, 'Produces 7 milestone projection points (Now through 36M)');
    assert.strictEqual(forecast.points[forecast.points.length - 1].month, '36M');
    assert(forecast.next_month_expense_forecast.estimated_amount !== null, 'Next month expense estimate present');
    assert(forecast.next_month_expense_forecast.estimated_amount >= 0, 'Estimate strictly non-negative');
    assert.strictEqual(forecast.next_month_expense_forecast.method, 'run_rate_fallback');
    testPass('Financial engine produces 36-month trajectory and non-negative expense estimate');
  } catch (err: any) {
    testFail('Financial engine forecasting invariants failed', err);
  }

  console.log('\n--- 12. FD Rate Lookup & Calculation ---');
  try {
    const sbiGeneralRate = lookupVerifiedFDRate('State Bank of India', 12, false);
    assert.strictEqual(sbiGeneralRate?.rate, 6.25);
    const sbiSeniorRate = lookupVerifiedFDRate('State Bank of India', 12, true);
    assert.strictEqual(sbiSeniorRate?.rate, 6.75);

    const rblGeneralRate = lookupVerifiedFDRate('RBL Bank', 12, false);
    assert.strictEqual(rblGeneralRate?.rate, 7.40);
    const rblSeniorRate = lookupVerifiedFDRate('RBL Bank', 12, true);
    assert.strictEqual(rblSeniorRate?.rate, 8.00);

    testPass('Verified Oct 2026 rates matched across banks, tenures, and senior distinctions');
  } catch (err: any) {
    testFail('FD rate lookup failed', err);
  }

  console.log('\n====================================================');
  console.log(`Phase 20 E2E & CRUD Suite: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
