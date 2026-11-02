import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/supabase/types';
import {
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
  OlapTimeGrain,
  OlapPivotDimension,
  OlapMeasureKey,
  OlapDiceCriteria,
  OlapSliceFilter,
  IncomeRow,
  ExpenseRow,
  SavingsRow,
  FinancialHistoryRow,
  DebtRow,
  InvestmentRow,
  FDRow,
} from '@/lib/olap-engine';

export const dynamic = 'force-dynamic';

function getSupabaseServerClient(token?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
}

async function authenticateRequest(request: Request): Promise<{ token: string; userId: string; email: string } | null> {
  let token: string | undefined;

  // 1. Check Bearer Authorization Header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  // 2. Check cookies fallback
  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get('sb-access-token')?.value;
    } catch {
      // Cookies not accessible in current context
    }
  }

  if (!token) return null;

  try {
    const supabase = getSupabaseServerClient(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;

    return {
      token,
      userId: data.user.id,
      email: data.user.email || '',
    };
  } catch (err) {
    console.error('Authentication verification exception:', err);
    return null;
  }
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized. An authenticated session is required to access OLAP analytics.' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseServerClient(auth.token);
    const { searchParams } = new URL(request.url);
    const grain = (searchParams.get('grain') as OlapTimeGrain) || 'month';
    const cube = searchParams.get('cube') || 'transactions';
    const startDate = searchParams.get('startDate') || searchParams.get('start') || undefined;
    const endDate = searchParams.get('endDate') || searchParams.get('end') || undefined;
    const rawLimit = parseInt(searchParams.get('limit') || '1000', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 5000) : 1000;

    // Bounded queries preserving RLS, tracking exact record totals, and preventing unbounded transfers
    let incomeQuery = (supabase.from('income_records') as any)
      .select('id, user_id, amount, income_type, record_date, created_at', { count: 'exact' })
      .eq('user_id', auth.userId);
    let expenseQuery = (supabase.from('expense_records') as any)
      .select('id, user_id, category, amount, expense_type, record_date, description, created_at', { count: 'exact' })
      .eq('user_id', auth.userId);
    let savingsQuery = (supabase.from('savings_records') as any)
      .select('id, user_id, amount, record_date, savings_type, created_at', { count: 'exact' })
      .eq('user_id', auth.userId);

    if (startDate) {
      incomeQuery = incomeQuery.gte('record_date', startDate);
      expenseQuery = expenseQuery.gte('record_date', startDate);
      savingsQuery = savingsQuery.gte('record_date', startDate);
    }
    if (endDate) {
      incomeQuery = incomeQuery.lte('record_date', endDate);
      expenseQuery = expenseQuery.lte('record_date', endDate);
      savingsQuery = savingsQuery.lte('record_date', endDate);
    }

    const [incomeRes, expenseRes, savingsRes, historyRes] = await Promise.all([
      incomeQuery.order('record_date', { ascending: false }).limit(limit),
      expenseQuery.order('record_date', { ascending: false }).limit(limit),
      savingsQuery.order('record_date', { ascending: false }).limit(limit),
      (supabase.from('financial_history') as any)
        .select('*')
        .eq('user_id', auth.userId)
        .order('month', { ascending: true })
        .limit(240),
    ]);

    const incomeRows = (incomeRes.data as IncomeRow[]) || [];
    const expenseRows = (expenseRes.data as ExpenseRow[]) || [];
    const savingsRows = (savingsRes.data as SavingsRow[]) || [];
    const historyRows = (historyRes.data as FinancialHistoryRow[]) || [];

    // Verify dataset completeness against database-side exact counts
    const totalIncomeCount = incomeRes.count ?? incomeRows.length;
    const totalExpenseCount = expenseRes.count ?? expenseRows.length;
    const totalSavingsCount = savingsRes.count ?? savingsRows.length;

    const isCapped =
      incomeRows.length < totalIncomeCount ||
      expenseRows.length < totalExpenseCount ||
      savingsRows.length < totalSavingsCount;

    const dataIntegrity = {
      isCapped,
      limitApplied: limit,
      counts: {
        income: { loaded: incomeRows.length, total: totalIncomeCount },
        expenses: { loaded: expenseRows.length, total: totalExpenseCount },
        savings: { loaded: savingsRows.length, total: totalSavingsCount },
      },
      warning: isCapped
        ? `Analytical dataset capped to ${limit} records per stream. Aggregate totals reflect the most recent records within the selected range. To ensure completeness, filter by a narrower date range.`
        : null,
    };

    // Build Transaction Facts
    const facts = buildTransactionFacts(incomeRows, expenseRows, savingsRows);
    const measures = calculateMeasures(facts);
    const rollup = rollupOlap(facts, grain);
    const reconciliation = reconcileOlapTotals(incomeRows, expenseRows, facts);

    // Build Snapshot Facts
    const snapshots = buildSnapshotFacts(historyRows);

    return NextResponse.json({
      success: true,
      cube,
      grain,
      measures,
      rollup,
      reconciliation,
      dataIntegrity,
      snapshots: {
        hasSnapshots: snapshots.length > 0,
        count: snapshots.length,
        items: snapshots,
      },
    });
  } catch (err: unknown) {
    console.error('OLAP GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal OLAP analytics error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized. An authenticated session is required to execute OLAP queries.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'query';
    const supabase = getSupabaseServerClient(auth.token);

    // --- Action: Create Authentic Monthly Snapshot ---
    if (action === 'create_snapshot') {
      const targetMonth = body.month || new Date().toISOString().slice(0, 7); // 'YYYY-MM'

      // Gather current verified records for accurate point-in-time snapshot
      const [incomeRes, expenseRes, savingsRes, debtRes, investRes, fdRes] = await Promise.all([
        (supabase.from('income_records') as any).select('*').eq('user_id', auth.userId),
        (supabase.from('expense_records') as any).select('*').eq('user_id', auth.userId),
        (supabase.from('savings_records') as any).select('*').eq('user_id', auth.userId),
        (supabase.from('debts') as any).select('*').eq('user_id', auth.userId),
        (supabase.from('investments') as any).select('*').eq('user_id', auth.userId),
        (supabase.from('fixed_deposits') as any).select('*').eq('user_id', auth.userId),
      ]);

      const inRecords = (incomeRes.data as IncomeRow[]) || [];
      const expRecords = (expenseRes.data as ExpenseRow[]) || [];
      const savRecords = (savingsRes.data as SavingsRow[]) || [];
      const dbtRecords = (debtRes.data as DebtRow[]) || [];
      const invRecords = (investRes.data as InvestmentRow[]) || [];
      const fxdRecords = (fdRes.data as FDRow[]) || [];

      // Filter transactions belonging to targetMonth for the flow components
      const monthInflow = inRecords
        .filter((r) => r.record_date && r.record_date.startsWith(targetMonth))
        .reduce((s, r) => s + Number(r.amount || 0), 0);

      const monthOutflow = expRecords
        .filter((r) => r.record_date && r.record_date.startsWith(targetMonth))
        .reduce((s, r) => s + Number(r.amount || 0), 0);

      const balanceSheet = evaluateCurrentBalanceSheetState(
        savRecords,
        dbtRecords,
        invRecords,
        fxdRecords
      );

      const snapshotPayload = {
        user_id: auth.userId,
        month: targetMonth,
        income: Math.round(monthInflow * 100) / 100,
        expenses: Math.round(monthOutflow * 100) / 100,
        savings: balanceSheet.currentSavings,
        debt: balanceSheet.totalDebt,
        investments: balanceSheet.investmentValue,
        fd_value: balanceSheet.fdValue,
        net_worth: balanceSheet.currentNetWorth,
      };

      // Atomic Supabase upsert on matching conflict columns (user_id, month)
      // This eliminates TOCTOU race conditions and guarantees idempotency.
      const { data: upsertedSnapshot, error: upsertErr } = await (supabase.from('financial_history') as any)
        .upsert(snapshotPayload, { onConflict: 'user_id,month' })
        .select()
        .single();

      if (upsertErr) {
        // Fallback for resilient handling if remote unique constraint is pending migration execution
        if (upsertErr.message?.includes('conflict') || upsertErr.code === '42P10') {
          const { data: existingSnapshots } = await (supabase.from('financial_history') as any)
            .select('id')
            .eq('user_id', auth.userId)
            .eq('month', targetMonth)
            .order('created_at', { ascending: false });

          if (existingSnapshots && existingSnapshots.length > 0) {
            const { data: updated, error: updErr } = await (supabase.from('financial_history') as any)
              .update(snapshotPayload)
              .eq('id', existingSnapshots[0].id)
              .select()
              .single();
            if (updErr) throw updErr;
            return NextResponse.json({
              success: true,
              message: `Monthly financial snapshot for ${targetMonth} updated successfully.`,
              snapshot: updated,
            });
          } else {
            const { data: inserted, error: insErr } = await (supabase.from('financial_history') as any)
              .insert(snapshotPayload)
              .select()
              .single();
            if (insErr) throw insErr;
            return NextResponse.json({
              success: true,
              message: `Monthly financial snapshot for ${targetMonth} recorded successfully.`,
              snapshot: inserted,
            });
          }
        }
        throw upsertErr;
      }

      return NextResponse.json({
        success: true,
        message: `Monthly financial snapshot for ${targetMonth} recorded successfully.`,
        snapshot: upsertedSnapshot,
      });
    }

    // --- Action: Standard Multi-Dimensional OLAP Query ---
    const grain: OlapTimeGrain = body.grain || 'month';
    const cube: 'transactions' | 'snapshots' | 'both' = body.cube || 'both';
    const dateRange = body.dateRange as { start?: string; end?: string } | undefined;
    const sliceFilter = body.sliceFilter as OlapSliceFilter | undefined;
    const diceCriteria = body.diceCriteria as OlapDiceCriteria | undefined;
    const pivotConfig = body.pivot as
      | { rowDimension: OlapPivotDimension; columnDimension: OlapPivotDimension; measure?: OlapMeasureKey }
      | undefined;
    const drilldownConfig = body.drilldown as
      | { grain: OlapTimeGrain; value: string | number; secondaryDimension: 'category' | 'expense_type' | 'activity' | 'income_type' }
      | undefined;

    const rawLimit = parseInt(body.limit || '1000', 10);
    const queryLimit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 5000) : 1000;

    // 1. Query Transaction Cube records with date range bounds if provided
    let incomeQuery = (supabase.from('income_records') as any)
      .select('id, user_id, amount, income_type, record_date, created_at', { count: 'exact' })
      .eq('user_id', auth.userId);
    let expenseQuery = (supabase.from('expense_records') as any)
      .select('id, user_id, category, amount, expense_type, record_date, description, created_at', { count: 'exact' })
      .eq('user_id', auth.userId);
    let savingsQuery = (supabase.from('savings_records') as any)
      .select('id, user_id, amount, record_date, savings_type, created_at', { count: 'exact' })
      .eq('user_id', auth.userId);

    if (dateRange?.start) {
      incomeQuery = incomeQuery.gte('record_date', dateRange.start);
      expenseQuery = expenseQuery.gte('record_date', dateRange.start);
      savingsQuery = savingsQuery.gte('record_date', dateRange.start);
    }
    if (dateRange?.end) {
      incomeQuery = incomeQuery.lte('record_date', dateRange.end);
      expenseQuery = expenseQuery.lte('record_date', dateRange.end);
      savingsQuery = savingsQuery.lte('record_date', dateRange.end);
    }

    const [incomeRes, expenseRes, savingsRes, historyRes, debtRes, investRes, fdRes] = await Promise.all([
      incomeQuery.order('record_date', { ascending: false }).limit(queryLimit),
      expenseQuery.order('record_date', { ascending: false }).limit(queryLimit),
      savingsQuery.order('record_date', { ascending: false }).limit(queryLimit),
      (supabase.from('financial_history') as any)
        .select('*')
        .eq('user_id', auth.userId)
        .order('month', { ascending: true })
        .limit(240),
      (supabase.from('debts') as any).select('*').eq('user_id', auth.userId).limit(200),
      (supabase.from('investments') as any).select('*').eq('user_id', auth.userId).limit(200),
      (supabase.from('fixed_deposits') as any).select('*').eq('user_id', auth.userId).limit(200),
    ]);

    const rawIncome = (incomeRes.data as IncomeRow[]) || [];
    const rawExpenses = (expenseRes.data as ExpenseRow[]) || [];
    const rawSavings = (savingsRes.data as SavingsRow[]) || [];
    const rawHistory = (historyRes.data as FinancialHistoryRow[]) || [];
    const rawDebts = (debtRes.data as DebtRow[]) || [];
    const rawInvestments = (investRes.data as InvestmentRow[]) || [];
    const rawFDs = (fdRes.data as FDRow[]) || [];

    // Verify dataset completeness against database-side exact counts
    const totalIncomeCount = incomeRes.count ?? rawIncome.length;
    const totalExpenseCount = expenseRes.count ?? rawExpenses.length;
    const totalSavingsCount = savingsRes.count ?? rawSavings.length;

    const isCapped =
      rawIncome.length < totalIncomeCount ||
      rawExpenses.length < totalExpenseCount ||
      rawSavings.length < totalSavingsCount;

    const dataIntegrity = {
      isCapped,
      limitApplied: queryLimit,
      counts: {
        income: { loaded: rawIncome.length, total: totalIncomeCount },
        expenses: { loaded: rawExpenses.length, total: totalExpenseCount },
        savings: { loaded: rawSavings.length, total: totalSavingsCount },
      },
      warning: isCapped
        ? `Analytical dataset capped to ${queryLimit} records per stream. Aggregate totals reflect the most recent records within the selected range. To ensure completeness, filter by a narrower date range.`
        : null,
    };

    // 2. Build Transaction Facts
    let facts = buildTransactionFacts(rawIncome, rawExpenses, rawSavings);

    // Apply Slice Filter if specified
    if (sliceFilter && sliceFilter.dimension && sliceFilter.value !== undefined) {
      facts = sliceOlap(facts, sliceFilter);
    }

    // Apply Dice Criteria if specified
    if (diceCriteria) {
      facts = diceOlap(facts, diceCriteria);
    }

    // Measure computation over active facts
    const measures = calculateMeasures(facts);
    const rollup = rollupOlap(facts, grain);
    const reconciliation = reconcileOlapTotals(rawIncome, rawExpenses, facts);

    // Pivot Matrix Computation
    let pivotResult = null;
    if (pivotConfig?.rowDimension && pivotConfig?.columnDimension) {
      pivotResult = pivotOlap(
        facts,
        pivotConfig.rowDimension,
        pivotConfig.columnDimension,
        pivotConfig.measure || 'total_expenses'
      );
    }

    // Drilldown Computation
    let drilldownResult = null;
    if (drilldownConfig) {
      drilldownResult = drilldownOlap(
        facts,
        { grain: drilldownConfig.grain, value: drilldownConfig.value },
        drilldownConfig.secondaryDimension
      );
    }

    // 3. Build Snapshot Facts (Cube 2)
    const snapshotFacts = buildSnapshotFacts(rawHistory);

    // Current Balance Sheet State (strictly isolated as point-in-time live snapshot)
    const currentBalanceSheet = evaluateCurrentBalanceSheetState(
      rawSavings,
      rawDebts,
      rawInvestments,
      rawFDs
    );

    return NextResponse.json({
      success: true,
      cube,
      grain,
      measures,
      rollup,
      reconciliation,
      dataIntegrity,
      pivot: pivotResult,
      drilldown: drilldownResult,
      factsCount: facts.length,
      snapshots: {
        hasSnapshots: snapshotFacts.length > 0,
        count: snapshotFacts.length,
        items: snapshotFacts,
        currentLiveState: {
          ...currentBalanceSheet,
          note: 'Current point-in-time balance sheet position. Not a historical trend.',
        },
      },
    });
  } catch (err: unknown) {
    console.error('OLAP POST query exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal OLAP execution exception' },
      { status: 500 }
    );
  }
}
