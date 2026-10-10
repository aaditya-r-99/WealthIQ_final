'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ExpenseChart } from '@/components/expense-chart';
import { LoadingState, EmptyState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { classifyTransaction } from '@/lib/transaction-classifier';
import { formatCurrency, formatDate } from '@/lib/format';
import { getRecordMonth, getCurrentCalendarMonth, formatMonthDisplay } from '@/lib/financial-engine';
import type { ExpenseType, ExpenseChartData } from '@/lib/types';
import {
  Plus,
  TrendingDown,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Info,
  Calendar,
} from 'lucide-react';

type ExpenseRow = Database['public']['Tables']['expense_records']['Row'];

const expenseCategories = [
  'Housing',
  'Food',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Education',
  'Entertainment',
  'Shopping',
  'Other',
];

export default function ExpensesPage() {
  const { user, session, authState } = useAuth();
  const [records, setRecords] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentCalendarMonth());

  const [classifying, setClassifying] = useState(false);
  const [suggestionNotice, setSuggestionNotice] = useState<{
    type: 'success' | 'review' | 'income' | 'unavailable' | 'info';
    category?: string | null;
    expenseType?: ExpenseType | null;
    method?: string;
    confidence?: number | null;
    userGuidance?: string | null;
    rawCategory?: string | null;
    needsReview?: boolean;
  } | null>(null);

  const [formData, setFormData] = useState({
    category: 'Housing',
    amount: '',
    expense_type: 'essential' as ExpenseType,
    record_date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const fetchRecords = useCallback(
    async (userId: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await (supabase.from('expense_records') as any)
          .select('*')
          .eq('user_id', userId)
          .order('record_date', { ascending: false });

        if (error) {
          console.error('Error fetching expense records:', error);
          setErrorMessage(error.message || 'Failed to load expense records.');
          return;
        }

        setRecords((data as ExpenseRow[]) || []);
      } catch (err: unknown) {
        console.error('Fetch expenses exception:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred loading expenses.'
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
      category: 'Housing',
      amount: '',
      expense_type: 'essential',
      record_date: new Date().toISOString().split('T')[0],
      description: '',
    });
    setEditingId(null);
    setSuggestionNotice(null);
  };

  const handleSuggestCategory = async () => {
    const desc = formData.description.trim();
    if (!desc) {
      setSuggestionNotice({
        type: 'info',
        userGuidance: 'Enter a transaction description first to request a category suggestion.',
      });
      return;
    }

    if (desc.length > 500) {
      setSuggestionNotice({
        type: 'info',
        userGuidance: 'Transaction description must be 500 characters or fewer.',
      });
      return;
    }

    setClassifying(true);
    setSuggestionNotice(null);

    try {
      const result = await classifyTransaction(desc, {
        accessToken: session?.access_token,
      });

      if (!result.available) {
        setSuggestionNotice({
          type: 'unavailable',
          userGuidance:
            result.userGuidance ||
            'Classifier service is currently offline. Manual category selection remains available.',
        });
        return;
      }

      if (result.isIncome) {
        // Classifier predicted income!
        // Do NOT set as expense category.
        // Provide helpful income guidance and allow user to switch to Income module or dismiss.
        setSuggestionNotice({
          type: 'income',
          method: result.method,
          confidence: result.confidence,
          userGuidance:
            result.userGuidance ||
            'This transaction appears to be income. Consider recording it in the Income module instead of Expenses.',
        });
        return;
      }

      if (result.category) {
        // Populate the editable category and suggested expense type
        setFormData((prev) => ({
          ...prev,
          category: result.category!,
          expense_type: result.suggestedExpenseType || prev.expense_type,
        }));

        setSuggestionNotice({
          type: result.needsReview ? 'review' : 'success',
          category: result.category,
          expenseType: result.suggestedExpenseType,
          method: result.method,
          confidence: result.confidence,
          needsReview: result.needsReview,
          userGuidance: result.userGuidance,
          rawCategory: result.rawCategory,
        });
      }
    } catch {
      // Graceful fallback - never throw or break form
      setSuggestionNotice({
        type: 'unavailable',
        userGuidance:
          'Classifier service encountered a network error. You can select your category manually.',
      });
    } finally {
      setClassifying(false);
    }
  };

  const handleStartEdit = (record: ExpenseRow) => {
    setEditingId(record.id);
    setFormData({
      category: record.category,
      amount: String(record.amount),
      expense_type: record.expense_type as ExpenseType,
      record_date: record.record_date,
      description: record.description || '',
    });
    setSuccessMessage(null);
    setErrorMessage(null);
    setSuggestionNotice(null);
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to manage expenses.');
      return;
    }

    const numericAmount = parseFloat(formData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Please enter a valid positive expense amount.');
      return;
    }

    if (!formData.category) {
      setErrorMessage('Please select a category.');
      return;
    }

    if (!formData.record_date) {
      setErrorMessage('Please select a valid date.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      category: formData.category,
      amount: numericAmount,
      expense_type: formData.expense_type,
      record_date: formData.record_date,
      description: formData.description.trim() || null,
    };

    try {
      if (editingId) {
        const { error } = await (supabase.from('expense_records') as any)
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating expense:', error);
          setErrorMessage(error.message || 'Failed to update expense.');
          return;
        }

        setSuccessMessage('Expense updated successfully.');
      } else {
        const { error } = await (supabase.from('expense_records') as any).insert({
          ...payload,
          user_id: user.id,
        });

        if (error) {
          console.error('Error adding expense:', error);
          setErrorMessage(error.message || 'Failed to add expense.');
          return;
        }

        setSuccessMessage('Expense added successfully.');
      }

      resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Expense submission exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred saving expense.'
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
      const { error } = await (supabase.from('expense_records') as any)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting expense:', error);
        setErrorMessage(error.message || 'Failed to delete expense.');
        return;
      }

      setSuccessMessage('Expense deleted successfully.');
      if (editingId === id) resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Delete expense exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred deleting expense.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const availableMonths = useMemo(() => {
    const current = getCurrentCalendarMonth();
    const monthSet = new Set<string>();
    monthSet.add(current);
    for (const rec of records) {
      const m = getRecordMonth(rec.record_date);
      if (m) monthSet.add(m);
    }
    return Array.from(monthSet).sort().reverse();
  }, [records]);

  // Filter records strictly by selected calendar month (or 'all' if selected)
  const monthlyRecords = useMemo(() => {
    if (selectedMonth === 'all') return records;
    return records.filter((r) => getRecordMonth(r.record_date) === selectedMonth);
  }, [records, selectedMonth]);

  const totalEssential = useMemo(() => {
    return monthlyRecords
      .filter((e) => e.expense_type === 'essential')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [monthlyRecords]);

  const totalDiscretionary = useMemo(() => {
    return monthlyRecords
      .filter((e) => e.expense_type === 'discretionary')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [monthlyRecords]);

  const total = totalEssential + totalDiscretionary;

  // Compute category chart data strictly from filtered monthly records
  const chartData: ExpenseChartData[] = useMemo(() => {
    const categoryMap = new Map<string, { amount: number; type: ExpenseType }>();
    for (const rec of monthlyRecords) {
      const current = categoryMap.get(rec.category);
      if (current) {
        current.amount += Number(rec.amount);
      } else {
        categoryMap.set(rec.category, {
          amount: Number(rec.amount),
          type: rec.expense_type as ExpenseType,
        });
      }
    }
    return Array.from(categoryMap.entries()).map(([category, { amount, type }]) => ({
      category,
      amount,
      type,
    }));
  }, [monthlyRecords]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Expenses"
        description="Track and categorize your monthly expenses."
      >
        <Button
          onClick={() => {
            resetForm();
            window.scrollTo({ top: 250, behavior: 'smooth' });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </PageHeader>

      {/* Month selection filter bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Monthly Spending Period:
          </span>
          <span className="text-sm font-semibold text-primary">
            {selectedMonth === 'all' ? 'All Recorded Expenses' : formatMonthDisplay(selectedMonth)}
          </span>
          {selectedMonth === getCurrentCalendarMonth() && (
            <Badge variant="outline" className="text-[11px] font-normal border-primary/30 text-primary bg-primary/5">
              Current Month
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="month-select" className="text-xs text-muted-foreground whitespace-nowrap">
            Filter Period:
          </Label>
          <Select value={selectedMonth} onValueChange={(val) => setSelectedMonth(val)}>
            <SelectTrigger id="month-select" className="w-[190px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthDisplay(m)} {m === getCurrentCalendarMonth() ? '(Current)' : ''}
                </SelectItem>
              ))}
              <SelectItem value="all">All Time (All Records)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Total Monthly {selectedMonth === 'all' ? '(All Time)' : `(${formatMonthDisplay(selectedMonth)})`}
            </p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(total)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {monthlyRecords.length} record{monthlyRecords.length === 1 ? '' : 's'} in selected period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Essential</p>
            <p className="mt-1 text-2xl font-bold text-chart-1">
              {formatCurrency(totalEssential)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {total > 0 ? `${Math.round((totalEssential / total) * 100)}% of monthly total` : '₹0 recorded'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Discretionary</p>
            <p className="mt-1 text-2xl font-bold text-chart-3">
              {formatCurrency(totalDiscretionary)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {total > 0 ? `${Math.round((totalDiscretionary / total) * 100)}% of monthly total` : '₹0 recorded'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit expense form */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? 'Edit Expense' : 'Add New Expense'}
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
            {/* Description & Smart Category Suggestion */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Enter merchant or memo to get AI category suggestions
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="description"
                  placeholder="e.g., Swiggy dinner order, Uber ride, House rent"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSuggestCategory}
                  disabled={classifying || saving}
                  className="shrink-0 gap-1.5 border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  {classifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Suggesting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>Suggest Category</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Smart Suggestion Notice / Review Banner */}
            {suggestionNotice && (
              <div
                className={`mb-4 rounded-lg border p-3.5 text-sm transition-all ${
                  suggestionNotice.type === 'income'
                    ? 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-100'
                    : suggestionNotice.type === 'review'
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100'
                    : suggestionNotice.type === 'unavailable'
                    ? 'border-muted-foreground/20 bg-muted/30 text-muted-foreground'
                    : suggestionNotice.type === 'info'
                    ? 'border-primary/20 bg-primary/5 text-foreground'
                    : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {suggestionNotice.type === 'income' ? (
                      <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                    ) : suggestionNotice.type === 'review' ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    ) : suggestionNotice.type === 'unavailable' ? (
                      <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    ) : suggestionNotice.type === 'info' ? (
                      <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    ) : (
                      <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    )}

                    <div className="space-y-1">
                      {suggestionNotice.type === 'income' ? (
                        <>
                          <p className="font-semibold text-blue-700 dark:text-blue-300">
                            Income Transaction Detected
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {suggestionNotice.userGuidance}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild className="h-7 text-xs border-blue-500/30">
                              <Link href="/income" className="gap-1">
                                Go to Income Module
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setSuggestionNotice(null)}
                            >
                              Continue as Expense
                            </Button>
                          </div>
                        </>
                      ) : suggestionNotice.type === 'unavailable' ? (
                        <p className="font-medium text-xs">
                          {suggestionNotice.userGuidance}
                        </p>
                      ) : suggestionNotice.type === 'info' ? (
                        <p className="font-medium text-xs">
                          {suggestionNotice.userGuidance}
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-xs">
                              {suggestionNotice.type === 'review' ? 'Suggested with Review:' : 'Suggested Category:'}
                            </span>
                            <Badge variant="outline" className="font-medium text-xs bg-background/80">
                              {suggestionNotice.category}
                            </Badge>
                            {suggestionNotice.expenseType && (
                              <Badge variant="secondary" className="text-[11px] capitalize">
                                {suggestionNotice.expenseType}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase tracking-wider text-muted-foreground border-border/60"
                            >
                              {suggestionNotice.method === 'rule' ? 'Keyword Rule' : 'ML Model'}
                            </Badge>
                            {suggestionNotice.method === 'ml' &&
                              typeof suggestionNotice.confidence === 'number' && (
                                <span className="text-[11px] text-muted-foreground">
                                  ({Math.round(suggestionNotice.confidence * 100)}% confidence)
                                </span>
                              )}
                          </div>
                          {suggestionNotice.userGuidance && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {suggestionNotice.userGuidance}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground/80 mt-1">
                            Category and type populated below. You can accept or override them before saving.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setSuggestionNotice(null)}
                    title="Dismiss notice"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, category: val }))}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="5000"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.expense_type}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, expense_type: val as ExpenseType }))
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essential">Essential</SelectItem>
                    <SelectItem value="discretionary">Discretionary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, record_date: e.target.value }))}
                  required
                />
              </div>
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
                    {editingId ? 'Update Expense' : 'Save Expense'}
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

      {/* Chart */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Expense Breakdown by Category {selectedMonth !== 'all' ? `(${formatMonthDisplay(selectedMonth)})` : '(All Time)'}
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {monthlyRecords.length} transaction{monthlyRecords.length === 1 ? '' : 's'}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {monthlyRecords.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No expenses recorded for {selectedMonth === 'all' ? 'any month' : formatMonthDisplay(selectedMonth)}.
            </div>
          ) : (
            <ExpenseChart data={chartData} type="bar" />
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Expense History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading expense records..." />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<TrendingDown className="h-6 w-6" />}
              title="No expenses recorded"
              description="Add your first expense to start tracking your spending."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.category}</TableCell>
                    <TableCell>{formatCurrency(Number(expense.amount))}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          expense.expense_type === 'essential'
                            ? 'bg-chart-1/10 text-chart-1'
                            : 'bg-chart-3/10 text-chart-3'
                        }`}
                      >
                        {expense.expense_type}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(expense.record_date)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.description || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(expense)}
                          title="Edit expense"
                          disabled={saving || deletingId === expense.id}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
                          title="Delete expense"
                          disabled={saving || deletingId === expense.id}
                        >
                          {deletingId === expense.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-danger" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-danger" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
