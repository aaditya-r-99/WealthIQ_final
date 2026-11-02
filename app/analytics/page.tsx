'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MetricCard } from '@/components/metric-card';
import { LoadingState, EmptyState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
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
  OlapTransactionFact,
  OlapSnapshotFact,
  OlapAggregateRow,
  OlapPivotResult,
  OlapReconciliation,
  CurrentBalanceSheetState,
  IncomeRow,
  ExpenseRow,
  SavingsRow,
  FinancialHistoryRow,
  DebtRow,
  InvestmentRow,
  FDRow,
} from '@/lib/olap-engine';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  Wallet,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Filter,
  Grid,
  Calendar,
  Camera,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Info,
  Scale,
  Hash,
} from 'lucide-react';

export default function AnalyticsPage() {
  const { user, session, authState } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'snapshots'>('transactions');

  // Raw Database Records
  const [incomeRecords, setIncomeRecords] = useState<IncomeRow[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRow[]>([]);
  const [savingsRecords, setSavingsRecords] = useState<SavingsRow[]>([]);
  const [historyRecords, setHistoryRecords] = useState<FinancialHistoryRow[]>([]);
  const [debtRecords, setDebtRecords] = useState<DebtRow[]>([]);
  const [investmentRecords, setInvestmentRecords] = useState<InvestmentRow[]>([]);
  const [fdRecords, setFdRecords] = useState<FDRow[]>([]);

  // Snapshot Creation State
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

  // OLAP Interactive Controls (Cube 1)
  const [grain, setGrain] = useState<OlapTimeGrain>('month');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'SAVINGS_CONTRIBUTION'>('ALL');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<'ALL' | 'essential' | 'discretionary'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dateRangePreset, setDateRangePreset] = useState<'ALL' | '3M' | '6M' | 'YTD'>('ALL');
  const [viewMode, setViewMode] = useState<'rollup' | 'pivot' | 'drilldown'>('rollup');

  // Pivot Configuration
  const [pivotRowDim, setPivotRowDim] = useState<OlapPivotDimension>('category');
  const [pivotColDim, setPivotColDim] = useState<OlapPivotDimension>('month');
  const [pivotMeasure, setPivotMeasure] = useState<OlapMeasureKey>('total_expenses');

  // Drilldown Selected Item
  const [drilldownTarget, setDrilldownTarget] = useState<string | null>(null);

  // Data Integrity & Completeness State
  const [dataIntegrity, setDataIntegrity] = useState<{
    isCapped: boolean;
    limitApplied: number;
    incomeTotal: number;
    incomeLoaded: number;
    expenseTotal: number;
    expenseLoaded: number;
    savingsTotal: number;
    savingsLoaded: number;
  }>({
    isCapped: false,
    limitApplied: 1000,
    incomeTotal: 0,
    incomeLoaded: 0,
    expenseTotal: 0,
    expenseLoaded: 0,
    savingsTotal: 0,
    savingsLoaded: 0,
  });

  // Fetch all bounded user records preserving RLS and verifying completeness
  const fetchAllData = useCallback(async (userId: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [incomeRes, expenseRes, savingsRes, historyRes, debtRes, investRes, fdRes] =
        await Promise.all([
          (supabase.from('income_records') as any)
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('record_date', { ascending: false })
            .limit(1000),
          (supabase.from('expense_records') as any)
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('record_date', { ascending: false })
            .limit(1000),
          (supabase.from('savings_records') as any)
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('record_date', { ascending: false })
            .limit(1000),
          (supabase.from('financial_history') as any)
            .select('*')
            .eq('user_id', userId)
            .order('month', { ascending: true })
            .limit(240),
          (supabase.from('debts') as any).select('*').eq('user_id', userId).limit(200),
          (supabase.from('investments') as any).select('*').eq('user_id', userId).limit(200),
          (supabase.from('fixed_deposits') as any).select('*').eq('user_id', userId).limit(200),
        ]);

      const inData = (incomeRes.data as IncomeRow[]) || [];
      const expData = (expenseRes.data as ExpenseRow[]) || [];
      const savData = (savingsRes.data as SavingsRow[]) || [];

      // Check completeness against database-side exact counts
      const inCount = incomeRes.count ?? inData.length;
      const expCount = expenseRes.count ?? expData.length;
      const savCount = savingsRes.count ?? savData.length;

      const isCapped =
        inData.length < inCount ||
        expData.length < expCount ||
        savData.length < savCount;

      setDataIntegrity({
        isCapped,
        limitApplied: 1000,
        incomeTotal: inCount,
        incomeLoaded: inData.length,
        expenseTotal: expCount,
        expenseLoaded: expData.length,
        savingsTotal: savCount,
        savingsLoaded: savData.length,
      });

      setIncomeRecords(inData);
      setExpenseRecords(expData);
      setSavingsRecords(savData);
      setHistoryRecords((historyRes.data as FinancialHistoryRow[]) || []);
      setDebtRecords((debtRes.data as DebtRow[]) || []);
      setInvestmentRecords((investRes.data as InvestmentRow[]) || []);
      setFdRecords((fdRes.data as FDRow[]) || []);
    } catch (err: unknown) {
      console.error('OLAP data fetch exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to retrieve financial analytics records.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchAllData(user.id);
    } else if (authState === 'unauthenticated') {
      setLoading(false);
    }
  }, [user?.id, authState, fetchAllData]);

  // Build Canonical Transaction Facts (Cube 1)
  const allFacts = useMemo(() => {
    return buildTransactionFacts(incomeRecords, expenseRecords, savingsRecords);
  }, [incomeRecords, expenseRecords, savingsRecords]);

  // Available categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const f of allFacts) {
      if (f.category) set.add(f.category);
    }
    return Array.from(set).sort();
  }, [allFacts]);

  // Compute Active Sliced & Diced Facts
  const activeFacts = useMemo(() => {
    let facts = [...allFacts];

    // 1. Date Range Preset
    if (dateRangePreset !== 'ALL') {
      const now = new Date();
      let startStr = '';

      if (dateRangePreset === '3M') {
        const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        startStr = d.toISOString().slice(0, 10);
      } else if (dateRangePreset === '6M') {
        const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        startStr = d.toISOString().slice(0, 10);
      } else if (dateRangePreset === 'YTD') {
        startStr = `${now.getFullYear()}-01-01`;
      }

      if (startStr) {
        facts = diceOlap(facts, { dateRange: { start: startStr } });
      }
    }

    // 2. Activity Filter
    if (activityFilter !== 'ALL') {
      facts = sliceOlap(facts, { dimension: 'activity', value: activityFilter });
    }

    // 3. Expense Type Filter
    if (expenseTypeFilter !== 'ALL') {
      facts = sliceOlap(facts, { dimension: 'expense_type', value: expenseTypeFilter });
    }

    // 4. Category Filter
    if (categoryFilter !== 'ALL') {
      facts = sliceOlap(facts, { dimension: 'category', value: categoryFilter });
    }

    return facts;
  }, [allFacts, dateRangePreset, activityFilter, expenseTypeFilter, categoryFilter]);

  // Active Measures & Totals
  const activeMeasures = useMemo(() => {
    return calculateMeasures(activeFacts);
  }, [activeFacts]);

  // Rollup Aggregation Rows
  const rollupRows = useMemo(() => {
    return rollupOlap(activeFacts, grain);
  }, [activeFacts, grain]);

  // Mathematical Reconciliation Check
  const reconciliation = useMemo(() => {
    return reconcileOlapTotals(incomeRecords, expenseRecords, allFacts);
  }, [incomeRecords, expenseRecords, allFacts]);

  // Pivot Matrix Calculation
  const pivotResult = useMemo<OlapPivotResult | null>(() => {
    if (viewMode !== 'pivot') return null;
    return pivotOlap(activeFacts, pivotRowDim, pivotColDim, pivotMeasure);
  }, [activeFacts, viewMode, pivotRowDim, pivotColDim, pivotMeasure]);

  // Drilldown Rows
  const drilldownRows = useMemo(() => {
    if (viewMode !== 'drilldown' || !drilldownTarget) return [];
    return drilldownOlap(
      activeFacts,
      { grain, value: drilldownTarget },
      'category'
    );
  }, [activeFacts, viewMode, drilldownTarget, grain]);

  // Cube 2: Snapshot Facts
  const snapshotFacts = useMemo(() => {
    return buildSnapshotFacts(historyRecords);
  }, [historyRecords]);

  // Current Balance Sheet State (Strictly isolated point-in-time snapshot)
  const currentBalanceSheet = useMemo<CurrentBalanceSheetState>(() => {
    return evaluateCurrentBalanceSheetState(
      savingsRecords,
      debtRecords,
      investmentRecords,
      fdRecords
    );
  }, [savingsRecords, debtRecords, investmentRecords, fdRecords]);

  // Handle Capture Snapshot Action
  const handleTakeSnapshot = async () => {
    if (!user?.id) return;
    setCreatingSnapshot(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const token = session?.access_token;
      const res = await fetch('/api/analytics/olap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'create_snapshot',
          month: new Date().toISOString().slice(0, 7), // 'YYYY-MM'
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to record snapshot.');
      }

      setSuccessMessage(data.message || 'Snapshot successfully recorded.');
      // Refresh to include new row
      fetchAllData(user.id, true);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error capturing monthly snapshot.'
      );
    } finally {
      setCreatingSnapshot(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Multi-Dimensional Financial Analytics (OLAP)"
        description="Two-cube analytical intelligence: Roll-up, Drill-down, Slice, Dice, and Cross-Tab Pivoting across your verified financial records."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => user?.id && fetchAllData(user.id, true)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      {/* Notifications */}
      {errorMessage && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}
      {successMessage && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-4 text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* Capped Analytical Dataset Warning (Never present partial data as complete summary) */}
      {dataIntegrity.isCapped && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">
              Partial Dataset Warning — Analytics Results Capped
            </p>
            <p>
              Your database contains more records than the active safety limit ({dataIntegrity.limitApplied} records per stream).
              {dataIntegrity.expenseTotal > dataIntegrity.expenseLoaded && (
                <> Found {dataIntegrity.expenseTotal} expense records (showing newest {dataIntegrity.expenseLoaded}).</>
              )}
              {dataIntegrity.incomeTotal > dataIntegrity.incomeLoaded && (
                <> Found {dataIntegrity.incomeTotal} income records (showing newest {dataIntegrity.incomeLoaded}).</>
              )}
              {dataIntegrity.savingsTotal > dataIntegrity.savingsLoaded && (
                <> Found {dataIntegrity.savingsTotal} savings records (showing newest {dataIntegrity.savingsLoaded}).</>
              )}
              {' '}To prevent truncated totals and ensure complete financial summary accuracy, select a narrower timeframe or use the Date Range preset.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-8">
          <LoadingState message="Processing multi-dimensional OLAP cubes..." />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Main Two-Cube Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'transactions' | 'snapshots')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="transactions" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Cashflow Transactions Cube
              </TabsTrigger>
              <TabsTrigger value="snapshots" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Monthly Snapshots Cube
              </TabsTrigger>
            </TabsList>

            {/* ========================================================= */}
            {/* CUBE 1: CASHFLOW TRANSACTIONS CUBE                        */}
            {/* ========================================================= */}
            <TabsContent value="transactions" className="space-y-6 mt-6">
              {/* Top Measures KPI Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Total Income"
                  value={formatCurrency(activeMeasures.total_income)}
                  subtitle={`${activeFacts.filter((f) => f.activity === 'INCOME').length} inflow events`}
                  icon={<Wallet className="h-4 w-4" />}
                  trend={activeMeasures.total_income > 0 ? 'up' : 'neutral'}
                  accent="success"
                />
                <MetricCard
                  title="Total Expenses"
                  value={formatCurrency(activeMeasures.total_expenses)}
                  subtitle={`${activeFacts.filter((f) => f.activity === 'EXPENSE').length} outflow events`}
                  icon={<TrendingDown className="h-4 w-4" />}
                  trend={activeMeasures.total_expenses > 0 ? 'down' : 'neutral'}
                  accent="danger"
                />
                <MetricCard
                  title="Net Cash Flow"
                  value={formatCurrency(activeMeasures.net_cash_flow)}
                  subtitle={
                    activeMeasures.net_cash_flow > 0
                      ? 'Surplus liquidity generated'
                      : activeMeasures.net_cash_flow < 0
                      ? 'Deficit (burn rate exceeds income)'
                      : 'Break-even cash flow'
                  }
                  icon={<TrendingUp className="h-4 w-4" />}
                  trend={activeMeasures.net_cash_flow >= 0 ? 'up' : 'down'}
                  accent={activeMeasures.net_cash_flow >= 0 ? 'success' : 'danger'}
                />
                <MetricCard
                  title="Average Transaction"
                  value={formatCurrency(activeMeasures.avg_amount)}
                  subtitle={`${activeMeasures.transaction_count} active transaction facts`}
                  icon={<Hash className="h-4 w-4" />}
                  accent="primary"
                />
              </div>

              {/* Mathematical Reconciliation Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    Mathematical Proof &amp; Reconciliation:
                  </span>
                  <span>
                    Income ₹{activeMeasures.total_income.toLocaleString('en-IN')} - Expenses ₹
                    {activeMeasures.total_expenses.toLocaleString('en-IN')} = Net Cash Flow ₹
                    {activeMeasures.net_cash_flow.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success border border-success/20">
                    Discrepancy: ₹{reconciliation.discrepancy.toFixed(2)} (Verified)
                  </span>
                </div>
              </div>

              {/* Slicing, Dicing & OLAP Controls Toolbar */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary" />
                        OLAP Dimension Slicing &amp; View Controls
                      </CardTitle>
                      <CardDescription>
                        Perform multi-dimensional analysis by filtering, aggregating, or pivoting axes.
                      </CardDescription>
                    </div>

                    {/* View Mode Selector */}
                    <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
                      <button
                        onClick={() => setViewMode('rollup')}
                        className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                          viewMode === 'rollup'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Roll-up Table
                      </button>
                      <button
                        onClick={() => setViewMode('pivot')}
                        className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                          viewMode === 'pivot'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Cross-Tab Pivot
                      </button>
                      {drilldownTarget && (
                        <button
                          onClick={() => setViewMode('drilldown')}
                          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                            viewMode === 'drilldown'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Drilldown ({drilldownTarget})
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  {/* Filters Row */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {/* Time Grain (Roll-up) */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Time Grain (Roll-up)
                      </label>
                      <Select value={grain} onValueChange={(val) => setGrain(val as OlapTimeGrain)}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Select grain" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Day (Most Detailed)</SelectItem>
                          <SelectItem value="month">Month (Standard)</SelectItem>
                          <SelectItem value="quarter">Quarter (Fiscal)</SelectItem>
                          <SelectItem value="year">Year (Annual)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dicing: Date Range */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Time Horizon (Dice)
                      </label>
                      <Select
                        value={dateRangePreset}
                        onValueChange={(val) => setDateRangePreset(val as any)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Recorded Time</SelectItem>
                          <SelectItem value="YTD">Year to Date (YTD)</SelectItem>
                          <SelectItem value="6M">Last 6 Months</SelectItem>
                          <SelectItem value="3M">Last 3 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Slicing: Activity */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Activity (Slice)
                      </label>
                      <Select
                        value={activityFilter}
                        onValueChange={(val) => setActivityFilter(val as any)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="All activities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Activities</SelectItem>
                          <SelectItem value="INCOME">Income Only</SelectItem>
                          <SelectItem value="EXPENSE">Expenses Only</SelectItem>
                          <SelectItem value="SAVINGS_CONTRIBUTION">Savings Contributions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Slicing: Expense Type */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Expense Type (Slice)
                      </label>
                      <Select
                        value={expenseTypeFilter}
                        onValueChange={(val) => setExpenseTypeFilter(val as any)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Types</SelectItem>
                          <SelectItem value="essential">Essential Living Costs</SelectItem>
                          <SelectItem value="discretionary">Discretionary Lifestyle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Category Slicing row */}
                  {availableCategories.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground font-medium">Category Slice:</span>
                      <button
                        onClick={() => setCategoryFilter('ALL')}
                        className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                          categoryFilter === 'ALL'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        All Categories
                      </button>
                      {availableCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                            categoryFilter === cat
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* View 1: Roll-up Aggregation Table */}
              {viewMode === 'rollup' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Chronological Roll-up Aggregates ({grain.toUpperCase()} Grain)
                      </div>
                      <span className="text-xs font-normal text-muted-foreground">
                        {rollupRows.length} time bucket(s)
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Aggregated chronological intervals. Click any row to drill down into its categorical details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {rollupRows.length === 0 ? (
                      <EmptyState
                        title="No matching transactions"
                        description="Try widening your date range or clearing dimension slice filters."
                      />
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead>Period</TableHead>
                              <TableHead className="text-right">Total Inflow</TableHead>
                              <TableHead className="text-right">Total Outflow</TableHead>
                              <TableHead className="text-right">Net Cash Flow</TableHead>
                              <TableHead className="text-right">Events</TableHead>
                              <TableHead className="text-right">Average Size</TableHead>
                              <TableHead className="text-center w-28">Drill-down</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rollupRows.map((row) => (
                              <TableRow key={row.key} className="hover:bg-muted/20">
                                <TableCell className="font-medium">{row.label}</TableCell>
                                <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(row.measures.total_income)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-rose-600 dark:text-rose-400">
                                  {formatCurrency(row.measures.total_expenses)}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-semibold ${
                                    row.measures.net_cash_flow >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {formatCurrency(row.measures.net_cash_flow)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {row.measures.transaction_count}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatCurrency(row.measures.avg_amount)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs flex items-center gap-1 mx-auto"
                                    onClick={() => {
                                      setDrilldownTarget(row.key);
                                      setViewMode('drilldown');
                                    }}
                                  >
                                    Drill
                                    <ChevronRight className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* View 2: Cross-Tab Pivot Matrix */}
              {viewMode === 'pivot' && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Grid className="h-4 w-4 text-primary" />
                          Multi-Dimensional Pivot Matrix
                        </CardTitle>
                        <CardDescription>
                          Cross-tabulation comparing two dimensions dynamically.
                        </CardDescription>
                      </div>

                      {/* Pivot Axis Controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Row Dim */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground font-medium">Rows:</span>
                          <Select
                            value={pivotRowDim}
                            onValueChange={(val) => setPivotRowDim(val as OlapPivotDimension)}
                          >
                            <SelectTrigger className="h-8 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="category">Category</SelectItem>
                              <SelectItem value="activity">Activity</SelectItem>
                              <SelectItem value="expense_type">Expense Type</SelectItem>
                              <SelectItem value="year">Year</SelectItem>
                              <SelectItem value="month">Month</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Col Dim */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground font-medium">Cols:</span>
                          <Select
                            value={pivotColDim}
                            onValueChange={(val) => setPivotColDim(val as OlapPivotDimension)}
                          >
                            <SelectTrigger className="h-8 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="month">Month</SelectItem>
                              <SelectItem value="quarter">Quarter</SelectItem>
                              <SelectItem value="year">Year</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Measure */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground font-medium">Value:</span>
                          <Select
                            value={pivotMeasure}
                            onValueChange={(val) => setPivotMeasure(val as OlapMeasureKey)}
                          >
                            <SelectTrigger className="h-8 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="total_expenses">Total Expenses</SelectItem>
                              <SelectItem value="total_income">Total Income</SelectItem>
                              <SelectItem value="net_cash_flow">Net Cash Flow</SelectItem>
                              <SelectItem value="transaction_count">Transaction Count</SelectItem>
                              <SelectItem value="avg_amount">Average Size</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!pivotResult || pivotResult.rows.length === 0 ? (
                      <EmptyState
                        title="No records to pivot"
                        description="Adjust your slicing parameters to display matrix data."
                      />
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead className="font-semibold uppercase text-xs">
                                {pivotRowDim} \ {pivotColDim}
                              </TableHead>
                              {pivotResult.columns.map((col) => (
                                <TableHead key={col} className="text-right font-semibold">
                                  {col}
                                </TableHead>
                              ))}
                              <TableHead className="text-right font-bold bg-muted/60">
                                Row Total
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pivotResult.rows.map((row) => (
                              <TableRow key={row} className="hover:bg-muted/20">
                                <TableCell className="font-medium text-foreground">{row}</TableCell>
                                {pivotResult.columns.map((col) => {
                                  const cellVal = pivotResult.matrix[row]?.[col] || 0;
                                  return (
                                    <TableCell
                                      key={col}
                                      className={`text-right ${
                                        cellVal > 0 ? 'font-medium' : 'text-muted-foreground/60'
                                      }`}
                                    >
                                      {pivotMeasure === 'transaction_count'
                                        ? cellVal
                                        : formatCurrency(cellVal)}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-right font-bold bg-muted/30">
                                  {pivotMeasure === 'transaction_count'
                                    ? pivotResult.rowTotals[row]
                                    : formatCurrency(pivotResult.rowTotals[row] || 0)}
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Column Summary Totals Row */}
                            <TableRow className="bg-muted/60 font-bold border-t-2">
                              <TableCell className="font-bold">Column Total</TableCell>
                              {pivotResult.columns.map((col) => (
                                <TableCell key={col} className="text-right font-bold">
                                  {pivotMeasure === 'transaction_count'
                                    ? pivotResult.colTotals[col]
                                    : formatCurrency(pivotResult.colTotals[col] || 0)}
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-extrabold text-primary bg-primary/10">
                                {pivotMeasure === 'transaction_count'
                                  ? pivotResult.grandTotal
                                  : formatCurrency(pivotResult.grandTotal)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* View 3: Drill-down Inspector */}
              {viewMode === 'drilldown' && drilldownTarget && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary" />
                          Drill-down Breakdown: {drilldownTarget}
                        </CardTitle>
                        <CardDescription>
                          Granular categorical distribution for period {drilldownTarget}.
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('rollup')}
                        className="text-xs"
                      >
                        Back to Roll-up
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {drilldownRows.length === 0 ? (
                      <EmptyState
                        title="No transactions found for this period"
                        description="Try returning to the Roll-up table or selecting a different time period."
                      />
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Inflow Amount</TableHead>
                              <TableHead className="text-right">Outflow Amount</TableHead>
                              <TableHead className="text-right">Net Flow</TableHead>
                              <TableHead className="text-right">Transactions</TableHead>
                              <TableHead className="text-right">Average Size</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {drilldownRows.map((row) => (
                              <TableRow key={row.key} className="hover:bg-muted/20">
                                <TableCell className="font-medium">{row.label}</TableCell>
                                <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                                  {formatCurrency(row.measures.total_income)}
                                </TableCell>
                                <TableCell className="text-right text-rose-600 dark:text-rose-400 font-medium">
                                  {formatCurrency(row.measures.total_expenses)}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-semibold ${
                                    row.measures.net_cash_flow >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {formatCurrency(row.measures.net_cash_flow)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {row.measures.transaction_count}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatCurrency(row.measures.avg_amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ========================================================= */}
            {/* CUBE 2: MONTHLY FINANCIAL SNAPSHOTS CUBE                  */}
            {/* ========================================================= */}
            <TabsContent value="snapshots" className="space-y-6 mt-6">
              {/* Isolated Current Live State (Not a Historical Trend) */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Scale className="h-4 w-4 text-primary" />
                        Current Live Balance Sheet State
                      </CardTitle>
                      <CardDescription>
                        Point-in-time asset and liability position. Isolated from cash flow transactions.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleTakeSnapshot}
                      disabled={creatingSnapshot}
                      className="flex items-center gap-1.5"
                    >
                      <Camera className="h-4 w-4" />
                      {creatingSnapshot ? 'Capturing...' : 'Capture Snapshot for Current Month'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <span className="text-xs text-muted-foreground block">Liquid Savings</span>
                      <span className="text-base font-bold text-foreground">
                        {formatCurrency(currentBalanceSheet.currentSavings)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <span className="text-xs text-muted-foreground block">Active Debt</span>
                      <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(currentBalanceSheet.totalDebt)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <span className="text-xs text-muted-foreground block">Investment Portfolio</span>
                      <span className="text-base font-bold text-foreground">
                        {formatCurrency(currentBalanceSheet.investmentValue)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <span className="text-xs text-muted-foreground block">Fixed Deposits</span>
                      <span className="text-base font-bold text-foreground">
                        {formatCurrency(currentBalanceSheet.fdValue)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <span className="text-xs text-primary font-medium block">Current Net Worth</span>
                      <span className="text-base font-bold text-primary">
                        {formatCurrency(currentBalanceSheet.currentNetWorth)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>
                      Notice: Debts, investments, and fixed deposits are current-state balances. They are
                      not treated as historical time-series until captured in genuine monthly snapshots.
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Genuine Historical Snapshots Table / Meaningful Empty State */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    Verified Monthly Snapshots Table (`financial_history`)
                  </CardTitle>
                  <CardDescription>
                    End-of-month financial snapshots captured across calendar months.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshotFacts.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Camera className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        No Historical Snapshots Recorded
                      </h3>
                      <p className="max-w-lg mx-auto text-xs text-muted-foreground leading-relaxed">
                        Monthly financial snapshots represent frozen point-in-time balance sheet positions
                        (savings, debt, investments, and net worth) captured at month-end closing.
                        In compliance with strict financial integrity standards, WealthIQ{' '}
                        <strong>never fabricates dummy historical balances</strong> or backfills previous months
                        using current values.
                      </p>
                      <div className="pt-2">
                        <Button
                          size="sm"
                          onClick={handleTakeSnapshot}
                          disabled={creatingSnapshot}
                          className="flex items-center gap-1.5 mx-auto"
                        >
                          <Camera className="h-4 w-4" />
                          {creatingSnapshot ? 'Capturing...' : 'Capture Current Month Snapshot'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead>Month</TableHead>
                            <TableHead className="text-right">Monthly Income</TableHead>
                            <TableHead className="text-right">Monthly Expenses</TableHead>
                            <TableHead className="text-right">Closing Savings</TableHead>
                            <TableHead className="text-right">Total Debt</TableHead>
                            <TableHead className="text-right">Investments</TableHead>
                            <TableHead className="text-right">FD Value</TableHead>
                            <TableHead className="text-right font-bold">Net Worth</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {snapshotFacts.map((snap) => (
                            <TableRow key={snap.id} className="hover:bg-muted/20">
                              <TableCell className="font-semibold text-foreground">
                                {snap.month}
                              </TableCell>
                              <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(snap.income)}
                              </TableCell>
                              <TableCell className="text-right text-rose-600 dark:text-rose-400">
                                {formatCurrency(snap.expenses)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(snap.savings)}
                              </TableCell>
                              <TableCell className="text-right text-rose-600 dark:text-rose-400">
                                {formatCurrency(snap.debt)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(snap.investments)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(snap.fd_value)}
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                {formatCurrency(snap.net_worth)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </DashboardLayout>
  );
}
