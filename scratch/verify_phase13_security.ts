/**
 * Verification Test Suite for WealthIQ Phase 13:
 * Vercel Deployment Preparation & API Security Hardening
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { POST, GET } from '../app/api/classify-transaction/route';
import {
  classifyTransaction,
  normalizeClassification,
  WEALTHIQ_EXPENSE_CATEGORIES,
} from '../lib/transaction-classifier';

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`  [PASS] ${desc}`);
          passed++;
        })
        .catch((err) => {
          console.error(`  [FAIL] ${desc}:`, err.message);
          failed++;
        });
    } else {
      console.log(`  [PASS] ${desc}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`  [FAIL] ${desc}:`, err.message);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('WealthIQ Phase 13 — Security Hardening Test Suite');
  console.log('====================================================\n');

  console.log('--- 1. Next.js Proxy Route Authentication Gate ---');

  await it('Rejects requests missing Authorization header with 401', async () => {
    const req = new Request('http://localhost:3000/api/classify-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Swiggy order' }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401, 'Status must be 401');
    const json = await res.json();
    assert(json.error.includes('authenticated user session is required'), 'Contains auth guidance');
  });

  await it('Rejects requests with empty Bearer token with 401', async () => {
    const req = new Request('http://localhost:3000/api/classify-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer   ',
      },
      body: JSON.stringify({ description: 'Swiggy order' }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401, 'Status must be 401');
    const json = await res.json();
    assert(json.error.includes('Unauthorized'), 'Contains auth guidance');
  });

  await it('Rejects requests with invalid Bearer token with 401', async () => {
    const req = new Request('http://localhost:3000/api/classify-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_forged_jwt_token_12345',
      },
      body: JSON.stringify({ description: 'Swiggy order' }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401, 'Status must be 401');
    const json = await res.json();
    assert(json.error.includes('Invalid or expired'), 'Contains auth expired guidance');
  });

  await it('Rejects requests with non-Bearer auth schemes with 401', async () => {
    const req = new Request('http://localhost:3000/api/classify-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic dXNlcjpwYXNz',
      },
      body: JSON.stringify({ description: 'Swiggy order' }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401, 'Status must be 401');
  });

  console.log('\n--- 2. Health Endpoint GET /api/classify-transaction ---');

  await it('GET /api/classify-transaction reports status and upstream reachability', async () => {
    const res = await GET();
    assert.strictEqual(res.status, 200, 'GET health must return 200');
    const json = await res.json();
    assert.strictEqual(json.status, 'ok', 'Status must be ok');
    assert(typeof json.upstream_url === 'string', 'Upstream URL must be present');
    assert(typeof json.upstream_healthy === 'boolean', 'upstream_healthy boolean present');
  });

  console.log('\n--- 3. Client Helper classifyTransaction Authentication & Errors ---');

  await it('Returns invalid_request for empty description', async () => {
    const res = await classifyTransaction('   ');
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.reason, 'invalid_request');
  });

  await it('Returns invalid_request for descriptions exceeding 500 characters', async () => {
    const res = await classifyTransaction('a'.repeat(501));
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.reason, 'invalid_request');
  });

  await it('Maps 401 Unauthorized to user-friendly sign-in guidance', async () => {
    const mockFetch = (async () => {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. An authenticated user session is required to request classification.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const res = await classifyTransaction('Swiggy order', { fetchImpl: mockFetch });
    assert.strictEqual(res.available, false);
    assert(res.userGuidance?.includes('sign in') || res.userGuidance?.includes('Unauthorized'), 'Mentions sign-in');
  });

  await it('Forwards accessToken in Authorization header when provided', async () => {
    let capturedHeaders: any = null;
    const mockFetch = (async (_url: string, init: any) => {
      capturedHeaders = init?.headers;
      return new Response(
        JSON.stringify({
          available: true,
          description: 'Swiggy order',
          isIncome: false,
          category: 'Food',
          suggestedExpenseType: 'essential',
          confidence: 0.95,
          method: 'rule',
          needsReview: false,
          rawCategory: 'Food & Dining',
          userGuidance: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const res = await classifyTransaction('Swiggy order', {
      accessToken: 'test_token_abc_123',
      fetchImpl: mockFetch,
    });
    assert.strictEqual(res.available, true);
    assert.strictEqual(res.category, 'Food');
    assert.strictEqual(capturedHeaders?.['Authorization'], 'Bearer test_token_abc_123');
  });

  console.log('\n--- 4. Isolated Classifier Deployment Package Audit ---');

  const pkgDir = path.resolve('/home/aditya/Projects/wealthiq-classifier');

  await it('Classifier package directory exists with required deployment files', () => {
    assert(fs.existsSync(pkgDir), 'Directory exists');
    assert(fs.existsSync(path.join(pkgDir, 'api/index.py')), 'api/index.py exists');
    assert(fs.existsSync(path.join(pkgDir, 'hybrid_classifier_v2.py')), 'hybrid_classifier_v2.py exists');
    assert(fs.existsSync(path.join(pkgDir, 'preprocess.py')), 'preprocess.py exists');
    assert(fs.existsSync(path.join(pkgDir, 'requirements.txt')), 'requirements.txt exists');
    assert(fs.existsSync(path.join(pkgDir, '.python-version')), '.python-version exists');
    assert(fs.existsSync(path.join(pkgDir, 'vercel.json')), 'vercel.json exists');
    assert(fs.existsSync(path.join(pkgDir, 'models/indian_transaction_classifier_v2.joblib')), 'Model artifact exists');
  });

  await it('.python-version pins Python 3.12', () => {
    const pyVer = fs.readFileSync(path.join(pkgDir, '.python-version'), 'utf8').trim();
    assert.strictEqual(pyVer, '3.12');
  });

  await it('requirements.txt excludes heavy training dependencies (pandas, pyarrow)', () => {
    const rawReqs = fs.readFileSync(path.join(pkgDir, 'requirements.txt'), 'utf8');
    const activePackages = rawReqs
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .join('\n');
    assert(!activePackages.includes('pandas'), 'Must not include pandas');
    assert(!activePackages.includes('pyarrow'), 'Must not include pyarrow');
    assert(!activePackages.includes('seaborn'), 'Must not include seaborn');
    assert(!activePackages.includes('matplotlib'), 'Must not include matplotlib');
    assert(activePackages.includes('scikit-learn'), 'Must include scikit-learn');
    assert(activePackages.includes('joblib'), 'Must include joblib');
    assert(activePackages.includes('fastapi'), 'Must include fastapi');
  });

  await it('Package is clean of datasets and training artifacts', () => {
    function findParquetOrCsv(dir: string): string[] {
      let found: string[] = [];
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (item !== '.git' && item !== '__pycache__' && item !== '.venv') {
            found = found.concat(findParquetOrCsv(full));
          }
        } else {
          if (item.endsWith('.parquet') || item.endsWith('.csv') || item.endsWith('.tsv')) {
            found.push(full);
          }
        }
      }
      return found;
    }
    const datasetFiles = findParquetOrCsv(pkgDir);
    assert.strictEqual(datasetFiles.length, 0, `Found dataset files: ${datasetFiles.join(', ')}`);
  });

  await it('Total classifier package payload size is strictly under 5MB', () => {
    function getDirSize(dir: string): number {
      let size = 0;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (item !== '.git' && item !== '__pycache__' && item !== '.venv') {
            size += getDirSize(full);
          }
        } else {
          size += stat.size;
        }
      }
      return size;
    }
    const totalBytes = getDirSize(pkgDir);
    const totalMB = totalBytes / (1024 * 1024);
    console.log(`     Total classifier package size: ${totalMB.toFixed(2)} MB`);
    assert(totalMB < 5.0, `Package size (${totalMB.toFixed(2)} MB) must be under 5 MB`);
  });

  console.log('\n--- 5. Category Normalization & Safety Preservation ---');

  await it('Category mappings preserve all 9 WealthIQ categories', () => {
    const categories = WEALTHIQ_EXPENSE_CATEGORIES;
    assert.strictEqual(categories.length, 9);
    assert(categories.includes('Food'));
    assert(categories.includes('Housing'));
    assert(categories.includes('Utilities'));
    assert(categories.includes('Transportation'));
    assert(categories.includes('Healthcare'));
    assert(categories.includes('Entertainment'));
    assert(categories.includes('Shopping'));
    assert(categories.includes('Education'));
    assert(categories.includes('Other'));
  });

  await it('Salary credit correctly classified as income credit', () => {
    const normalized = normalizeClassification({
      description: 'Salary credited from Infosys',
      category: 'Income',
      method: 'rule',
      confidence: 1.0,
      needs_review: true,
    });
    assert.strictEqual(normalized.isIncome, true);
    assert.strictEqual(normalized.category, null);
    assert.strictEqual(normalized.needsReview, true);
  });

  console.log('\n====================================================');
  console.log(`Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
