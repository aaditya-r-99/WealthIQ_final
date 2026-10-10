/**
 * WealthIQ Transaction Classifier Normalization Engine & Shared Types (Phase 1)
 *
 * Provides category normalization from the upstream Python hybrid classifier
 * to standard WealthIQ expense categories, conservative expense_type defaults,
 * income redirection, and graceful offline fallback handling.
 */

import { supabase } from '@/lib/supabase/client';

export const WEALTHIQ_EXPENSE_CATEGORIES = [
  'Housing',
  'Food',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Education',
  'Entertainment',
  'Shopping',
  'Other',
] as const;

export type WealthIQExpenseCategory = (typeof WEALTHIQ_EXPENSE_CATEGORIES)[number];
export type ExpenseType = 'essential' | 'discretionary';

export interface RawClassifierResponse {
  description: string;
  category: string;
  method: 'rule' | 'ml' | string;
  confidence: number | null;
  needs_review?: boolean;
}

export interface ClassifierSuccessResult {
  available: true;
  description: string;
  isIncome: boolean;
  category: WealthIQExpenseCategory | null;
  suggestedExpenseType: ExpenseType | null;
  confidence: number | null;
  method: 'rule' | 'ml' | string;
  needsReview: boolean;
  rawCategory: string;
  userGuidance: string | null;
}

export interface ClassifierUnavailableResult {
  available: false;
  description: string;
  isIncome: false;
  category: null;
  suggestedExpenseType: null;
  confidence: null;
  method: 'fallback';
  needsReview: false;
  rawCategory: null;
  userGuidance: string | null;
  reason?: 'offline' | 'timeout' | 'error' | 'invalid_response' | 'invalid_request';
}

export type ClassifierApiResponse = ClassifierSuccessResult | ClassifierUnavailableResult;

export interface CategoryMappingRule {
  targetCategory: WealthIQExpenseCategory | null;
  defaultExpenseType: ExpenseType | null;
  isIncome?: boolean;
  forceNeedsReview?: boolean;
  userGuidance?: string;
}

/**
 * Explicit dictionary mapping upstream classifier categories to WealthIQ categories.
 *
 * Mappings:
 * - Food & Dining → Food
 * - Healthcare & Medical → Healthcare
 * - Shopping & Retail → Shopping
 * - Utilities & Services → Utilities
 * - Entertainment & Recreation → Entertainment
 * - Transportation → Transportation
 * - Housing & Rent → Housing
 * - Charity & Donations → Other (discretionary)
 * - Government & Legal → Other, with review indication
 * - Financial Services → Other, with suggestion to review Debts module
 * - Income → Flagged as income, not an expense
 * - Education: Kept available in UI, classifier does not produce this label
 */
export const CATEGORY_MAPPINGS: Record<string, CategoryMappingRule> = {
  'Food & Dining': {
    targetCategory: 'Food',
    defaultExpenseType: 'essential',
  },
  'Healthcare & Medical': {
    targetCategory: 'Healthcare',
    defaultExpenseType: 'essential',
  },
  'Shopping & Retail': {
    targetCategory: 'Shopping',
    defaultExpenseType: 'discretionary',
  },
  'Utilities & Services': {
    targetCategory: 'Utilities',
    defaultExpenseType: 'essential',
  },
  'Entertainment & Recreation': {
    targetCategory: 'Entertainment',
    defaultExpenseType: 'discretionary',
  },
  'Transportation': {
    targetCategory: 'Transportation',
    defaultExpenseType: 'essential',
  },
  'Housing & Rent': {
    targetCategory: 'Housing',
    defaultExpenseType: 'essential',
  },
  'Housing': {
    targetCategory: 'Housing',
    defaultExpenseType: 'essential',
  },
  'Charity & Donations': {
    targetCategory: 'Other',
    defaultExpenseType: 'discretionary',
    forceNeedsReview: true,
    userGuidance: "Charity & donation mapped to 'Other'. Categorized as discretionary by default.",
  },
  'Government & Legal': {
    targetCategory: 'Other',
    defaultExpenseType: 'essential',
    forceNeedsReview: true,
    userGuidance: "Government & legal fee mapped to 'Other'. Please confirm category and expense type.",
  },
  'Financial Services': {
    targetCategory: 'Other',
    defaultExpenseType: 'essential',
    forceNeedsReview: true,
    userGuidance: "Financial service or EMI detected. WealthIQ tracks loans under Debts. Mapped to 'Other' if logging as an expense.",
  },
  'Income': {
    targetCategory: null,
    defaultExpenseType: null,
    isIncome: true,
    forceNeedsReview: true,
    userGuidance: 'This transaction appears to be income. Consider recording it in the Income module instead of Expenses.',
  },
};

/**
 * Normalizes raw upstream classifier output into a safe WealthIQ classification result.
 */
export function normalizeClassification(
  raw: RawClassifierResponse,
  fallbackDescription?: string
): ClassifierSuccessResult {
  const description = raw.description || fallbackDescription || '';
  const rawCategory = (raw.category || '').trim();
  const upstreamNeedsReview = Boolean(raw.needs_review);
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : null;
  const isLowConfidence = confidence !== null && confidence < 0.70;

  const mapping = CATEGORY_MAPPINGS[rawCategory];

  if (mapping) {
    if (mapping.isIncome) {
      return {
        available: true,
        description,
        isIncome: true,
        category: null,
        suggestedExpenseType: null,
        confidence,
        method: raw.method || 'rule',
        needsReview: true,
        rawCategory,
        userGuidance: mapping.userGuidance || 'Detected as income credit.',
      };
    }

    const needsReview =
      upstreamNeedsReview ||
      isLowConfidence ||
      Boolean(mapping.forceNeedsReview);

    let guidance = mapping.userGuidance || null;
    if (isLowConfidence && !guidance) {
      guidance = `Low model confidence (${Math.round((confidence || 0) * 100)}%). Please verify the suggested category.`;
    }

    return {
      available: true,
      description,
      isIncome: false,
      category: mapping.targetCategory,
      suggestedExpenseType: mapping.defaultExpenseType,
      confidence,
      method: raw.method || 'ml',
      needsReview,
      rawCategory,
      userGuidance: guidance,
    };
  }

  // Unmapped / unknown category fallback
  return {
    available: true,
    description,
    isIncome: false,
    category: 'Other',
    suggestedExpenseType: 'discretionary',
    confidence,
    method: raw.method || 'fallback',
    needsReview: true,
    rawCategory,
    userGuidance: `Unrecognized category "${rawCategory}". Defaulted to "Other". Please review.`,
  };
}

export interface ClassifyOptions {
  accessToken?: string | null;
  fetchImpl?: typeof fetch;
}

/**
 * Client-safe helper to classify a transaction description via Next.js API route.
 * Never throws unhandled errors; returns structured fallback if offline or failed.
 */
export async function classifyTransaction(
  description: string,
  optionsOrFetch?: ClassifyOptions | typeof fetch
): Promise<ClassifierApiResponse> {
  const fetchImpl =
    typeof optionsOrFetch === 'function'
      ? optionsOrFetch
      : optionsOrFetch?.fetchImpl || fetch;

  let accessToken =
    typeof optionsOrFetch === 'object' && optionsOrFetch !== null
      ? optionsOrFetch.accessToken
      : undefined;

  if (!accessToken && typeof window !== 'undefined') {
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token ?? null;
    } catch {
      accessToken = null;
    }
  }

  const trimmed = description.trim();
  if (!trimmed || trimmed.length > 500) {
    return {
      available: false,
      description: trimmed,
      isIncome: false,
      category: null,
      suggestedExpenseType: null,
      confidence: null,
      method: 'fallback',
      needsReview: false,
      rawCategory: null,
      userGuidance: 'Transaction description must be between 1 and 500 characters.',
      reason: 'invalid_request',
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetchImpl('/api/classify-transaction', {
      method: 'POST',
      headers,
      body: JSON.stringify({ description: trimmed }),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      const isAuthError = res.status === 401;
      return {
        available: false,
        description: trimmed,
        isIncome: false,
        category: null,
        suggestedExpenseType: null,
        confidence: null,
        method: 'fallback',
        needsReview: false,
        rawCategory: null,
        userGuidance: isAuthError
          ? errorJson?.error || 'Please sign in to request category suggestions.'
          : errorJson?.error || 'Unable to classify transaction.',
        reason: 'error',
      };
    }

    const data: ClassifierApiResponse = await res.json();
    return data;
  } catch (err: unknown) {
    return {
      available: false,
      description: trimmed,
      isIncome: false,
      category: null,
      suggestedExpenseType: null,
      confidence: null,
      method: 'fallback',
      needsReview: false,
      rawCategory: null,
      userGuidance: 'Network error or classifier unavailable. Manual category selection available.',
      reason: 'offline',
    };
  }
}
