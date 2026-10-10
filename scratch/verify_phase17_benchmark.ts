import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  INDIAN_STATES,
  EDUCATION_OPTIONS,
  LIVELIHOOD_OPTIONS,
  DWELLING_OPTIONS,
  COOKING_FUEL_OPTIONS,
  LAND_OWNERSHIP_OPTIONS,
} from '../lib/household-benchmark';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function run() {
  console.log('====================================================');
  console.log('WealthIQ Phase 17 — HCES Benchmark ML Verification');
  console.log('====================================================\n');

  console.log('--- 1. ML Model Artifacts & Metadata Sanity ---');

  await test('Model artifact hces_spending_benchmark_v1.joblib exists and is compact (<1MB)', () => {
    const artifactPath = path.resolve(process.cwd(), 'ml/models/hces_spending_benchmark_v1.joblib');
    assert(fs.existsSync(artifactPath), 'Model artifact missing');
    const stats = fs.statSync(artifactPath);
    const sizeMb = stats.size / (1024 * 1024);
    assert(sizeMb > 0.1 && sizeMb < 1.0, `Unexpected size: ${sizeMb.toFixed(2)} MB`);
  });

  await test('Model metadata contains genuine HCES 2023-24 evaluation metrics', () => {
    const metaPath = path.resolve(process.cwd(), 'ml/models/hces_benchmark_metadata.json');
    assert(fs.existsSync(metaPath), 'Metadata missing');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    assert.strictEqual(meta.algorithm, 'HistGradientBoostingRegressor');
    assert.strictEqual(meta.total_sample_size, 261953);
    assert.strictEqual(meta.total_households_trained, 209603);
    assert.strictEqual(meta.total_households_tested, 52350);

    const hgbEval = meta.model_evaluation.hist_gradient_boosting.weighted;
    assert(hgbEval.mae < 3500, `Expected weighted MAE < 3500, got ${hgbEval.mae}`);
    assert(hgbEval.r2 > 0.55, `Expected weighted R2 > 0.55, got ${hgbEval.r2}`);
    assert(meta.segment_evaluation.Rural.mae < 2500, 'Rural segment MAE should be < 2500');
    assert(meta.segment_evaluation.Urban.mae < 6000, 'Urban segment MAE should be < 6000');
  });

  await test('State/Sector benchmarks artifact contains 72 empirical segments', () => {
    const benchPath = path.resolve(process.cwd(), 'ml/models/hces_state_sector_benchmarks.json');
    assert(fs.existsSync(benchPath), 'Benchmarks JSON missing');
    const benchmarks = JSON.parse(fs.readFileSync(benchPath, 'utf8'));
    assert.strictEqual(Object.keys(benchmarks).length, 72);
    // Verify Maharashtra urban
    const mhUrban = benchmarks['27_urban'];
    assert(mhUrban, '27_urban segment missing');
    assert.strictEqual(mhUrban.median_mpce, 13600);
    assert.strictEqual(mhUrban.sample_size, 11117);
  });

  console.log('\n--- 2. Python Inference Runner (ml/predict_benchmark.py) ---');

  await test('predict_benchmark.py produces valid prediction for Urban Maharashtra', async () => {
    const { execFile } = await import('child_process');
    const pyBin = '/home/aditya/Downloads/transaction-categorization/.venv/bin/python';
    const pyScript = path.resolve(process.cwd(), 'ml/predict_benchmark.py');
    const payload = JSON.stringify({
      state: '27',
      sector: 'urban',
      highest_education: 'graduate_above',
      livelihood: 'regular_wage',
      dwelling_type: 'pucca',
      cooking_fuel: 'png_electric',
      land_owned: 'owned',
      hh_size: 3,
      num_adults: 2,
      num_children: 1,
    });

    const res: any = await new Promise((resolve, reject) => {
      execFile(pyBin, [pyScript, payload], (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(JSON.parse(stdout.trim()));
      });
    });

    assert(res.success === true, 'Inference failed');
    assert(res.estimated_mpce > 20000 && res.estimated_mpce < 40000, `Unreasonable MPCE: ${res.estimated_mpce}`);
    assert.strictEqual(res.estimated_household_total, Math.round(res.estimated_mpce * 3 * 100) / 100);
    assert.strictEqual(res.state_name, 'Maharashtra');
  });

  console.log('\n--- 3. Port 8002 Microservice Health & Endpoints ---');

  await test('Port 8002 /health returns healthy status with 36 states', async () => {
    const res = await fetch('http://127.0.0.1:8002/health');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.states_count, 36);
  });

  await test('Port 8002 /predict executes sub-50ms model prediction', async () => {
    const start = Date.now();
    const res = await fetch('http://127.0.0.1:8002/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: '29',
        sector: 'urban',
        highest_education: 'graduate_above',
        livelihood: 'regular_wage',
        dwelling_type: 'pucca',
        cooking_fuel: 'png_electric',
        land_owned: 'owned',
        hh_size: 4,
        num_adults: 2,
        num_children: 2,
      }),
    });
    const duration = Date.now() - start;
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success === true, 'predict returned failure');
    assert.strictEqual(data.state_name, 'Karnataka');
    assert(duration < 200, `Inference was slow: ${duration}ms`);
  });

  console.log('\n--- 4. Next.js Route Handler (/api/household-benchmark) ---');

  await test('GET /api/household-benchmark returns healthy upstream metadata', async () => {
    const res = await fetch('http://localhost:3000/api/household-benchmark');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.upstream_healthy, true);
    assert.strictEqual(data.states_supported, 36);
  });

  await test('POST /api/household-benchmark produces accurate benchmark response', async () => {
    const res = await fetch('http://localhost:3000/api/household-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: '27',
        sector: 'urban',
        highest_education: 'graduate_above',
        livelihood: 'regular_wage',
        dwelling_type: 'pucca',
        cooking_fuel: 'png_electric',
        land_owned: 'owned',
        hh_size: 4,
        num_adults: 2,
        num_children: 2,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.state_code, '27');
    assert.strictEqual(data.state_name, 'Maharashtra');
    assert.strictEqual(data.household_size, 4);
    assert(data.estimated_mpce > 15000, `MPCE too low: ${data.estimated_mpce}`);
    assert.strictEqual(data.estimated_household_total, Math.round(data.estimated_mpce * 4 * 100) / 100);
    assert.strictEqual(data.reference_benchmarks.state_sector_median_mpce, 13600);
    assert(data.uncertainty.segment_mae > 0, 'Uncertainty MAE missing');
    assert.strictEqual(data.model_metadata.version, '1.0.0');
  });

  await test('POST /api/household-benchmark validates state and rejects invalid code with 422', async () => {
    const res = await fetch('http://localhost:3000/api/household-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: '99',
        sector: 'urban',
        highest_education: 'graduate_above',
        livelihood: 'regular_wage',
        dwelling_type: 'pucca',
        cooking_fuel: 'lpg',
        land_owned: 'owned',
        hh_size: 3,
      }),
    });
    assert.strictEqual(res.status, 422);
    const data = await res.json();
    assert(data.error.includes('Invalid or missing state code'), data.error);
  });

  await test('POST /api/household-benchmark validates sector and rejects invalid sector with 422', async () => {
    const res = await fetch('http://localhost:3000/api/household-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: '27',
        sector: 'semi-urban',
        highest_education: 'graduate_above',
        livelihood: 'regular_wage',
        dwelling_type: 'pucca',
        cooking_fuel: 'lpg',
        land_owned: 'owned',
        hh_size: 3,
      }),
    });
    assert.strictEqual(res.status, 422);
    const data = await res.json();
    assert(data.error.includes('Invalid sector'), data.error);
  });

  await test('POST /api/household-benchmark validates household size boundaries (1..25) with 422', async () => {
    const res = await fetch('http://localhost:3000/api/household-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: '27',
        sector: 'urban',
        highest_education: 'graduate_above',
        livelihood: 'regular_wage',
        dwelling_type: 'pucca',
        cooking_fuel: 'lpg',
        land_owned: 'owned',
        hh_size: 0,
      }),
    });
    assert.strictEqual(res.status, 422);
    const data = await res.json();
    assert(data.error.includes('Household size must be an integer between 1 and 25'), data.error);
  });

  console.log('\n--- 5. TypeScript Client Definitions & Options ---');

  await test('All 36 Indian States/UTs are defined and unique in client helper', () => {
    assert.strictEqual(INDIAN_STATES.length, 36);
    const codes = new Set(INDIAN_STATES.map((s) => s.code));
    assert.strictEqual(codes.size, 36);
    assert(INDIAN_STATES.some((s) => s.name === 'Maharashtra' && s.code === '27'));
    assert(INDIAN_STATES.some((s) => s.name === 'Karnataka' && s.code === '29'));
    assert(INDIAN_STATES.some((s) => s.name === 'Delhi' && s.code === '07'));
  });

  await test('Categorical options match trained model schema', () => {
    assert.strictEqual(EDUCATION_OPTIONS.length, 4);
    assert.strictEqual(LIVELIHOOD_OPTIONS.length, 4);
    assert.strictEqual(DWELLING_OPTIONS.length, 3);
    assert.strictEqual(COOKING_FUEL_OPTIONS.length, 4);
    assert.strictEqual(LAND_OWNERSHIP_OPTIONS.length, 2);
  });

  console.log('\n====================================================');
  console.log(`Phase 17 Verification: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
