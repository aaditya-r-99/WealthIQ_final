'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/format';
import {
  INDIAN_STATES,
  EDUCATION_OPTIONS,
  LIVELIHOOD_OPTIONS,
  DWELLING_OPTIONS,
  COOKING_FUEL_OPTIONS,
  LAND_OWNERSHIP_OPTIONS,
  type HouseholdBenchmarkInput,
  type HouseholdBenchmarkResult,
  type SectorType,
  type EducationTier,
  type LivelihoodType,
  type DwellingType,
  type CookingFuelType,
  type LandOwnershipType,
  requestHouseholdBenchmark,
} from '@/lib/household-benchmark';
import {
  Home,
  Users,
  Info,
  AlertCircle,
  Loader2,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Scale,
} from 'lucide-react';

interface ExpenseRecordRow {
  amount: number;
  record_date: string;
}

export default function HouseholdBenchmarkPage() {
  const { user, session } = useAuth();

  // Form State
  const [stateCode, setStateCode] = useState<string>('27'); // Default: Maharashtra
  const [sector, setSector] = useState<SectorType>('urban');
  const [hhSize, setHhSize] = useState<number>(3);
  const [numAdults, setNumAdults] = useState<number>(2);
  const [numChildren, setNumChildren] = useState<number>(1);
  const [education, setEducation] = useState<EducationTier>('graduate_above');
  const [livelihood, setLivelihood] = useState<LivelihoodType>('regular_wage');
  const [dwelling, setDwelling] = useState<DwellingType>('pucca');
  const [cookingFuel, setCookingFuel] = useState<CookingFuelType>('png_electric');
  const [landOwned, setLandOwned] = useState<LandOwnershipType>('owned');

  // Benchmark Execution State
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<HouseholdBenchmarkResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Optional Spending Comparison State
  const [userExpenses, setUserExpenses] = useState<ExpenseRecordRow[]>([]);
  const [hasLoadedExpenses, setHasLoadedExpenses] = useState<boolean>(false);
  const [enableComparison, setEnableComparison] = useState<boolean>(false);
  const [consentGranted, setConsentGranted] = useState<boolean>(false);
  const [comparisonMode, setComparisonMode] = useState<'recorded' | 'manual'>('recorded');
  const [manualSpendingInput, setManualSpendingInput] = useState<string>('');

  // Synchronize household members
  const handleHhSizeChange = (val: number) => {
    const size = Math.max(1, Math.min(20, val));
    setHhSize(size);
    if (numAdults > size) {
      setNumAdults(size);
      setNumChildren(0);
    } else {
      setNumChildren(size - numAdults);
    }
  };

  const handleAdultsChange = (val: number) => {
    const adults = Math.max(1, Math.min(hhSize, val));
    setNumAdults(adults);
    setNumChildren(Math.max(0, hhSize - adults));
  };

  const handleChildrenChange = (val: number) => {
    const children = Math.max(0, Math.min(hhSize - 1, val));
    setNumChildren(children);
    setNumAdults(Math.max(1, hhSize - children));
  };

  // Execute ML Benchmark
  const runBenchmark = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const input: HouseholdBenchmarkInput = {
      state: stateCode,
      sector,
      highest_education: education,
      livelihood,
      dwelling_type: dwelling,
      cooking_fuel: cookingFuel,
      land_owned: landOwned,
      hh_size: hhSize,
      num_adults: numAdults,
      num_children: numChildren,
    };

    try {
      const benchmarkData = await requestHouseholdBenchmark(
        input,
        session?.access_token || undefined
      );
      setResult(benchmarkData);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Unable to calculate household benchmark. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    stateCode,
    sector,
    education,
    livelihood,
    dwelling,
    cookingFuel,
    landOwned,
    hhSize,
    numAdults,
    numChildren,
    session?.access_token,
  ]);

  // Initial calculation on load
  useEffect(() => {
    runBenchmark();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch recorded expenses for optional comparison
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setHasLoadedExpenses(true);
      return;
    }

    const activeUserId = userId;
    async function loadUserExpenses(uid: string) {
      try {
        const { data, error } = await supabase
          .from('expense_records')
          .select('amount, record_date')
          .eq('user_id', uid);

        if (!error && data) {
          setUserExpenses(data as ExpenseRecordRow[]);
        }
      } catch {
        // Silently fallback if network issue
      } finally {
        setHasLoadedExpenses(true);
      }
    }

    loadUserExpenses(activeUserId);
  }, [userId]);

  // Calculate user's monthly recorded spending
  const userMonthlyStats = useMemo(() => {
    if (!userExpenses || userExpenses.length === 0) {
      return { totalThisMonth: 0, count: 0, dateRangeLabel: 'No recorded expenses' };
    }

    // Default to current calendar month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthRecords = userExpenses.filter((r) => {
      const d = new Date(r.record_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    if (currentMonthRecords.length > 0) {
      const sum = currentMonthRecords.reduce((acc, r) => acc + Number(r.amount || 0), 0);
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return {
        totalThisMonth: sum,
        count: currentMonthRecords.length,
        dateRangeLabel: `${monthNames[currentMonth]} ${currentYear} (${currentMonthRecords.length} transactions)`,
      };
    }

    // If no records in current month, take last 30 days or average
    const sumAll = userExpenses.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    return {
      totalThisMonth: sumAll,
      count: userExpenses.length,
      dateRangeLabel: `All recorded transactions (${userExpenses.length} transactions)`,
    };
  }, [userExpenses]);

  // Effective comparison spending amount
  const effectiveComparisonSpending = useMemo(() => {
    if (comparisonMode === 'manual') {
      const val = parseFloat(manualSpendingInput);
      return isNaN(val) || val <= 0 ? null : val;
    }
    return userMonthlyStats.totalThisMonth > 0 ? userMonthlyStats.totalThisMonth : null;
  }, [comparisonMode, manualSpendingInput, userMonthlyStats.totalThisMonth]);

  const selectedStateName =
    INDIAN_STATES.find((s) => s.code === stateCode)?.name || 'Selected State';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Household Spending Benchmark"
          description="India Household Consumption Expenditure Survey (HCES) 2023–24 ML Regression Benchmark"
        />

        {/* Informational Context Banner */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Info className="h-5 w-5 shrink-0 text-foreground mt-0.5" />
          <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground">
              Official MoSPI HCES 2023–24 Consumption Expenditure Reference
            </p>
            <p>
              This benchmark is computed by a trained <strong>HistGradientBoostingRegressor</strong> model
              evaluated on 261,953 households across all 36 Indian States and Union Territories. It models
              Monthly Per Capita Consumption Expenditure (MPCE) using the Modified Mixed Reference Period (MMRP)
              measuring food, consumables, services, and durable goods.
            </p>
          </div>
        </div>

        {/* Main Grid: Form on Left, Benchmark Output on Right */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Input Form (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Household Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  Specify demographic and socioeconomic characteristics to estimate the benchmark.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* State & Sector */}
                <div className="space-y-1.5">
                  <Label htmlFor="state-select" className="text-xs font-medium">
                    State / Union Territory
                  </Label>
                  <Select value={stateCode} onValueChange={setStateCode}>
                    <SelectTrigger id="state-select" className="w-full text-xs">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sector-select" className="text-xs font-medium">
                    Sector (Location Type)
                  </Label>
                  <Select value={sector} onValueChange={(v) => setSector(v as SectorType)}>
                    <SelectTrigger id="sector-select" className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urban" className="text-xs">
                        Urban (Towns, Metros &amp; Municipalities)
                      </SelectItem>
                      <SelectItem value="rural" className="text-xs">
                        Rural (Villages &amp; Gram Panchayats)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Household Size & Composition */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hh-size" className="text-xs font-medium">
                      Total Members
                    </Label>
                    <Input
                      id="hh-size"
                      type="number"
                      min={1}
                      max={20}
                      value={hhSize}
                      onChange={(e) => handleHhSizeChange(parseInt(e.target.value) || 1)}
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="num-adults" className="text-xs font-medium">
                      Adults
                    </Label>
                    <Input
                      id="num-adults"
                      type="number"
                      min={1}
                      max={hhSize}
                      value={numAdults}
                      onChange={(e) => handleAdultsChange(parseInt(e.target.value) || 1)}
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="num-children" className="text-xs font-medium">
                      Children
                    </Label>
                    <Input
                      id="num-children"
                      type="number"
                      min={0}
                      max={hhSize - 1}
                      value={numChildren}
                      onChange={(e) => handleChildrenChange(parseInt(e.target.value) || 0)}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                {/* Education Tier */}
                <div className="space-y-1.5">
                  <Label htmlFor="education-select" className="text-xs font-medium">
                    Highest Education in Household
                  </Label>
                  <Select
                    value={education}
                    onValueChange={(v) => setEducation(v as EducationTier)}
                  >
                    <SelectTrigger id="education-select" className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDUCATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Livelihood Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="livelihood-select" className="text-xs font-medium">
                    Primary Livelihood / Occupation
                  </Label>
                  <Select
                    value={livelihood}
                    onValueChange={(v) => setLivelihood(v as LivelihoodType)}
                  >
                    <SelectTrigger id="livelihood-select" className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIVELIHOOD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dwelling Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="dwelling-select" className="text-xs font-medium">
                    Dwelling Structure
                  </Label>
                  <Select
                    value={dwelling}
                    onValueChange={(v) => setDwelling(v as DwellingType)}
                  >
                    <SelectTrigger id="dwelling-select" className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DWELLING_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cooking Fuel & Land Ownership */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fuel-select" className="text-xs font-medium">
                      Cooking Fuel
                    </Label>
                    <Select
                      value={cookingFuel}
                      onValueChange={(v) => setCookingFuel(v as CookingFuelType)}
                    >
                      <SelectTrigger id="fuel-select" className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COOKING_FUEL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="land-select" className="text-xs font-medium">
                      Land Ownership
                    </Label>
                    <Select
                      value={landOwned}
                      onValueChange={(v) => setLandOwned(v as LandOwnershipType)}
                    >
                      <SelectTrigger id="land-select" className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LAND_OWNERSHIP_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Submit Action */}
                <Button
                  onClick={runBenchmark}
                  disabled={loading}
                  className="w-full mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Computing ML Benchmark...
                    </>
                  ) : (
                    'Calculate Benchmark'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Benchmark Results & Comparison (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Calculation Error</p>
                  <p>{errorMessage}</p>
                </div>
                <Button variant="outline" size="sm" onClick={runBenchmark}>
                  Retry
                </Button>
              </div>
            )}

            {loading && !result && (
              <Card className="h-96 flex flex-col items-center justify-center text-center p-6">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm font-semibold">Generating HCES Spending Benchmark</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Evaluating demographic profile against the HistGradientBoostingRegressor model...
                </p>
              </Card>
            )}

            {result && (
              <>
                {/* Primary Benchmark Figures Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">Estimated Spending Benchmark</CardTitle>
                          <Badge variant="outline" className="text-[10px]">
                            {result.sector.toUpperCase()} • {result.state_name}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Estimated consumption expenditure for a household of {result.household_size}{' '}
                          ({result.num_adults} adult{result.num_adults > 1 ? 's' : ''}
                          {result.num_children > 0
                            ? `, ${result.num_children} child${result.num_children > 1 ? 'ren' : ''}`
                            : ''}
                          ).
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Primary Highlight Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Household Total */}
                      <div className="rounded-lg border bg-muted/20 p-4">
                        <p className="text-xs font-medium text-muted-foreground">
                          Estimated Household Total
                        </p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                          {formatCurrency(result.estimated_household_total)}
                          <span className="text-xs font-normal text-muted-foreground"> / month</span>
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Combined spending for all {result.household_size} household members.
                        </p>
                      </div>

                      {/* Per Capita (MPCE) */}
                      <div className="rounded-lg border bg-muted/20 p-4">
                        <p className="text-xs font-medium text-muted-foreground">
                          Per Capita Expenditure (MPCE)
                        </p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                          {formatCurrency(result.estimated_mpce)}
                          <span className="text-xs font-normal text-muted-foreground"> / person / mo</span>
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Monthly Per Capita Consumption Expenditure (MMRP definition).
                        </p>
                      </div>
                    </div>

                    {/* Typical Range & Uncertainty from Held-Out Test Evaluation */}
                    <div className="rounded-lg border border-border/80 bg-background p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-foreground">Typical Spending Range (±MAE):</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(result.uncertainty.typical_range_household[0])} –{' '}
                          {formatCurrency(result.uncertainty.typical_range_household[1])} / month
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Based on held-out evaluation error (MAE: ±{formatCurrency(result.uncertainty.segment_mae)}/person for {result.sector} segment). Actual spending varies with lifestyle choices, city tiers, and private consumption habits.
                      </p>
                    </div>

                    {/* Empirical State / Sector Distribution Context */}
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <BarChart2 className="h-3.5 w-3.5" />
                        State Context: {result.state_name} ({result.sector})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="rounded border p-2">
                          <p className="text-[10px] text-muted-foreground">State Median MPCE</p>
                          <p className="text-xs font-semibold mt-0.5">
                            {result.reference_benchmarks.state_sector_median_mpce
                              ? formatCurrency(result.reference_benchmarks.state_sector_median_mpce)
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="rounded border p-2">
                          <p className="text-[10px] text-muted-foreground">State Mean MPCE</p>
                          <p className="text-xs font-semibold mt-0.5">
                            {result.reference_benchmarks.state_sector_mean_mpce
                              ? formatCurrency(result.reference_benchmarks.state_sector_mean_mpce)
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="rounded border p-2">
                          <p className="text-[10px] text-muted-foreground">Middle 50% (P25–P75)</p>
                          <p className="text-xs font-semibold mt-0.5">
                            {result.reference_benchmarks.state_sector_p25_mpce &&
                            result.reference_benchmarks.state_sector_p75_mpce
                              ? `${formatCurrency(result.reference_benchmarks.state_sector_p25_mpce)} – ${formatCurrency(result.reference_benchmarks.state_sector_p75_mpce)}`
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="rounded border p-2">
                          <p className="text-[10px] text-muted-foreground">Survey Sample</p>
                          <p className="text-xs font-semibold mt-0.5">
                            {result.reference_benchmarks.sample_size
                              ? `${result.reference_benchmarks.sample_size.toLocaleString()} HHs`
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Optional Spending Comparison Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      Optional Spending Comparison
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Compare your monthly household expenditure against the estimated HCES benchmark.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Consent Checkbox */}
                    <div className="flex items-start space-x-3 rounded-lg border p-3">
                      <Checkbox
                        id="consent-check"
                        checked={consentGranted}
                        onCheckedChange={(checked) => setConsentGranted(!!checked)}
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="consent-check"
                          className="text-xs font-semibold cursor-pointer text-foreground"
                        >
                          I consent to compare my household expenditure with this population benchmark
                        </Label>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          WealthIQ never alters your financial records. Spending data is processed locally in
                          your session solely to generate this descriptive comparison.
                        </p>
                      </div>
                    </div>

                    {consentGranted && (
                      <div className="space-y-4 pt-1">
                        {/* Source Mode Selection */}
                        <div className="flex items-center gap-4 text-xs">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="comp-mode"
                              checked={comparisonMode === 'recorded'}
                              onChange={() => setComparisonMode('recorded')}
                              className="accent-primary"
                            />
                            <span>Use WealthIQ Recorded Expenses</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="comp-mode"
                              checked={comparisonMode === 'manual'}
                              onChange={() => setComparisonMode('manual')}
                              className="accent-primary"
                            />
                            <span>Enter Manual Monthly Expenditure</span>
                          </label>
                        </div>

                        {/* Input or Recorded Info */}
                        {comparisonMode === 'recorded' ? (
                          <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
                            <p className="font-medium text-foreground">
                              Recorded Expenditure Source:
                            </p>
                            <p className="text-muted-foreground">
                              {userMonthlyStats.dateRangeLabel}:{' '}
                              <strong className="text-foreground">
                                {formatCurrency(userMonthlyStats.totalThisMonth)}
                              </strong>
                            </p>
                            {userMonthlyStats.totalThisMonth === 0 && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                No expense records found in your account. You can switch to manual entry above.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-w-xs">
                            <Label htmlFor="manual-exp" className="text-xs font-medium">
                              Your Estimated Monthly Household Spending (INR)
                            </Label>
                            <Input
                              id="manual-exp"
                              type="number"
                              placeholder="e.g. 75000"
                              value={manualSpendingInput}
                              onChange={(e) => setManualSpendingInput(e.target.value)}
                              className="text-xs h-9"
                            />
                          </div>
                        )}

                        {/* Comparison Breakdown Display */}
                        {effectiveComparisonSpending !== null && (
                          <div className="space-y-3 rounded-lg border bg-background p-4">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">
                                Your Household Spending:
                              </span>
                              <span className="font-bold text-foreground">
                                {formatCurrency(effectiveComparisonSpending)} / month
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                HCES Benchmark (Comparable Household):
                              </span>
                              <span className="font-semibold text-foreground">
                                {formatCurrency(result.estimated_household_total)} / month
                              </span>
                            </div>

                            {/* Comparison Progress Bar */}
                            <div className="space-y-1.5 pt-2">
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>Comparison Visualizer</span>
                                <span>
                                  {effectiveComparisonSpending > result.estimated_household_total
                                    ? `+${Math.round(((effectiveComparisonSpending - result.estimated_household_total) / result.estimated_household_total) * 100)}% vs. benchmark`
                                    : `${Math.round(((effectiveComparisonSpending - result.estimated_household_total) / result.estimated_household_total) * 100)}% vs. benchmark`}
                                </span>
                              </div>
                              <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                                <div
                                  className="h-full bg-foreground transition-all"
                                  style={{
                                    width: `${Math.min(100, Math.max(10, (effectiveComparisonSpending / (Math.max(effectiveComparisonSpending, result.estimated_household_total) * 1.2)) * 100))}%`,
                                  }}
                                  title="Your Spending"
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>₹0</span>
                                <span>
                                  Benchmark: {formatCurrency(result.estimated_household_total)}
                                </span>
                              </div>
                            </div>

                            {/* Descriptive, Non-judgmental Observation */}
                            <div className="rounded border border-primary/20 bg-primary/5 p-3 text-[11px] text-foreground/90 space-y-1">
                              <p className="font-semibold text-foreground">
                                Descriptive Context &amp; Survey Differences
                              </p>
                              <p>
                                {effectiveComparisonSpending > result.estimated_household_total ? (
                                  <>
                                    Your recorded monthly spending is{' '}
                                    <strong>
                                      {formatCurrency(effectiveComparisonSpending - result.estimated_household_total)}
                                    </strong>{' '}
                                    above the survey-estimated benchmark for a comparable household in{' '}
                                    {result.state_name}.
                                  </>
                                ) : (
                                  <>
                                    Your recorded monthly spending is{' '}
                                    <strong>
                                      {formatCurrency(result.estimated_household_total - effectiveComparisonSpending)}
                                    </strong>{' '}
                                    below the survey-estimated benchmark for a comparable household in{' '}
                                    {result.state_name}.
                                  </>
                                )}
                              </p>
                              <p className="text-muted-foreground pt-0.5">
                                Note: National survey expenditure (MoSPI HCES) captures annualized consumption under
                                strict survey schedules. Personal bank/tracker records may represent a narrower or
                                wider set of transactions depending on lifestyle habits, metropolitan cost of living,
                                and unrecorded cash transactions. Higher or lower spending is not an indicator of
                                financial health.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Model Provenance & Metadata */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Model Provenance &amp; Methodology
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="font-medium text-foreground">Algorithm:</span>{' '}
                        {result.model_metadata.algorithm}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Model Version:</span>{' '}
                        {result.model_metadata.version}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Held-out R²:</span>{' '}
                        {result.uncertainty.segment_r2}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Survey:</span> MoSPI HCES 2023–24
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Sample Size:</span>{' '}
                        {result.model_metadata.total_survey_households.toLocaleString()} HHs
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Period:</span> Aug 2023 – Jul 2024
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
