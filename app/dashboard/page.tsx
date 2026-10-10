'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { MetricCard } from '@/components/metric-card';
import { HealthScoreCard } from '@/components/health-score-card';
import { RiskBadge } from '@/components/risk-badge';
import { ForecastChart } from '@/components/forecast-chart';
import { ExpenseChart } from '@/components/expense-chart';
import { LoadingState } from '@/components/state-components';
import { BrandedLoadingScreen } from '@/components/branded-loading-screen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  PiggyBank,
  CreditCard,
  Shield,
  CircleDollarSign,
  ArrowRight,
  Sparkles,
  Info,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calculator,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notification-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type {
  ExpenseType,
  ExpenseChartData,
  HealthCategory,
  RiskLevel,
} from '@/lib/types';
import {
  evaluateAndPersistFinancialScore,
  calculateFinancialForecast,
  ScoreBreakdown,
  FinancialForecastResult,
  IncomeRow,
  ExpenseRow,
  SavingsRow,
  DebtRow,
  InvestmentRow,
  FDRow,
  ScoreRow,
} from '@/lib/financial-engine';
import { formatCurrency, formatPercent, formatNumber, formatEmergencyFundMonths } from '@/lib/format';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, authState } = useAuth();
  const { evaluateNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasInitialData, setHasInitialData] = useState(false);

  const hasLoadedInitialRef = useRef(false);
  const evaluateNotificationsRef = useRef(evaluateNotifications);
  evaluateNotificationsRef.current = evaluateNotifications;

  // Raw database records
  const [incomeRecords, setIncomeRecords] = useState<IncomeRow[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRow[]>([]);
  const [savingsRecords, setSavingsRecords] = useState<SavingsRow[]>([]);
  const [debtRecords, setDebtRecords] = useState<DebtRow[]>([]);
  const [investmentRecords, setInvestmentRecords] = useState<InvestmentRow[]>([]);
  const [fdRecords, setFdRecords] = useState<FDRow[]>([]);
  const [dbScore, setDbScore] = useState<ScoreRow | null>(null);

  // Evaluated Score & Breakdown
  const [healthScore, setHealthScore] = useState<number>(0);
  const [healthCategory, setHealthCategory] = useState<HealthCategory>('Moderate');
  const [spendingRisk, setSpendingRisk] = useState<RiskLevel>('Low');
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown>({
    savings_score: 0,
    expense_score: 0,
    debt_score: 0,
    emergency_score: 0,
    investment_score: 0,
  });

  // Forecast state
  const [forecast, setForecast] = useState<FinancialForecastResult | null>(null);
  const [showScoreCalculation, setShowScoreCalculation] = useState(false);

  const fetchDashboardData = useCallback(
    async (userId: string, isManualRefresh = false) => {
      const isInitial = !hasLoadedInitialRef.current;
      if (isManualRefresh) {
        setRefreshing(true);
      } else if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setErrorMessage(null);

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out while loading dashboard data.')), 15000)
        );

        const [
          incomeRes,
          expenseRes,
          savingsRes,
          debtRes,
          investRes,
          fdRes,
          scoreRes,
        ] = await Promise.race([
          Promise.all([
            (supabase.from('income_records') as any).select('*').eq('user_id', userId),
            (supabase.from('expense_records') as any).select('*').eq('user_id', userId),
            (supabase.from('savings_records') as any).select('*').eq('user_id', userId),
            (supabase.from('debts') as any).select('*').eq('user_id', userId),
            (supabase.from('investments') as any).select('*').eq('user_id', userId),
            (supabase.from('fixed_deposits') as any).select('*').eq('user_id', userId),
            (supabase.from('financial_scores') as any)
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]),
          timeoutPromise,
        ]);

        const inRecords = (incomeRes.data as IncomeRow[]) || [];
        const expRecords = (expenseRes.data as ExpenseRow[]) || [];
        const savRecords = (savingsRes.data as SavingsRow[]) || [];
        const dbtRecords = (debtRes.data as DebtRow[]) || [];
        const invRecords = (investRes.data as InvestmentRow[]) || [];
        const fxdRecords = (fdRes.data as FDRow[]) || [];
        const latestScoreRow = (scoreRes.data as ScoreRow) || null;

        setIncomeRecords(inRecords);
        setExpenseRecords(expRecords);
        setSavingsRecords(savRecords);
        setDebtRecords(dbtRecords);
        setInvestmentRecords(invRecords);
        setFdRecords(fxdRecords);
        setDbScore(latestScoreRow);

        const finData = {
          incomeRecords: inRecords,
          expenseRecords: expRecords,
          savingsRecords: savRecords,
          debtRecords: dbtRecords,
          investmentRecords: invRecords,
          fdRecords: fxdRecords,
        };

        // Evaluate Financial Health Score + Spending Risk & Persist to Supabase
        const evaluation = await evaluateAndPersistFinancialScore(
          userId,
          finData,
          latestScoreRow
        );

        // Step 2: Deterministic Financial Forecast
        const forecastResult = calculateFinancialForecast(evaluation.features, finData);

        setHealthScore(evaluation.health_score);
        setHealthCategory(evaluation.health_category);
        setSpendingRisk(evaluation.spending_risk);
        setScoreBreakdown(evaluation.breakdown);
        setForecast(forecastResult);

        // Step 4: Evaluate real in-app notifications via stable ref
        evaluateNotificationsRef.current(
          finData,
          evaluation.features,
          evaluation.health_score,
          evaluation.health_category,
          evaluation.spending_risk
        );
      } catch (err: unknown) {
        console.error('Dashboard data fetch exception:', err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while loading dashboard data.'
        );
      } finally {
        hasLoadedInitialRef.current = true;
        setHasInitialData(true);
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const handleRefresh = useCallback(() => {
    if (refreshing || loading || !user?.id) return;
    fetchDashboardData(user.id, true);
  }, [refreshing, loading, user?.id, fetchDashboardData]);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData(user.id);
    } else if (authState === 'unauthenticated') {
      setLoading(false);
    }
  }, [user?.id, authState, fetchDashboardData]);

  // Core Financial Aggregations
  const monthlyIncome = useMemo(
    () => incomeRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [incomeRecords]
  );

  const essentialExpenses = useMemo(
    () =>
      expenseRecords
        .filter((e) => e.expense_type === 'essential')
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenseRecords]
  );

  const discretionaryExpenses = useMemo(
    () =>
      expenseRecords
        .filter((e) => e.expense_type === 'discretionary')
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenseRecords]
  );

  const monthlyExpenses = essentialExpenses + discretionaryExpenses;

  const totalSavings = useMemo(() => {
    const totalSavingsType = savingsRecords
      .filter((s) => s.savings_type === 'Total Savings')
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);
    return totalSavingsType > 0
      ? totalSavingsType
      : savingsRecords.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [savingsRecords]);

  const emergencyFund = useMemo(
    () =>
      savingsRecords
        .filter((s) => s.savings_type === 'Emergency Fund')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [savingsRecords]
  );

  const totalDebt = useMemo(
    () => debtRecords.reduce((sum, d) => sum + Number(d.remaining_balance || 0), 0),
    [debtRecords]
  );

  const monthlyEmi = useMemo(
    () => debtRecords.reduce((sum, d) => sum + Number(d.monthly_emi || 0), 0),
    [debtRecords]
  );

  const investmentValue = useMemo(
    () =>
      investmentRecords.reduce(
        (sum, i) => sum + Number(i.quantity || 0) * Number(i.current_value || 0),
        0
      ),
    [investmentRecords]
  );

  const fdPrincipal = useMemo(
    () => fdRecords.reduce((sum, f) => sum + Number(f.principal || 0), 0),
    [fdRecords]
  );

  // Net Worth Formula:
  // Net Worth = Total Savings + Total Investment Portfolio Value + Total FD Principal - Total Outstanding Debt
  const netWorth = totalSavings + investmentValue + fdPrincipal - totalDebt;

  // Safe ratios
  const expenseRatio = monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : 0;
  const discretionaryRatio = monthlyIncome > 0 ? discretionaryExpenses / monthlyIncome : 0;
  const debtToIncome = monthlyIncome > 0 ? monthlyEmi / monthlyIncome : 0;
  const savingsRate =
    monthlyIncome > 0
      ? Math.max(0, (monthlyIncome - monthlyExpenses) / monthlyIncome)
      : 0;

  const emergencyFundMonths =
    essentialExpenses > 0
      ? emergencyFund / essentialExpenses
      : monthlyExpenses > 0
      ? emergencyFund / monthlyExpenses
      : 0;

  // Dynamic Expense Breakdown Chart Data
  const expenseChartData: ExpenseChartData[] = useMemo(() => {
    const categoryMap = new Map<string, { amount: number; type: ExpenseType }>();
    for (const rec of expenseRecords) {
      const current = categoryMap.get(rec.category);
      if (current) {
        current.amount += Number(rec.amount || 0);
      } else {
        categoryMap.set(rec.category, {
          amount: Number(rec.amount || 0),
          type: rec.expense_type as ExpenseType,
        });
      }
    }
    return Array.from(categoryMap.entries()).map(([category, { amount, type }]) => ({
      category,
      amount,
      type,
    }));
  }, [expenseRecords]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Dashboard"
        description="Your financial health at a glance."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button asChild>
            <Link href="/expenses">
              Add Transaction
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </PageHeader>

      {errorMessage && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {loading && !hasInitialData ? (
        <div className="mt-8">
          <BrandedLoadingScreen message="Loading your financial dashboard..." />
        </div>
      ) : (
        <>
          {/* Top row — Health Score + Key Metrics */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <HealthScoreCard
              score={healthScore}
              category={healthCategory}
              className="lg:col-span-1"
            />

            <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-3">
              <MetricCard
                title="Health Category"
                value={healthCategory}
                subtitle="5-Pillar Evaluation"
                icon={<Sparkles className="h-4 w-4" />}
                accent="primary"
              />
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-muted-foreground">
                  Spending Risk
                </p>
                <div className="mt-3">
                  <RiskBadge level={spendingRisk} size="lg" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Expense &amp; Debt Ratio Analysis
                </p>
              </div>
              <MetricCard
                title="Net Worth"
                value={formatCurrency(netWorth)}
                subtitle="Total assets minus outstanding debt"
                tooltip="Calculated as savings + investment value + FD principal − total outstanding debt."
                icon={<CircleDollarSign className="h-4 w-4" />}
                accent="primary"
              />
              <MetricCard
                title="Monthly Income"
                value={formatCurrency(monthlyIncome)}
                subtitle={incomeRecords.length > 0 ? `${incomeRecords.length} stream(s)` : 'No income recorded'}
                icon={<Wallet className="h-4 w-4" />}
                accent="success"
              />
              <MetricCard
                title="Monthly Expenses"
                value={formatCurrency(monthlyExpenses)}
                subtitle={
                  monthlyIncome > 0
                    ? `${formatPercent(expenseRatio)} of income`
                    : `${expenseRecords.length} record(s)`
                }
                icon={<TrendingDown className="h-4 w-4" />}
                accent="warning"
              />
              <MetricCard
                title="Monthly Savings Rate"
                value={formatPercent(savingsRate)}
                subtitle="Based on income minus recorded expenses."
                tooltip="This metric measures the share of monthly income remaining after recorded expenses. It is not the same as the amount entered in the Savings module. Formula: (Income − Expenses) / Income"
                icon={<PiggyBank className="h-4 w-4" />}
                accent="success"
              />
            </div>
          </div>

          {/* Financial Ratios Row */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Expense Ratio"
              value={formatPercent(expenseRatio)}
              subtitle="Recorded monthly expenses / monthly income"
              accent="warning"
            />
            <MetricCard
              title="Debt-to-Income"
              value={formatPercent(debtToIncome)}
              subtitle="Monthly EMI / monthly income"
              icon={<CreditCard className="h-4 w-4" />}
              accent={debtToIncome < 0.4 ? 'success' : 'danger'}
            />
            <MetricCard
              title="Emergency Fund"
              value={formatEmergencyFundMonths(emergencyFundMonths)}
              subtitle="Essential expenses coverage"
              tooltip="Emergency Fund Coverage = Emergency Fund / Essential Monthly Expenses. Benchmark is 3–6 months."
              icon={<Shield className="h-4 w-4" />}
              accent={
                emergencyFundMonths >= 3
                  ? 'success'
                  : emergencyFundMonths >= 1
                  ? 'warning'
                  : 'danger'
              }
            />
            <MetricCard
              title="Discretionary Ratio"
              value={formatPercent(discretionaryRatio)}
              subtitle="Non-essential spending"
              accent="warning"
            />
          </div>

          {/* Financial Forecast Section */}
          <Card className="mt-4">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Financial Forecast &amp; Net Worth Trajectory
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {forecast?.trajectory_label || 'Deterministic cash flow projection based on current financial records.'}
                </p>
              </div>
              {forecast && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold self-start sm:self-auto',
                    forecast.trajectory_type === 'positive'
                      ? 'border-success/20 bg-success/10 text-success'
                      : forecast.trajectory_type === 'deficit'
                      ? 'border-danger/20 bg-danger/10 text-danger'
                      : 'border-warning/20 bg-warning/10 text-warning'
                  )}
                >
                  {forecast.trajectory_type === 'positive'
                    ? 'Positive Surplus'
                    : forecast.trajectory_type === 'deficit'
                    ? 'Cash Deficit'
                    : 'Zero Surplus'}
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Milestone Projections Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Current Net Worth</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.current.net_worth ?? netWorth)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Baseline</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">6 Months</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.m6.net_worth ?? netWorth)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {forecast && forecast.horizons.m6.net_worth >= (forecast.horizons.current.net_worth ?? netWorth) ? '+' : ''}
                    {forecast ? formatCurrency(forecast.horizons.m6.net_worth - (forecast.horizons.current.net_worth ?? netWorth)) : '₹0'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">12 Months</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.m12.net_worth ?? netWorth)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {forecast && forecast.horizons.m12.net_worth >= (forecast.horizons.current.net_worth ?? netWorth) ? '+' : ''}
                    {forecast ? formatCurrency(forecast.horizons.m12.net_worth - (forecast.horizons.current.net_worth ?? netWorth)) : '₹0'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">24 Months</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.m24.net_worth ?? netWorth)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {forecast && forecast.horizons.m24.net_worth >= (forecast.horizons.current.net_worth ?? netWorth) ? '+' : ''}
                    {forecast ? formatCurrency(forecast.horizons.m24.net_worth - (forecast.horizons.current.net_worth ?? netWorth)) : '₹0'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 col-span-2 sm:col-span-1">
                  <p className="text-xs font-medium text-muted-foreground">36 Months</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.m36.net_worth ?? netWorth)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {forecast && forecast.horizons.m36.net_worth >= (forecast.horizons.current.net_worth ?? netWorth) ? '+' : ''}
                    {forecast ? formatCurrency(forecast.horizons.m36.net_worth - (forecast.horizons.current.net_worth ?? netWorth)) : '₹0'}
                  </p>
                </div>
              </div>

              {/* 2D Line / Area Chart */}
              <div className="pt-2">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Projected Trajectory (Net Worth &amp; Liquid Savings)</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-chart-1" /> Net Worth
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-chart-2" /> Savings
                    </span>
                  </div>
                </div>
                <ForecastChart data={forecast?.points || []} />
              </div>

              {/* Required Explanation */}
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed">
                  Forecast is a deterministic projection based on your current income, expenses, savings, investments, FDs and debt. It is not a prediction of future market returns.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Expense Breakdown Card */}
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Expense Breakdown</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/expenses">
                  View Details
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {expenseRecords.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-medium text-foreground">No expenses recorded</p>
                  <p className="text-xs text-muted-foreground">
                    Add expenses to view category breakdowns.
                  </p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/expenses">Add Expense</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <ExpenseChart data={expenseChartData} type="bar" />
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-chart-1" />
                      <span className="text-muted-foreground">Essential</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-chart-3" />
                      <span className="text-muted-foreground">Discretionary</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Household Spending Benchmark Link Card */}
          <Card className="mt-4 border-dashed">
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Household Spending Benchmark (MoSPI HCES 2023–24)
                </p>
                <p className="text-xs text-muted-foreground">
                  Estimate and compare typical monthly consumption expenditure for comparable Indian households.
                </p>
              </div>
              <Button variant="outline" size="sm" className="self-start sm:self-auto shrink-0 text-xs" asChild>
                <Link href="/household-benchmark">
                  Explore Benchmark
                  <ArrowRight className="ml-1.5 h-3 w-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Financial Health Score Breakdown & Actionable Drivers */}
          <Card className="mt-4 border border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Financial Health Score Breakdown &amp; Key Drivers
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your overall score of <strong className="text-foreground">{healthScore}/100</strong> evaluates 5 core financial pillars to highlight strengths and focus areas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Framework:</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-border bg-muted/40">
                    5-Pillar Rubric
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Pillar Cards Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {scoreBreakdownItems.map((item) => {
                  const value = scoreBreakdown[item.key as keyof ScoreBreakdown] ?? 0;
                  const status =
                    value >= 80 ? 'Strong' : value >= 60 ? 'Moderate' : 'Needs Focus';
                  const statusColor =
                    value >= 80
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : value >= 60
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20';

                  return (
                    <div key={item.label} className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusColor}`}>
                          {status}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-2xl font-bold tracking-tight text-foreground">
                          {value}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          Weight: {item.weight}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Meaningful Contributing Factors & Guidance */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Key Contributing Strengths
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {savingsRate >= 0.2
                      ? `Healthy monthly savings rate of ${formatPercent(savingsRate)}, generating continuous surplus for net worth growth.`
                      : monthlyIncome > monthlyExpenses
                      ? `Positive monthly cash surplus of ${formatCurrency(monthlyIncome - monthlyExpenses)} over recorded expenditures.`
                      : `Active financial tracking across income streams and asset allocations.`}
                  </p>
                  {debtToIncome < 0.3 && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Conservative debt-to-income ratio ({formatPercent(debtToIncome)}), well below the 40% risk ceiling.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    Recommended Actionable Steps
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed list-disc list-inside">
                    {emergencyFundMonths < 3 ? (
                      <li>
                        Build liquid emergency reserves towards 3–6 months of essential living expenses (currently {formatEmergencyFundMonths(emergencyFundMonths)}).
                      </li>
                    ) : (
                      <li>
                        Emergency fund is funded at {formatEmergencyFundMonths(emergencyFundMonths)}. Maintain reserves in high-yield liquid accounts.
                      </li>
                    )}
                    {debtToIncome >= 0.4 ? (
                      <li>
                        Target aggressive reduction of monthly loan repayments to bring debt-to-income below 40%.
                      </li>
                    ) : savingsRate < 0.2 ? (
                      <li>
                        Review non-essential discretionary expenses to target a 20%+ monthly savings rate.
                      </li>
                    ) : (
                      <li>
                        Continue disciplined asset accumulation and explore fixed deposits or systematic equity investments.
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Secondary Expandable Methodology Section */}
              <div className="border-t border-border/60 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowScoreCalculation(!showScoreCalculation)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Info className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  {showScoreCalculation ? 'Hide Scoring Methodology' : 'View Scoring Methodology & Pillar Weights'}
                  {showScoreCalculation ? (
                    <ChevronUp className="ml-1 h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  )}
                </Button>

                {showScoreCalculation && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/20 p-4 space-y-3 text-xs leading-relaxed">
                    <p className="font-semibold text-foreground">
                      Deterministic Five-Pillar Scoring Rubric:
                    </p>
                    <div className="grid gap-2 text-muted-foreground sm:grid-cols-2">
                      <div className="rounded border bg-background/60 p-2.5 space-y-0.5">
                        <span className="font-semibold text-foreground">1. Savings Behavior (25%)</span>
                        <p>Evaluates monthly net savings rate against the 20%+ personal finance benchmark.</p>
                      </div>
                      <div className="rounded border bg-background/60 p-2.5 space-y-0.5">
                        <span className="font-semibold text-foreground">2. Expense Burden (25%)</span>
                        <p>Assesses essential vs discretionary spending ratios and monthly budget sustainability.</p>
                      </div>
                      <div className="rounded border bg-background/60 p-2.5 space-y-0.5">
                        <span className="font-semibold text-foreground">3. Debt Burden (20%)</span>
                        <p>Benchmarks monthly debt EMI against a 40% maximum debt-to-income threshold.</p>
                      </div>
                      <div className="rounded border bg-background/60 p-2.5 space-y-0.5">
                        <span className="font-semibold text-foreground">4. Emergency Fund (15%)</span>
                        <p>Measures liquid reserves against the recommended 3 to 6 months of essential expenses.</p>
                      </div>
                      <div className="rounded border bg-background/60 p-2.5 space-y-0.5 col-span-full sm:col-span-1">
                        <span className="font-semibold text-foreground">5. Investments &amp; Assets (15%)</span>
                        <p>Rewards diversified asset accumulation across fixed deposits, equities, and investments.</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Note: The Financial Health Score is computed deterministically from your verified financial records using transparent arithmetic benchmarks. It is not an opaque machine learning prediction.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}

const scoreBreakdownItems = [
  { key: 'savings_score', label: 'Savings Behavior', weight: '25%' },
  { key: 'expense_score', label: 'Expense Burden', weight: '25%' },
  { key: 'debt_score', label: 'Debt Burden', weight: '20%' },
  { key: 'emergency_score', label: 'Emergency Fund', weight: '15%' },
  { key: 'investment_score', label: 'Investments & Assets', weight: '15%' },
];
