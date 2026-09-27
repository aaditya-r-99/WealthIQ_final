'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { MetricCard } from '@/components/metric-card';
import { HealthScoreCard } from '@/components/health-score-card';
import { RiskBadge } from '@/components/risk-badge';
import { RecommendationCard } from '@/components/recommendation-card';
import { ForecastChart } from '@/components/forecast-chart';
import { ExpenseChart } from '@/components/expense-chart';
import { MLPredictionCard } from '@/components/ml-prediction-card';
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
  Recommendation,
} from '@/lib/types';
import {
  evaluateAndPersistFinancialScore,
  calculateFinancialForecast,
  generatePersonalizedRecommendations,
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
import { predictFinancialHealthML, MLPredictionResult } from '@/lib/ml-engine';
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

  // Forecast, Recommendations & ML state
  const [forecast, setForecast] = useState<FinancialForecastResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [mlPrediction, setMlPrediction] = useState<MLPredictionResult | null>(null);
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

        // Step 2: Deterministic Financial Forecast & Personalized Recommendations
        const forecastResult = calculateFinancialForecast(evaluation.features, finData);
        const recommendationsResult = generatePersonalizedRecommendations(
          evaluation.features,
          evaluation.health_score,
          evaluation.spending_risk,
          finData,
          userId
        );

        // Step 3: Explainable Machine Learning Archetype Classification
        const mlResult = predictFinancialHealthML(evaluation.features, finData);

        setHealthScore(evaluation.health_score);
        setHealthCategory(evaluation.health_category);
        setSpendingRisk(evaluation.spending_risk);
        setScoreBreakdown(evaluation.breakdown);
        setForecast(forecastResult);
        setRecommendations(recommendationsResult);
        setMlPrediction(mlResult);

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
                subtitle="Calculated Model"
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
                  Behavior-based evaluation
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

          {/* AI/ML Financial Health Assessment */}
          <div className="mt-4">
            <MLPredictionCard prediction={mlPrediction} />
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

          {/* Score Breakdown & Transparency */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">
                How Your Health Score Is Calculated (Deterministic Rule-Based Score)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Transparent 0–100 score based on five weighted financial pillars and predefined benchmarks.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {scoreBreakdownItems.map((item) => {
                  const value = scoreBreakdown[item.key as keyof ScoreBreakdown] ?? 0;
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-sm font-bold text-primary">
                          {value}/100
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Weight: {item.weight}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Example Calculation Expandable */}
              <div className="border-t border-border/60 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowScoreCalculation(!showScoreCalculation)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Calculator className="mr-1.5 h-3.5 w-3.5" />
                  {showScoreCalculation ? 'Hide Example Calculation' : 'Example calculation'}
                  {showScoreCalculation ? (
                    <ChevronUp className="ml-1 h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  )}
                </Button>

                {showScoreCalculation && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/20 p-4 space-y-3 text-xs leading-relaxed">
                    <p className="font-semibold text-foreground">
                      Dynamic Calculation from Your Current Pillar Scores:
                    </p>
                    <div className="font-mono text-xs bg-background/80 p-3.5 rounded-lg border border-border/60 space-y-3">
                      <div>
                        <div className="text-muted-foreground text-[11px] font-sans font-medium">Savings:</div>
                        <div className="text-foreground">{scoreBreakdown.savings_score} × 25% = {formatPillarProduct(scoreBreakdown.savings_score, 0.25)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px] font-sans font-medium">Expense:</div>
                        <div className="text-foreground">{scoreBreakdown.expense_score} × 25% = {formatPillarProduct(scoreBreakdown.expense_score, 0.25)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px] font-sans font-medium">Debt:</div>
                        <div className="text-foreground">{scoreBreakdown.debt_score} × 20% = {formatPillarProduct(scoreBreakdown.debt_score, 0.20)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px] font-sans font-medium">Emergency Fund:</div>
                        <div className="text-foreground">{scoreBreakdown.emergency_score} × 15% = {formatPillarProduct(scoreBreakdown.emergency_score, 0.15)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px] font-sans font-medium">Investments:</div>
                        <div className="text-foreground">{scoreBreakdown.investment_score} × 15% = {formatPillarProduct(scoreBreakdown.investment_score, 0.15)}</div>
                      </div>
                      <div className="pt-2 border-t border-border/50">
                        <div className="text-muted-foreground text-[11px] font-sans font-medium">Total:</div>
                        <div className="text-foreground font-semibold">
                          {formatPillarProduct(scoreBreakdown.savings_score, 0.25)} + {formatPillarProduct(scoreBreakdown.expense_score, 0.25)} + {formatPillarProduct(scoreBreakdown.debt_score, 0.20)} + {formatPillarProduct(scoreBreakdown.emergency_score, 0.15)} + {formatPillarProduct(scoreBreakdown.investment_score, 0.15)} = {healthScore}
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="text-muted-foreground text-[11px] font-sans font-medium">Therefore:</div>
                        <div className="text-primary font-bold text-sm">
                          Financial Health Score = {healthScore} / 100
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic">
                      Calculated dynamically from your actual recorded pillar values.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-foreground/80 space-y-1">
                  <p>
                    <span className="font-semibold">Deterministic Scoring Engine:</span> Your Financial Health Score (0–100) is a transparent rule-based scoring rubric calculated directly from your real financial records across 5 weighted pillars:
                    Savings Behavior (25%), Expense Burden (25%), Debt Burden (20%), Emergency Fund (15%), and Investments &amp; Assets (15%). This deterministic calculation is distinct from the statistical ML archetype classifier.
                  </p>
                  <p>
                    <span className="font-semibold">Spending Risk Assessment:</span> Evaluated deterministically from your expense-to-income ratio (&gt;85% High, &gt;65% Med), discretionary expense ratio (&gt;25% Med), debt-to-income ratio (&gt;45% High, &gt;30% Med), and savings rate (&lt;10% Med).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personalized Recommendations */}
          <div className="mt-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Personalized Recommendations</h2>
              <p className="text-xs text-muted-foreground">
                Deterministic, rule-based financial guidance generated from your real financial metrics and health score. (Rule-based recommendations, not ML predictions).
              </p>
            </div>
            {recommendations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm font-medium text-foreground">No active recommendations</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your financial metrics are balanced. Continue maintaining your current financial rhythm.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recommendations.slice(0, 6).map((rec) => (
                  <RecommendationCard key={rec.id} recommendation={rec} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

function formatPillarProduct(score: number, weight: number): string {
  const prod = score * weight;
  return Number.isInteger(prod) ? prod.toString() : (Math.round(prod * 10) / 10).toString();
}

const scoreBreakdownItems = [
  { key: 'savings_score', label: 'Savings Behavior', weight: '25%' },
  { key: 'expense_score', label: 'Expense Burden', weight: '25%' },
  { key: 'debt_score', label: 'Debt Burden', weight: '20%' },
  { key: 'emergency_score', label: 'Emergency Fund', weight: '15%' },
  { key: 'investment_score', label: 'Investments & Assets', weight: '15%' },
];
