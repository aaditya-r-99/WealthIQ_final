'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { MetricCard } from '@/components/metric-card';
import { LoadingState, EmptyState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { MOCK_FD_RATES } from '@/lib/mock-data';
import {
  VERIFIED_OCT_2026_FD_PROFILES,
  lookupVerifiedFDRate,
  type VerifiedBankFDProfile,
} from '@/lib/fd-rates-data';
import {
  Plus,
  Landmark,
  Trash2,
  Pencil,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type FDRow = Database['public']['Tables']['fixed_deposits']['Row'];

export default function FDPage() {
  const { user, authState } = useAuth();
  const [records, setRecords] = useState<FDRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bank_name: 'HDFC',
    principal: '',
    interest_rate: '6.25',
    tenure_months: '12',
    start_date: new Date().toISOString().split('T')[0],
    maturity_date: '',
    senior_citizen: false,
  });

  const [comparisonTab, setComparisonTab] = useState<'headline' | 'schedules'>('headline');
  const [expandedBank, setExpandedBank] = useState<string | null>('hdfc');

  const suggestedRate = lookupVerifiedFDRate(
    formData.bank_name,
    Number(formData.tenure_months) || 12,
    formData.senior_citizen
  );

  const handleBankChange = (newBank: string) => {
    const tenure = Number(formData.tenure_months) || 12;
    const verified = lookupVerifiedFDRate(newBank, tenure, formData.senior_citizen);
    setFormData((prev) => ({
      ...prev,
      bank_name: newBank,
      interest_rate: verified ? String(verified.rate) : prev.interest_rate,
    }));
  };

  const handleTenureChange = (newTenure: string) => {
    const tenureNum = Number(newTenure);
    const verified = lookupVerifiedFDRate(formData.bank_name, isNaN(tenureNum) ? 12 : tenureNum, formData.senior_citizen);
    setFormData((prev) => ({
      ...prev,
      tenure_months: newTenure,
      interest_rate: verified ? String(verified.rate) : prev.interest_rate,
    }));
  };

  const handleSeniorCitizenChange = (checked: boolean) => {
    const tenure = Number(formData.tenure_months) || 12;
    const verified = lookupVerifiedFDRate(formData.bank_name, tenure, checked);
    setFormData((prev) => ({
      ...prev,
      senior_citizen: checked,
      interest_rate: verified ? String(verified.rate) : prev.interest_rate,
    }));
  };

  const fetchRecords = useCallback(
    async (userId: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await (supabase.from('fixed_deposits') as any)
          .select('*')
          .eq('user_id', userId)
          .order('start_date', { ascending: false });

        if (error) {
          console.error('Error fetching fixed deposits:', error);
          setErrorMessage(error.message || 'Failed to load fixed deposits.');
          return;
        }

        setRecords((data as FDRow[]) || []);
      } catch (err: unknown) {
        console.error('Fetch fixed deposits exception:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred loading fixed deposits.'
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (user?.id) {
      fetchRecords(user.id);
    } else if (authState === 'unauthenticated') {
      setLoading(false);
    }
  }, [user?.id, authState, fetchRecords]);

  const resetForm = () => {
    setFormData({
      bank_name: 'HDFC',
      principal: '',
      interest_rate: '6.25',
      tenure_months: '12',
      start_date: new Date().toISOString().split('T')[0],
      maturity_date: '',
      senior_citizen: false,
    });
    setEditingId(null);
  };

  const handleStartEdit = (fd: FDRow) => {
    setEditingId(fd.id);
    setFormData({
      bank_name: fd.bank_name,
      principal: String(fd.principal),
      interest_rate: String(fd.interest_rate),
      tenure_months: String(fd.tenure_months),
      start_date: fd.start_date,
      maturity_date: fd.maturity_date || '',
      senior_citizen: Boolean(fd.senior_citizen),
    });
    setSuccessMessage(null);
    setErrorMessage(null);
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to manage fixed deposits.');
      return;
    }

    const principal = parseFloat(formData.principal);
    const rate = parseFloat(formData.interest_rate);
    const tenure = parseInt(formData.tenure_months, 10);

    if (isNaN(principal) || principal <= 0) {
      setErrorMessage('Please enter a valid positive principal amount.');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      setErrorMessage('Please enter a valid interest rate.');
      return;
    }
    if (isNaN(tenure) || tenure <= 0) {
      setErrorMessage('Please enter a valid tenure in months.');
      return;
    }
    if (!formData.start_date) {
      setErrorMessage('Please select a start date.');
      return;
    }

    // Auto-calculate maturity date if not explicitly filled
    let calculatedMaturity = formData.maturity_date.trim() || null;
    if (!calculatedMaturity && formData.start_date) {
      const d = new Date(formData.start_date);
      d.setMonth(d.getMonth() + tenure);
      calculatedMaturity = d.toISOString().split('T')[0];
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      bank_name: formData.bank_name,
      principal,
      interest_rate: rate,
      tenure_months: tenure,
      start_date: formData.start_date,
      maturity_date: calculatedMaturity,
      senior_citizen: formData.senior_citizen,
    };

    try {
      if (editingId) {
        const { error } = await (supabase.from('fixed_deposits') as any)
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating fixed deposit:', error);
          setErrorMessage(error.message || 'Failed to update fixed deposit.');
          return;
        }

        setSuccessMessage('Fixed deposit updated successfully.');
      } else {
        const { error } = await (supabase.from('fixed_deposits') as any).insert({
          ...payload,
          user_id: user.id,
        });

        if (error) {
          console.error('Error adding fixed deposit:', error);
          setErrorMessage(error.message || 'Failed to add fixed deposit.');
          return;
        }

        setSuccessMessage('Fixed deposit added successfully.');
      }

      resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Fixed deposit submission exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred saving fixed deposit.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await (supabase.from('fixed_deposits') as any)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting fixed deposit:', error);
        setErrorMessage(error.message || 'Failed to delete fixed deposit.');
        return;
      }

      setSuccessMessage('Fixed deposit deleted successfully.');
      if (editingId === id) resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Delete fixed deposit exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred deleting fixed deposit.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const totalPrincipal = records.reduce((sum, fd) => sum + Number(fd.principal), 0);
  const totalValue = records.reduce((sum, fd) => {
    const interest = Number(fd.principal) * (Number(fd.interest_rate) / 100) * (Number(fd.tenure_months) / 12);
    return sum + Number(fd.principal) + interest;
  }, 0);
  const avgInterestRate =
    records.length > 0
      ? (records.reduce((s, f) => s + Number(f.interest_rate), 0) / records.length).toFixed(1)
      : '0.0';

  return (
    <DashboardLayout>
      <PageHeader
        title="Fixed Deposits"
        description="Track your FDs and compare bank rates."
      >
        <Button
          onClick={() => {
            resetForm();
            window.scrollTo({ top: 250, behavior: 'smooth' });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add FD
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total FD Principal"
          value={formatCurrency(totalPrincipal)}
          icon={<Landmark className="h-4 w-4" />}
          accent="primary"
        />
        <MetricCard
          title="Estimated Maturity Value"
          value={formatCurrency(totalValue)}
          subtitle="Approx. with interest"
          accent="success"
        />
        <MetricCard
          title="Active FDs"
          value={String(records.length)}
          accent="neutral"
        />
        <MetricCard
          title="Avg. Interest Rate"
          value={`${avgInterestRate}%`}
          accent="primary"
        />
      </div>

      {/* Add / Edit form */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? 'Edit Fixed Deposit' : 'Add New Fixed Deposit'}
            </CardTitle>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-4 text-success">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fd-bank">Bank Name</Label>
                <Select
                  value={formData.bank_name}
                  onValueChange={handleBankChange}
                >
                  <SelectTrigger id="fd-bank">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFIED_OCT_2026_FD_PROFILES.map((p) => (
                      <SelectItem key={p.shortName} value={p.shortName}>
                        {p.bankName}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other Bank">Other Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-principal">Principal (₹)</Label>
                <Input
                  id="fd-principal"
                  type="number"
                  placeholder="100000"
                  value={formData.principal}
                  onChange={(e) => setFormData((prev) => ({ ...prev, principal: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fd-rate">Interest Rate (%)</Label>
                  {suggestedRate && formData.interest_rate !== String(suggestedRate.rate) && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, interest_rate: String(suggestedRate.rate) }))}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Use card rate ({suggestedRate.rate}%)
                    </button>
                  )}
                </div>
                <Input
                  id="fd-rate"
                  type="number"
                  step="0.01"
                  placeholder="6.25"
                  value={formData.interest_rate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, interest_rate: e.target.value }))
                  }
                  required
                />
                {suggestedRate ? (
                  <p className="text-[11px] text-muted-foreground">
                    Verified rate: <strong className="text-foreground">{suggestedRate.rate}%</strong> ({suggestedRate.bucketLabel})
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Custom bank rate. Please verify with your branch.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-tenure">Tenure (months)</Label>
                <Input
                  id="fd-tenure"
                  type="number"
                  placeholder="12"
                  value={formData.tenure_months}
                  onChange={(e) => handleTenureChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-start">Start Date</Label>
                <Input
                  id="fd-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-maturity">Maturity Date (optional)</Label>
                <Input
                  id="fd-maturity"
                  type="date"
                  value={formData.maturity_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, maturity_date: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Switch
                id="senior"
                checked={formData.senior_citizen}
                onCheckedChange={handleSeniorCitizenChange}
              />
              <Label htmlFor="senior">Senior Citizen (higher rate applicable for aged 60+)</Label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button type="submit" disabled={saving || loading}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {editingId ? (
                      <Pencil className="mr-2 h-4 w-4" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {editingId ? 'Update FD' : 'Save FD'}
                  </>
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Your FDs */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your Fixed Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading fixed deposits..." />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Landmark className="h-6 w-6" />}
              title="No fixed deposits found"
              description="Add your first fixed deposit to track principal, interest returns, and maturity dates."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Tenure</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Maturity</TableHead>
                  <TableHead>Senior</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((fd) => {
                  return (
                    <TableRow key={fd.id}>
                      <TableCell className="font-medium">{fd.bank_name}</TableCell>
                      <TableCell>{formatCurrency(Number(fd.principal))}</TableCell>
                      <TableCell>{fd.interest_rate}%</TableCell>
                      <TableCell>{fd.tenure_months} months</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(fd.start_date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {fd.maturity_date ? formatDate(fd.maturity_date) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {fd.senior_citizen ? (
                          <span className="text-xs font-medium text-success">Yes</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(fd)}
                            title="Edit FD"
                            disabled={saving || deletingId === fd.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(fd.id)}
                            title="Delete FD"
                            disabled={saving || deletingId === fd.id}
                          >
                            {deletingId === fd.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-danger" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-danger" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Verified Bank FD Rate Comparison (October 2026) */}
      <Card className="mt-6 border border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Verified Bank FD Rates (Applicable October 2026)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Official retail domestic fixed deposits (&lt; ₹3 Crore). Regular and senior citizen rates kept distinct.
              </p>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/60 p-1 rounded-lg border border-border/50">
              <button
                type="button"
                onClick={() => setComparisonTab('headline')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  comparisonTab === 'headline'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                12-Month Benchmark
              </button>
              <button
                type="button"
                onClick={() => setComparisonTab('schedules')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  comparisonTab === 'schedules'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Full Tenure Schedules
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {comparisonTab === 'headline' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead>12M Regular</TableHead>
                    <TableHead>12M Senior Citizen</TableHead>
                    <TableHead>Min. Deposit</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Premature Withdrawal &amp; Notes</TableHead>
                    <TableHead className="text-right">Official Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {VERIFIED_OCT_2026_FD_PROFILES.map((profile) => (
                    <TableRow key={profile.bankId}>
                      <TableCell className="font-semibold">{profile.bankName}</TableCell>
                      <TableCell className="font-bold text-foreground">
                        {profile.twelveMonthRegularRate.toFixed(2)}%
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {profile.twelveMonthSeniorRate.toFixed(2)}%
                      </TableCell>
                      <TableCell>{formatCurrency(profile.minimumDepositAmount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {profile.depositClassification}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {profile.effectiveDate}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        {profile.prematureWithdrawalPolicy}
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={profile.officialSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Official Portal
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Select a bank below to view its complete tenure buckets from 7 days up to 10 years verified from official October 2026 rate circulars.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {VERIFIED_OCT_2026_FD_PROFILES.map((profile) => (
                  <button
                    key={profile.bankId}
                    type="button"
                    onClick={() => setExpandedBank(profile.bankId)}
                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                      expandedBank === profile.bankId
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-border/80'
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground">{profile.shortName}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{profile.depositClassification}</span>
                    <span className="text-[11px] text-primary font-medium mt-2">
                      12M: {profile.twelveMonthRegularRate}% (Sr: {profile.twelveMonthSeniorRate}%)
                    </span>
                  </button>
                ))}
              </div>

              {/* Expanded Bank's Full Schedule */}
              {(() => {
                const selected = VERIFIED_OCT_2026_FD_PROFILES.find((p) => p.bankId === expandedBank) || VERIFIED_OCT_2026_FD_PROFILES[0];
                return (
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          {selected.bankName} — Full Rate Schedule
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Effective: {selected.effectiveDate} • {selected.compoundingFrequency}
                        </p>
                      </div>
                      <a
                        href={selected.officialSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline self-start sm:self-auto"
                      >
                        Verify on {selected.shortName} official website
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tenure Bucket</TableHead>
                            <TableHead>General Public Rate (p.a.)</TableHead>
                            <TableHead>Senior Citizen Rate (p.a.)</TableHead>
                            <TableHead>Applicable Conditions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selected.tenureBuckets.map((b) => (
                            <TableRow key={b.tenureLabel}>
                              <TableCell className="font-medium text-xs">{b.tenureLabel}</TableCell>
                              <TableCell className="font-bold text-foreground text-xs">
                                {b.regularRate.toFixed(2)}%
                              </TableCell>
                              <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                                {b.seniorRate.toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {b.minMonths === 12 ? 'Standard 1-year benchmark' : 'Applicable card rate'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Important Rate &amp; Methodology Disclosures:</p>
            <p>
              • <strong>Verified Official Sources:</strong> Rates are directly retrieved from official portals of State Bank of India, HDFC Bank, ICICI Bank, and RBL Bank applicable in October 2026.
            </p>
            <p>
              • <strong>Deposit Classification:</strong> Rates apply strictly to retail domestic deposits (&lt; ₹3 Crore). Bulk deposits (₹3 Crore and above) and non-resident schemes (NRE/FCNR) have distinct schedules.
            </p>
            <p>
              • <strong>Compounding &amp; Payout:</strong> Quarterly compounding applies to cumulative reinvestment term deposits. Premature withdrawal is subject to bank penalties and does not apply to non-callable products.
            </p>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
