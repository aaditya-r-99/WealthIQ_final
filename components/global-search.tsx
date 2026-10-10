'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  X,
  Compass,
  Wallet,
  Receipt,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Landmark,
  LineChart,
  Sparkles,
  BarChart3,
  User,
  Settings,
  ArrowRight,
  Loader2,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  IncomeRow,
  ExpenseRow,
  SavingsRow,
  DebtRow,
  InvestmentRow,
  FDRow,
} from '@/lib/financial-engine';

export interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  category: 'page' | 'income' | 'expense' | 'savings' | 'debt' | 'investment' | 'fd';
  badge: string;
  keywords?: string[];
}

interface UserFinancialData {
  income: IncomeRow[];
  expenses: ExpenseRow[];
  savings: SavingsRow[];
  debts: DebtRow[];
  investments: InvestmentRow[];
  fds: FDRow[];
}

const CORE_PAGES: SearchItem[] = [
  {
    id: 'page-dashboard',
    title: 'Dashboard',
    subtitle: 'Financial health score, net worth, key metrics & summary',
    url: '/dashboard',
    category: 'page',
    badge: 'Page',
    keywords: ['dashboard', 'home', 'overview', 'health', 'score', 'net worth', 'metrics', 'summary'],
  },
  {
    id: 'page-income',
    title: 'Income',
    subtitle: 'Monthly cash flow, salary, freelance, revenue streams',
    url: '/income',
    category: 'page',
    badge: 'Page',
    keywords: ['income', 'salary', 'earnings', 'revenue', 'wages', 'cash inflow', 'streams'],
  },
  {
    id: 'page-expenses',
    title: 'Expenses',
    subtitle: 'Spending tracking, essential vs discretionary breakdown',
    url: '/expenses',
    category: 'page',
    badge: 'Page',
    keywords: ['expenses', 'spending', 'transactions', 'costs', 'bills', 'budget', 'discretionary', 'essential'],
  },
  {
    id: 'page-savings',
    title: 'Savings',
    subtitle: 'Emergency funds, liquid savings accounts, cash reserves',
    url: '/savings',
    category: 'page',
    badge: 'Page',
    keywords: ['savings', 'emergency fund', 'accounts', 'cash reserve', 'deposits', 'liquidity'],
  },
  {
    id: 'page-debts',
    title: 'Debts',
    subtitle: 'Active loans, credit balances, monthly EMIs, interest rates',
    url: '/debts',
    category: 'page',
    badge: 'Page',
    keywords: ['debts', 'loans', 'liabilities', 'emi', 'borrowing', 'credit', 'interest'],
  },
  {
    id: 'page-investments',
    title: 'Investments',
    subtitle: 'Stock portfolio, mutual funds, per-unit pricing & gains',
    url: '/investments',
    category: 'page',
    badge: 'Page',
    keywords: ['investments', 'stocks', 'portfolio', 'shares', 'equity', 'mutual funds', 'holdings'],
  },
  {
    id: 'page-fd',
    title: 'Fixed Deposits',
    subtitle: 'Bank FDs, principal deposits, interest yields & tenures',
    url: '/fd',
    category: 'page',
    badge: 'Page',
    keywords: ['fixed deposits', 'fd', 'term deposit', 'interest', 'bank', 'tenure', 'maturity'],
  },
  {
    id: 'page-forecast',
    title: 'Forecast',
    subtitle: 'Deterministic net worth & surplus projections (6M–36M)',
    url: '/forecast',
    category: 'page',
    badge: 'Page',
    keywords: ['forecast', 'projections', 'future', 'simulation', 'net worth trajectory', 'surplus'],
  },
  {
    id: 'page-household-benchmark',
    title: 'Household Benchmark',
    subtitle: 'India HCES 2023–24 consumption expenditure benchmark & comparison',
    url: '/household-benchmark',
    category: 'page',
    badge: 'Page',
    keywords: ['household benchmark', 'benchmark', 'spending', 'hces', 'consumption', 'expenditure', 'peer spending', 'india spending', 'mpce', 'lifestyle'],
  },
  {
    id: 'page-market-insights',
    title: 'Market Insights',
    subtitle: 'Market indices, Nifty 50, Sensex, Gold & macro data',
    url: '/market-insights',
    category: 'page',
    badge: 'Page',
    keywords: ['market insights', 'market', 'nifty', 'sensex', 'gold', 'indices', 'macro', 'live market'],
  },
  {
    id: 'page-profile',
    title: 'Profile',
    subtitle: 'Personal information, employment, risk tolerance, goals',
    url: '/profile',
    category: 'page',
    badge: 'Page',
    keywords: ['profile', 'account', 'user details', 'email', 'name', 'risk tolerance', 'goal'],
  },
  {
    id: 'page-settings',
    title: 'Settings',
    subtitle: 'Preferences, notification triggers, password & currency',
    url: '/settings',
    category: 'page',
    badge: 'Page',
    keywords: ['settings', 'preferences', 'notifications', 'password', 'security', 'currency', 'theme'],
  },
];

function getItemIcon(category: SearchItem['category']) {
  switch (category) {
    case 'page':
      return <Compass className="h-4 w-4 text-foreground" />;
    case 'income':
      return <Wallet className="h-4 w-4 text-emerald-600" />;
    case 'expense':
      return <Receipt className="h-4 w-4 text-rose-600" />;
    case 'savings':
      return <PiggyBank className="h-4 w-4 text-emerald-600" />;
    case 'debt':
      return <CreditCard className="h-4 w-4 text-rose-600" />;
    case 'investment':
      return <TrendingUp className="h-4 w-4 text-foreground" />;
    case 'fd':
      return <Landmark className="h-4 w-4 text-foreground" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

export function GlobalSearch() {
  const router = useRouter();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userRecords, setUserRecords] = useState<UserFinancialData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordsCacheRef = useRef<UserFinancialData | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // OS detection for keyboard shortcut label
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.userAgent.includes('Mac')) {
      setIsMac(true);
    }
  }, []);

  // Fetch authenticated user's records with security isolation and caching
  const fetchUserRecords = useCallback(async () => {
    if (!user?.id) return;
    const now = Date.now();
    // Cache for 30s to prevent spamming while keeping searches fast
    if (recordsCacheRef.current && now - lastFetchTimeRef.current < 30000) {
      setUserRecords(recordsCacheRef.current);
      return;
    }

    setLoading(true);
    try {
      const [incRes, expRes, savRes, dbtRes, invRes, fdRes] = await Promise.all([
        (supabase.from('income_records') as any).select('*').eq('user_id', user.id),
        (supabase.from('expense_records') as any).select('*').eq('user_id', user.id),
        (supabase.from('savings_records') as any).select('*').eq('user_id', user.id),
        (supabase.from('debts') as any).select('*').eq('user_id', user.id),
        (supabase.from('investments') as any).select('*').eq('user_id', user.id),
        (supabase.from('fixed_deposits') as any).select('*').eq('user_id', user.id),
      ]);

      const data: UserFinancialData = {
        income: (incRes.data as IncomeRow[]) || [],
        expenses: (expRes.data as ExpenseRow[]) || [],
        savings: (savRes.data as SavingsRow[]) || [],
        debts: (dbtRes.data as DebtRow[]) || [],
        investments: (invRes.data as InvestmentRow[]) || [],
        fds: (fdRes.data as FDRow[]) || [],
      };

      recordsCacheRef.current = data;
      lastFetchTimeRef.current = now;
      setUserRecords(data);
    } catch (err) {
      console.error('Failed to fetch user financial data for search:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        fetchUserRecords();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [fetchUserRecords]);

  // Search Results evaluation
  const { matchedPages, matchedRecords, allItems } = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return {
        matchedPages: CORE_PAGES,
        matchedRecords: [],
        allItems: CORE_PAGES,
      };
    }

    // 1. Match Pages
    const pages = CORE_PAGES.filter((p) => {
      return (
        p.title.toLowerCase().includes(trimmed) ||
        p.subtitle?.toLowerCase().includes(trimmed) ||
        p.keywords?.some((k) => k.toLowerCase().includes(trimmed))
      );
    });

    // 2. Match Financial Records
    const records: SearchItem[] = [];

    if (userRecords) {
      // Income
      for (const r of userRecords.income) {
        const type = r.income_type || 'Income';
        const amountStr = String(r.amount || 0);
        if (type.toLowerCase().includes(trimmed) || amountStr.includes(trimmed)) {
          records.push({
            id: `inc-${r.id}`,
            title: `Income: ${type}`,
            subtitle: `₹${Number(r.amount).toLocaleString('en-IN')}${r.record_date ? ` • ${r.record_date}` : ''}`,
            url: '/income',
            category: 'income',
            badge: 'Income',
          });
        }
      }

      // Expenses
      for (const r of userRecords.expenses) {
        const cat = r.category || 'Expense';
        const desc = r.description || '';
        const expType = r.expense_type || '';
        const amountStr = String(r.amount || 0);
        if (
          cat.toLowerCase().includes(trimmed) ||
          desc.toLowerCase().includes(trimmed) ||
          expType.toLowerCase().includes(trimmed) ||
          amountStr.includes(trimmed)
        ) {
          records.push({
            id: `exp-${r.id}`,
            title: `Expense: ${cat}${desc ? ` (${desc})` : ''}`,
            subtitle: `₹${Number(r.amount).toLocaleString('en-IN')} • ${expType === 'essential' ? 'Essential' : 'Discretionary'}${r.record_date ? ` • ${r.record_date}` : ''}`,
            url: '/expenses',
            category: 'expense',
            badge: 'Expense',
          });
        }
      }

      // Savings
      for (const r of userRecords.savings) {
        const type = r.savings_type || 'Savings';
        const amountStr = String(r.amount || 0);
        if (type.toLowerCase().includes(trimmed) || amountStr.includes(trimmed)) {
          records.push({
            id: `sav-${r.id}`,
            title: `Savings: ${type}`,
            subtitle: `₹${Number(r.amount).toLocaleString('en-IN')}${r.record_date ? ` • ${r.record_date}` : ''}`,
            url: '/savings',
            category: 'savings',
            badge: 'Savings',
          });
        }
      }

      // Debts
      for (const r of userRecords.debts) {
        const type = r.debt_type || 'Debt';
        const balStr = String(r.remaining_balance || 0);
        const emiStr = String(r.monthly_emi || 0);
        if (type.toLowerCase().includes(trimmed) || balStr.includes(trimmed) || emiStr.includes(trimmed)) {
          records.push({
            id: `dbt-${r.id}`,
            title: `Debt: ${type}`,
            subtitle: `Balance: ₹${Number(r.remaining_balance).toLocaleString('en-IN')} • EMI: ₹${Number(r.monthly_emi).toLocaleString('en-IN')}`,
            url: '/debts',
            category: 'debt',
            badge: 'Debt',
          });
        }
      }

      // Investments
      for (const r of userRecords.investments) {
        const symbol = r.symbol || 'Investment';
        const asset = r.asset_type || '';
        const qtyStr = String(r.quantity || 0);
        const curValStr = String(r.current_value || 0);
        const purValStr = String(r.purchase_price || 0);
        if (
          symbol.toLowerCase().includes(trimmed) ||
          asset.toLowerCase().includes(trimmed) ||
          qtyStr.includes(trimmed) ||
          curValStr.includes(trimmed) ||
          purValStr.includes(trimmed)
        ) {
          const totalVal = Number(r.quantity || 0) * Number(r.current_value || 0);
          records.push({
            id: `inv-${r.id}`,
            title: `Investment: ${symbol} (${asset})`,
            subtitle: `${r.quantity} units @ ₹${Number(r.current_value).toLocaleString('en-IN')}/unit • Value: ₹${totalVal.toLocaleString('en-IN')}`,
            url: '/investments',
            category: 'investment',
            badge: 'Investment',
          });
        }
      }

      // Fixed Deposits
      for (const r of userRecords.fds) {
        const bank = r.bank_name || 'Fixed Deposit';
        const principalStr = String(r.principal || 0);
        const rateStr = String(r.interest_rate || 0);
        if (bank.toLowerCase().includes(trimmed) || principalStr.includes(trimmed) || rateStr.includes(trimmed)) {
          records.push({
            id: `fd-${r.id}`,
            title: `Fixed Deposit: ${bank}`,
            subtitle: `Principal: ₹${Number(r.principal).toLocaleString('en-IN')} • ${r.interest_rate}% p.a. • ${r.tenure_months}m`,
            url: '/fd',
            category: 'fd',
            badge: 'Fixed Deposit',
          });
        }
      }
    }

    return {
      matchedPages: pages,
      matchedRecords: records,
      allItems: [...pages, ...records],
    };
  }, [query, userRecords]);

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems]);

  // Navigate to item
  const handleSelect = (url: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(url);
    inputRef.current?.blur();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (allItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % allItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (allItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems.length > 0 && allItems[selectedIndex]) {
        handleSelect(allItems[selectedIndex].url);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setQuery('');
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            fetchUserRecords();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="pl-9 pr-14 bg-muted/50 border-border/50 hover:bg-muted/70 focus:bg-background transition-colors h-9 text-sm rounded-lg"
          aria-label="Global search"
          aria-expanded={isOpen}
          role="combobox"
          aria-autocomplete="list"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Clear search query"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-80">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          )}
        </div>
      </div>

      {/* Floating Results Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
          <ScrollArea className="max-h-[380px] divide-y divide-border/40">
            {allItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2">
                  <Search className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">No results found for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                  Try searching for a page name (e.g. &ldquo;Investments&rdquo;) or a financial record (e.g. &ldquo;Salary&rdquo;, &ldquo;Tata&rdquo;, &ldquo;Rent&rdquo;).
                </p>
              </div>
            ) : (
              <div className="py-2">
                {/* Pages section */}
                {matchedPages.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {query.trim() ? 'Pages & Modules' : 'Quick Navigation'}
                    </div>
                    {matchedPages.map((item) => {
                      const itemGlobalIndex = allItems.findIndex((x) => x.id === item.id);
                      const isSelected = itemGlobalIndex === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'group flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors select-none',
                            isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'
                          )}
                          onClick={() => handleSelect(item.url)}
                          onMouseEnter={() => setSelectedIndex(itemGlobalIndex)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="shrink-0 p-1 rounded-md bg-muted/80">
                              {getItemIcon(item.category)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {item.badge}
                            </Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Financial records section */}
                {matchedRecords.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Your Financial Records ({matchedRecords.length})
                    </div>
                    {matchedRecords.map((item) => {
                      const itemGlobalIndex = allItems.findIndex((x) => x.id === item.id);
                      const isSelected = itemGlobalIndex === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'group flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors select-none',
                            isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'
                          )}
                          onClick={() => handleSelect(item.url)}
                          onMouseEnter={() => setSelectedIndex(itemGlobalIndex)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="shrink-0 p-1 rounded-md bg-muted/80">
                              {getItemIcon(item.category)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {item.badge}
                            </Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer Keyboard Hints */}
          <div className="border-t border-border/50 px-3 py-2 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">↑</kbd>
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">↓</kbd>
                <span className="ml-1">to navigate</span>
              </span>
              <span className="flex items-center gap-0.5">
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">↵</kbd>
                <span className="ml-1">to open</span>
              </span>
            </div>
            <span className="flex items-center gap-0.5">
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">esc</kbd>
              <span className="ml-1">to close</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
