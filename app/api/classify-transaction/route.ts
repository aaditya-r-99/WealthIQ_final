import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  normalizeClassification,
  type ClassifierApiResponse,
  type ClassifierUnavailableResult,
  type RawClassifierResponse,
} from '@/lib/transaction-classifier';

export const dynamic = 'force-dynamic';

const DEFAULT_CLASSIFIER_URL = 'http://127.0.0.1:8000';
// 4500ms timeout accommodates serverless cold starts while maintaining responsive UI
const UPSTREAM_TIMEOUT_MS = Number(process.env.CLASSIFIER_TIMEOUT_MS) || 4500;

// Server-side Supabase client factory for stateless JWT session verification
function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  // 1. Authenticate the caller using their Supabase session Bearer token
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized. An authenticated user session is required to request classification.' },
      { status: 401 }
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized. A valid access token is required.' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or expired authentication session.' },
        { status: 401 }
      );
    }
  } catch (err) {
    console.warn('Supabase authentication check failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'Unauthorized. Invalid or expired authentication session.' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body. Expected a JSON object with a "description" field.' },
      { status: 400 }
    );
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('description' in body) ||
    typeof (body as { description: unknown }).description !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Invalid request body. "description" string field is required.' },
      { status: 400 }
    );
  }

  const rawDescription = (body as { description: string }).description;
  const description = rawDescription.trim();

  if (description.length === 0 || description.length > 500) {
    return NextResponse.json(
      { error: 'Transaction description must be between 1 and 500 characters in length.' },
      { status: 400 }
    );
  }

  const baseUrl = process.env.TRANSACTION_CLASSIFIER_URL || DEFAULT_CLASSIFIER_URL;
  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/predict`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Attach server-to-server secret if configured in environment
    if (process.env.CLASSIFIER_API_SECRET) {
      upstreamHeaders['x-api-key'] = process.env.CLASSIFIER_API_SECRET;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify({ description }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      console.warn(`Upstream classifier responded with HTTP status ${upstreamRes.status}`);
      const unavailableResult: ClassifierUnavailableResult = {
        available: false,
        description,
        isIncome: false,
        category: null,
        suggestedExpenseType: null,
        confidence: null,
        method: 'fallback',
        needsReview: false,
        rawCategory: null,
        userGuidance: 'Classifier service encountered an error. Manual category selection is available.',
        reason: 'error',
      };
      return NextResponse.json(unavailableResult, { status: 200 });
    }

    const data: unknown = await upstreamRes.json();

    if (
      !data ||
      typeof data !== 'object' ||
      !('category' in data) ||
      typeof (data as Record<string, unknown>).category !== 'string'
    ) {
      console.warn('Upstream classifier returned unexpected JSON format (missing category field)');
      const unavailableResult: ClassifierUnavailableResult = {
        available: false,
        description,
        isIncome: false,
        category: null,
        suggestedExpenseType: null,
        confidence: null,
        method: 'fallback',
        needsReview: false,
        rawCategory: null,
        userGuidance: 'Classifier returned unexpected format. Manual category selection is available.',
        reason: 'invalid_response',
      };
      return NextResponse.json(unavailableResult, { status: 200 });
    }

    const normalizedResult = normalizeClassification(
      data as RawClassifierResponse,
      description
    );

    return NextResponse.json(normalizedResult, { status: 200 });
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'));

    if (isAbort) {
      console.warn(`Classifier upstream request timed out after ${UPSTREAM_TIMEOUT_MS}ms`);
    } else {
      console.warn(
        'Unable to connect to upstream classifier:',
        err instanceof Error ? err.message : String(err)
      );
    }

    const unavailableResult: ClassifierUnavailableResult = {
      available: false,
      description,
      isIncome: false,
      category: null,
      suggestedExpenseType: null,
      confidence: null,
      method: 'fallback',
      needsReview: false,
      rawCategory: null,
      userGuidance: isAbort
        ? 'Classification timed out. Please select the category manually.'
        : 'Classifier service is offline. Please select the category manually.',
      reason: isAbort ? 'timeout' : 'offline',
    };

    return NextResponse.json(unavailableResult, { status: 200 });
  }
}

export async function GET() {
  const baseUrl = process.env.TRANSACTION_CLASSIFIER_URL || DEFAULT_CLASSIFIER_URL;
  let upstreamHealthy = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    upstreamHealthy = res.ok;
  } catch {
    upstreamHealthy = false;
  }

  return NextResponse.json({
    status: 'ok',
    upstream_url: baseUrl,
    upstream_healthy: upstreamHealthy,
    configured_in_env: Boolean(process.env.TRANSACTION_CLASSIFIER_URL),
  });
}
