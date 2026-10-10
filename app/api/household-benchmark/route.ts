import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import { INDIAN_STATES } from '@/lib/household-benchmark';

export const dynamic = 'force-dynamic';

const DEFAULT_BENCHMARK_SERVICE_URL = 'http://127.0.0.1:8002';
const UPSTREAM_TIMEOUT_MS = Number(process.env.BENCHMARK_TIMEOUT_MS) || 4000;

// Set of valid 2-digit state codes
const VALID_STATE_CODES = new Set(INDIAN_STATES.map((s) => s.code));

const VALID_SECTORS = new Set(['rural', 'urban']);
const VALID_EDUCATIONS = new Set(['below_primary', 'primary_middle', 'secondary_higher', 'graduate_above']);
const VALID_LIVELIHOODS = new Set(['regular_wage', 'self_employed', 'casual_labour', 'other']);
const VALID_DWELLINGS = new Set(['pucca', 'semi_pucca', 'katcha']);
const VALID_COOKING_FUELS = new Set(['lpg', 'png_electric', 'firewood', 'other']);
const VALID_LAND = new Set(['owned', 'not_owned']);

/**
 * Execute inference via direct Python script execution as resilient fallback.
 */
function runPythonInferenceFallback(payload: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve(process.cwd(), 'ml', 'predict_benchmark.py');
    // Prefer the virtualenv python if available, else python3
    const pythonBin =
      process.env.PYTHON_BIN ||
      '/home/aditya/Downloads/transaction-categorization/.venv/bin/python';

    const child = execFile(
      pythonBin,
      [pythonScript, JSON.stringify(payload)],
      {
        cwd: process.cwd(),
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          return reject(
            new Error(
              `Fallback script execution failed: ${error.message}${stderr ? ' - ' + stderr.trim() : ''}`
            )
          );
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.error) {
            return reject(new Error(parsed.error));
          }
          return resolve(parsed);
        } catch (parseErr) {
          return reject(
            new Error(`Failed to parse script output: ${stdout.slice(0, 200)}`)
          );
        }
      }
    );
  });
}

export async function GET() {
  const serviceUrl = process.env.BENCHMARK_API_URL || DEFAULT_BENCHMARK_SERVICE_URL;
  let upstreamHealthy = false;
  let metadata: any = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const healthRes = await fetch(`${serviceUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (healthRes.ok) {
      upstreamHealthy = true;
    }
  } catch {
    upstreamHealthy = false;
  }

  return NextResponse.json({
    status: 'ok',
    service: 'WealthIQ HCES 2023-24 Household Spending Benchmark',
    version: '1.0.0',
    model_algorithm: 'HistGradientBoostingRegressor',
    upstream_service_url: serviceUrl,
    upstream_healthy: upstreamHealthy,
    states_supported: INDIAN_STATES.length,
    features_required: [
      'state',
      'sector',
      'highest_education',
      'livelihood',
      'dwelling_type',
      'cooking_fuel',
      'land_owned',
      'hh_size',
      'num_adults',
      'num_children',
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. JSON payload is required.' },
        { status: 400 }
      );
    }

    // 1. Rigorous input validation
    const state = String(body.state || '').trim().padStart(2, '0');
    if (!VALID_STATE_CODES.has(state)) {
      return NextResponse.json(
        {
          error: `Invalid or missing state code '${body.state}'. Please select a valid Indian State or Union Territory.`,
        },
        { status: 422 }
      );
    }

    const sector = String(body.sector || '').toLowerCase().trim();
    if (!VALID_SECTORS.has(sector)) {
      return NextResponse.json(
        { error: "Invalid sector. Must be either 'rural' or 'urban'." },
        { status: 422 }
      );
    }

    const highest_education = String(body.highest_education || '').toLowerCase().trim();
    if (!VALID_EDUCATIONS.has(highest_education)) {
      return NextResponse.json(
        {
          error: `Invalid education tier '${body.highest_education}'. Supported tiers: ${Array.from(VALID_EDUCATIONS).join(', ')}.`,
        },
        { status: 422 }
      );
    }

    const livelihood = String(body.livelihood || '').toLowerCase().trim();
    if (!VALID_LIVELIHOODS.has(livelihood)) {
      return NextResponse.json(
        {
          error: `Invalid livelihood type '${body.livelihood}'. Supported types: ${Array.from(VALID_LIVELIHOODS).join(', ')}.`,
        },
        { status: 422 }
      );
    }

    const dwelling_type = String(body.dwelling_type || '').toLowerCase().trim();
    if (!VALID_DWELLINGS.has(dwelling_type)) {
      return NextResponse.json(
        {
          error: `Invalid dwelling type '${body.dwelling_type}'. Supported types: ${Array.from(VALID_DWELLINGS).join(', ')}.`,
        },
        { status: 422 }
      );
    }

    const cooking_fuel = String(body.cooking_fuel || '').toLowerCase().trim();
    if (!VALID_COOKING_FUELS.has(cooking_fuel)) {
      return NextResponse.json(
        {
          error: `Invalid cooking fuel '${body.cooking_fuel}'. Supported types: ${Array.from(VALID_COOKING_FUELS).join(', ')}.`,
        },
        { status: 422 }
      );
    }

    const land_owned = String(body.land_owned || '').toLowerCase().trim();
    if (!VALID_LAND.has(land_owned)) {
      return NextResponse.json(
        {
          error: `Invalid land ownership '${body.land_owned}'. Must be 'owned' or 'not_owned'.`,
        },
        { status: 422 }
      );
    }

    const hh_size = Number(body.hh_size);
    if (!Number.isInteger(hh_size) || hh_size < 1 || hh_size > 25) {
      return NextResponse.json(
        { error: 'Household size must be an integer between 1 and 25 members.' },
        { status: 422 }
      );
    }

    let num_adults = Number(body.num_adults ?? hh_size);
    if (!Number.isInteger(num_adults) || num_adults < 1 || num_adults > hh_size) {
      num_adults = Math.max(1, Math.min(hh_size, Math.round(num_adults) || 1));
    }

    let num_children = Number(body.num_children ?? (hh_size - num_adults));
    if (!Number.isInteger(num_children) || num_children < 0 || num_adults + num_children !== hh_size) {
      num_children = Math.max(0, hh_size - num_adults);
    }

    const sanitizedPayload = {
      state,
      sector,
      highest_education,
      livelihood,
      dwelling_type,
      cooking_fuel,
      land_owned,
      hh_size,
      num_adults,
      num_children,
    };

    // 2. Try Upstream Inference Service (Port 8002 / BENCHMARK_API_URL)
    const serviceUrl = process.env.BENCHMARK_API_URL || DEFAULT_BENCHMARK_SERVICE_URL;
    let inferenceResult: any = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

      const upstreamHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (process.env.BENCHMARK_API_SECRET) {
        upstreamHeaders['x-api-key'] = process.env.BENCHMARK_API_SECRET;
      }

      const upstreamRes = await fetch(`${serviceUrl}/predict`, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(sanitizedPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (upstreamRes.ok) {
        inferenceResult = await upstreamRes.json();
      }
    } catch {
      // Upstream service unavailable or timed out; fallback to local script
      inferenceResult = null;
    }

    // 3. Fallback to direct script execution if HTTP microservice was unreachable
    if (!inferenceResult) {
      try {
        inferenceResult = await runPythonInferenceFallback(sanitizedPayload);
      } catch (fallbackError: any) {
        return NextResponse.json(
          {
            error:
              'Household benchmark inference engine is currently unavailable. Please verify the ML service is running.',
            detail: process.env.NODE_ENV === 'development' ? fallbackError?.message : undefined,
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(inferenceResult);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'An unexpected internal error occurred while calculating benchmark.' },
      { status: 500 }
    );
  }
}
