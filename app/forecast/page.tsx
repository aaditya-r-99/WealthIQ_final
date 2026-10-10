'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ForecastChart } from '@/components/forecast-chart';
import { LoadingState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  calculateFinancialFeatures,
  calculateFinancialForecast,
  FinancialForecastResult,
  IncomeRow,
  ExpenseRow,
  SavingsRow,
  DebtRow,
  InvestmentRow,
  FDRow,
} from '@/lib/financial-engine';
import { formatCurrency } from '@/lib/format';
import { TrendingUp, Info, AlertCircle, Calculator } from 'lucide-react';

export default function ForecastPage() {
  const { user, authState } = useAuth();
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<FinancialForecastResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchForecastData = useCallback(async (userId: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [incomeRes, expenseRes, savingsRes, debtRes, investRes, fdRes] =
        await Promise.all([
          (supabase.from('income_records') as any).select('*').eq('user_id', userId),
          (supabase.from('expense_records') as any).select('*').eq('user_id', userId),
          (supabase.from('savings_records') as any).select('*').eq('user_id', userId),
          (supabase.from('debts') as any).select('*').eq('user_id', userId),
          (supabase.from('investments') as any).select('*').eq('user_id', userId),
          (supabase.from('fixed_deposits') as any).select('*').eq('user_id', userId),
        ]);

      const finData = {
        incomeRecords: (incomeRes.data as IncomeRow[]) || [],
        expenseRecords: (expenseRes.data as ExpenseRow[]) || [],
        savingsRecords: (savingsRes.data as SavingsRow[]) || [],
        debtRecords: (debtRes.data as DebtRow[]) || [],
        investmentRecords: (investRes.data as InvestmentRow[]) || [],
        fdRecords: (fdRes.data as FDRow[]) || [],
      };

      const features = calculateFinancialFeatures(finData);
      const forecastResult = calculateFinancialForecast(features, finData);
      setForecast(forecastResult);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to generate financial forecast.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchForecastData(user.id);
    } else if (authState === 'unauthenticated') {
      setLoading(false);
    }
  }, [user?.id, authState, fetchForecastData]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Financial Forecast"
        description="Deterministic cash flow and net worth projection based on your real financial records."
      />

      {errorMessage && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="mt-8">
          <LoadingState message="Calculating deterministic financial forecast..." />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Net Worth &amp; Liquid Savings Trajectory
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {forecast?.trajectory_label || 'Deterministic projection based on current monthly surplus.'}
                </CardDescription>
              </div>
              {forecast && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold self-start sm:self-auto',
                    forecast.trajectory_type === 'positive'
                      ? 'border-success/20 bg-success/10 text-success'
                      : forecast.trajectory_type === 'deficit'
                      ? 'border-danger/20 bg-danger/10 text-danger'
                      : 'border-warning/20 bg-warning/10 text-warning'
                  )}
                >
                  {forecast.trajectory_type === 'positive'
                    ? 'Positive Cash Surplus'
                    : forecast.trajectory_type === 'deficit'
                    ? 'Monthly Deficit'
                    : 'Zero Monthly Surplus'}
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Milestone Horizons Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Current Net Worth</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.current.net_worth ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Baseline</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">6 Months</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.m6.net_worth ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {forecast && forecast.horizons.m6.net_worth >= (forecast.horizons.current.net_worth ?? 0) ? '+' : ''}
                    {forecast ? formatCurrency(forecast.horizons.m6.net_worth - (forecast.horizons.current.net_worth ?? 0)) : '₹0'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">12 Months</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.m12.net_worth ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {forecast && forecast.horizons.m12.net_worth >= (forecast.horizons.current.net_worth ?? 0) ? '+' : ''}
                    {forecast ? formatCurrency(forecast.horizons.m12.net_worth - (forecast.horizons.current.net_worth ?? 0)) : '₹0'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">24 Months</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.m24.net_worth ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {forecast && forecast.horizons.m24.net_worth >= (forecast.horizons.current.net_worth ?? 0) ? '+' : ''}
                    {forecast ? formatCurrency(forecast.horizons.m24.net_worth - (forecast.horizons.current.net_worth ?? 0)) : '₹0'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 col-span-2 sm:col-span-1">
                  <p className="text-xs font-medium text-muted-foreground">36 Months</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatCurrency(forecast?.horizons.m36.net_worth ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {forecast && forecast.horizons.m36.net_worth >= (forecast.horizons.current.net_worth ?? 0) ? '+' : ''}
                    {forecast ? formatCurrency(forecast.horizons.m36.net_worth - (forecast.horizons.current.net_worth ?? 0)) : '₹0'}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="pt-2">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Projected Timeline (Net Worth vs. Savings)</span>
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

              {/* Disclaimer */}
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed">
                  Forecast is a deterministic projection based on your current income, expenses, savings, investments, FDs and debt. It is not a prediction of future market returns.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Next-Month Expense Estimation (Deterministic Baseline) */}
          {forecast?.next_month_expense_forecast && (
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" />
                      Next-Month Expense Estimation
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Deterministic projection for upcoming month ({forecast.next_month_expense_forecast.target_month}) based on completed historical expense records.
                    </CardDescription>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {forecast.next_month_expense_forecast.tier === 'tier_0'
                        ? 'Tier 0: Insufficient History'
                        : forecast.next_month_expense_forecast.tier === 'tier_1'
                        ? 'Tier 1: 3–5 Months (3M SMA)'
                        : forecast.next_month_expense_forecast.tier === 'tier_2'
                        ? 'Tier 2: 6–11 Months (6M EWMA)'
                        : 'Tier 3: 12+ Months (Mature History)'}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Estimated Spending</p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {forecast.next_month_expense_forecast.estimated_amount !== null
                        ? formatCurrency(forecast.next_month_expense_forecast.estimated_amount)
                        : 'Insufficient Data'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Target: {forecast.next_month_expense_forecast.target_month}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Calculation Method</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {forecast.next_month_expense_forecast.method_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {forecast.next_month_expense_forecast.is_supported
                        ? 'Supported Moving Baseline'
                        : 'Conservative Fallback'}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Usable Completed Months</p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {forecast.next_month_expense_forecast.usable_months_count} month(s)
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {forecast.next_month_expense_forecast.usable_months.length > 0
                        ? forecast.next_month_expense_forecast.usable_months.join(', ')
                        : 'No completed months'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Methodology Note:</p>
                  <p>{forecast.next_month_expense_forecast.explanation}</p>
                </div>

                {forecast.next_month_expense_forecast.data_limitations.length > 0 && (
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs text-foreground/80 space-y-1.5">
                    <p className="font-semibold text-warning-foreground flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-warning" />
                      Data Quality &amp; Completeness Limitations:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
                      {forecast.next_month_expense_forecast.data_limitations.map((lim, idx) => (
                        <li key={idx}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
