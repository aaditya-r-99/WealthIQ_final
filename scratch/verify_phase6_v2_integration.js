/**
 * Phase 6 Verification Suite: Controlled Local Integration of Indian Classifier v2
 *
 * Verifies:
 * 1. Health & Isolation of v2 on port 8001 and v1 on port 8000
 * 2. API contract compliance of v2 service
 * 3. Regression test suite covering Indian merchants & contextual disambiguation
 * 4. P2P UPI & Out-of-vocabulary ambiguity detection (needs_review = true)
 * 5. Input validation (empty, >500 chars, non-JSON)
 * 6. Live Next.js Proxy integration with TRANSACTION_CLASSIFIER_URL=http://127.0.0.1:8001
 * 7. Normalization into WealthIQ categories (Housing & Rent -> Housing, Income redirection, Debt guidance)
 * 8. Fallback resilience when upstream is offline
 * 9. Preservation of v1 baseline on port 8000
 */

const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  console.log('================================================================');
  console.log('  WEALTHIQ — PHASE 6 INTEGRATION & REGRESSION VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: SERVICE HEALTH & ISOLATION CHECK
  // -------------------------------------------------------------
  console.log('>>> TEST GROUP 1: SERVICE HEALTH & PORT ISOLATION');

  // Verify port 8000 is still running v1
  const v1HealthRes = await fetch('http://127.0.0.1:8000/health');
  const v1Health = await v1HealthRes.json();
  assert(v1HealthRes.status === 200, 'v1 service on port 8000 returns HTTP 200');
  assert(v1Health.status === 'healthy', 'v1 service on port 8000 status is "healthy"');

  // Verify port 8001 is running v2
  const v2HealthRes = await fetch('http://127.0.0.1:8001/health');
  const v2Health = await v2HealthRes.json();
  assert(v2HealthRes.status === 200, 'v2 service on port 8001 returns HTTP 200');
  assert(v2Health.status === 'healthy', 'v2 service on port 8001 status is "healthy"');
  assert(v2Health.version === 'v2', 'v2 service reports version "v2"');
  assert(v2Health.model === 'indian_transaction_classifier_v2', 'v2 service reports model "indian_transaction_classifier_v2"');

  // -------------------------------------------------------------
  // TEST GROUP 2: API CONTRACT COMPLIANCE (PORT 8001)
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 2: API CONTRACT COMPLIANCE');

  const contractReqStart = Date.now();
  const contractRes = await fetch('http://127.0.0.1:8001/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Swiggy dinner order' }),
  });
  const contractDuration = Date.now() - contractReqStart;
  const contractData = await contractRes.json();

  assert(contractRes.status === 200, 'POST /predict returns HTTP 200');
  assert(typeof contractData.description === 'string', 'Response contains "description" (string)');
  assert(typeof contractData.category === 'string', 'Response contains "category" (string)');
  assert(typeof contractData.method === 'string', 'Response contains "method" (string: rule|ml)');
  assert(typeof contractData.confidence === 'number' || contractData.confidence === null, 'Response contains "confidence" (number or null)');
  assert(typeof contractData.needs_review === 'boolean', 'Response contains "needs_review" (boolean)');
  assert(contractDuration < 500, `v2 prediction latency is within acceptable limits (${contractDuration}ms < 500ms)`);

  // -------------------------------------------------------------
  // TEST GROUP 3: REGRESSION TEST SUITE ACROSS INDIAN CATEGORIES
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 3: REGRESSION TEST SUITE (PORT 8001 DIRECT)');

  const testCases = [
    // 1. Food Delivery & Quick Commerce
    { desc: 'Swiggy food order 48291', expCat: 'Food & Dining', expReview: false, note: 'Swiggy food delivery' },
    { desc: 'Zomato dining restaurant bill', expCat: 'Food & Dining', expReview: false, note: 'Zomato restaurant' },
    { desc: 'UPI/432198765432/Blinkit/blinkit@icici', expCat: 'Food & Dining', expReview: false, note: 'Blinkit quick commerce' },
    { desc: 'Zepto 10 min grocery delivery', expCat: 'Food & Dining', expReview: false, note: 'Zepto quick commerce' },
    { desc: 'BigBasket order BB-98234 groceries', expCat: 'Food & Dining', expReview: false, note: 'BigBasket groceries' },
    { desc: 'DMart Ready grocery retail store', expCat: 'Food & Dining', expReview: false, note: 'DMart groceries' },

    // 2. Housing, Rent & Society Maintenance
    { desc: 'Monthly house rent payment to landlord', expCat: 'Housing & Rent', expReview: false, note: 'House rent' },
    { desc: 'Paying guest monthly rent PG accommodation', expCat: 'Housing & Rent', expReview: false, note: 'PG accommodation' },
    { desc: 'Society maintenance charges Orchid Woods', expCat: 'Housing & Rent', expReview: false, note: 'Society maintenance' },
    { desc: 'MyGate society dues payment', expCat: 'Housing & Rent', expReview: false, note: 'MyGate apartment maintenance' },
    { desc: 'NoBroker rent payment for flat', expCat: 'Housing & Rent', expReview: false, note: 'NoBroker flat rent' },

    // 3. Maintenance Disambiguation (Debit card AMC vs AMC Theatres)
    { desc: 'Debit card annual maintenance charge AMC Rs 590', expCat: 'Financial Services', expReview: false, note: 'Card AMC charges' },
    { desc: 'Annual maintenance charge AMC fee', expCat: 'Financial Services', expReview: false, note: 'Banking AMC fee' },
    { desc: 'AMC Theatres movie tickets weekend show', expCat: 'Entertainment & Recreation', expReview: false, note: 'AMC Theatres cinema' },

    // 4. Brand Disambiguation (Amazon Shopping vs Prime Video)
    { desc: 'Amazon India shopping retail purchase', expCat: 'Shopping & Retail', expReview: false, note: 'Amazon Shopping' },
    { desc: 'Amazon Prime video subscription monthly', expCat: 'Entertainment & Recreation', expReview: false, note: 'Amazon Prime Video' },
    { desc: 'Prime Video subscription renewal', expCat: 'Entertainment & Recreation', expReview: false, note: 'Prime Video streaming' },

    // 5. Society Disambiguation (Housing Society vs Charity Society)
    { desc: 'Green Glen Apartment Society maintenance', expCat: 'Housing & Rent', expReview: false, note: 'Apartment society' },
    { desc: 'Cancer Aid Society donation 80G', expCat: 'Charity & Donations', expReview: false, note: 'Cancer Society charity' },

    // 6. Utilities, Broadband, FASTag, Fuel
    { desc: 'BESCOM electricity bill payment Bangalore', expCat: 'Utilities & Services', expReview: false, note: 'Electricity board' },
    { desc: 'Airtel prepaid mobile recharge plan', expCat: 'Utilities & Services', expReview: false, note: 'Mobile recharge' },
    { desc: 'ACT Fibernet broadband internet bill', expCat: 'Utilities & Services', expReview: false, note: 'Broadband bill' },
    { desc: 'FASTag ICICI toll debit NH44 toll plaza', expCat: 'Transportation', expReview: false, note: 'FASTag toll' },
    { desc: 'HP Petrol pump fuel Indian Oil retail', expCat: 'Transportation', expReview: false, note: 'Fuel & petrol' },

    // 7. Healthcare, Transit, Income, Government, Donations
    { desc: 'Apollo Pharmacy medicines prescription', expCat: 'Healthcare & Medical', expReview: false, note: 'Apollo Pharmacy' },
    { desc: 'Uber cab ride to airport Bengaluru', expCat: 'Transportation', expReview: false, note: 'Uber ride' },
    { desc: 'Salary credited Infosys Ltd Oct', expCat: 'Income', expReview: false, note: 'Salary credit' },
    { desc: 'Income tax payment challan 280 AY 24-25', expCat: 'Government & Legal', expReview: false, note: 'Income tax challan' },
    { desc: 'PM CARES relief fund donation', expCat: 'Charity & Donations', expReview: false, note: 'PM CARES donation' },
    { desc: 'BookMyShow movie ticket PVR', expCat: 'Entertainment & Recreation', expReview: false, note: 'BookMyShow cinema' },

    // 8. Ambiguous P2P UPI & Low-Confidence Transactions (MUST flag review!)
    { desc: 'UPI/432198765432/Sharmaji/payment', expReview: true, note: 'Ambiguous P2P UPI (Sharmaji)' },
    { desc: 'Personal transfer to friend payment', expReview: true, note: 'Ambiguous friend transfer' },
    { desc: 'Random gibberish xyzqwe12345', expReview: true, note: 'Out-of-vocabulary gibberish' },
  ];

  for (const tc of testCases) {
    const tStart = Date.now();
    const res = await fetch('http://127.0.0.1:8001/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: tc.desc }),
    });
    const dur = Date.now() - tStart;
    const data = await res.json();

    if (tc.expCat) {
      assert(
        data.category === tc.expCat,
        `[${tc.note}] "${tc.desc}" -> got "${data.category}" (expected "${tc.expCat}", conf: ${data.confidence}, method: ${data.method}, ${dur}ms)`
      );
    }
    if (tc.expReview !== undefined) {
      assert(
        data.needs_review === tc.expReview,
        `[${tc.note}] needs_review flag is ${data.needs_review} (expected ${tc.expReview})`
      );
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 4: INPUT VALIDATION & ERROR HANDLING
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 4: INPUT VALIDATION & ERROR HANDLING (PORT 8001)');

  // Empty string
  const emptyRes = await fetch('http://127.0.0.1:8001/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: '' }),
  });
  assert(emptyRes.status === 422, 'Empty string returns HTTP 422');

  // Whitespace only
  const wsRes = await fetch('http://127.0.0.1:8001/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: '    ' }),
  });
  assert(wsRes.status === 422, 'Whitespace only returns HTTP 422');

  // > 500 characters
  const longRes = await fetch('http://127.0.0.1:8001/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'X'.repeat(501) }),
  });
  assert(longRes.status === 422, 'Description > 500 characters returns HTTP 422');

  // Non-JSON body
  const nonJsonRes = await fetch('http://127.0.0.1:8001/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'Not a JSON',
  });
  assert(nonJsonRes.status === 422, 'Non-JSON body returns HTTP 422');

  // -------------------------------------------------------------
  // TEST GROUP 5: PROXY INTEGRATION & WEALTHIQ NORMALIZATION
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 5: PROXY & WEALTHIQ NORMALIZATION (PORT 8001 UPSTREAM)');

  // Start Next.js test instance pointed to port 8001
  const testPort = 3459;
  const nextProcess = spawn('npx', ['next', 'start', '-p', String(testPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(testPort),
      TRANSACTION_CLASSIFIER_URL: 'http://127.0.0.1:8001',
    },
    stdio: 'ignore',
  });

  let nextReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://127.0.0.1:${testPort}/api/classify-transaction`);
      nextReady = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!nextReady) {
    console.error('Failed to start Next.js test server with TRANSACTION_CLASSIFIER_URL=http://127.0.0.1:8001');
    nextProcess.kill();
    process.exit(1);
  }

  try {
    // 5A. Probe proxy health
    const proxyHealthRes = await fetch(`http://127.0.0.1:${testPort}/api/classify-transaction`);
    const proxyHealthData = await proxyHealthRes.json();
    assert(proxyHealthRes.status === 200, 'Proxy GET returns HTTP 200');
    assert(proxyHealthData.upstream_healthy === true, 'Proxy reports upstream v2 on port 8001 is healthy');
    assert(proxyHealthData.upstream_url === 'http://127.0.0.1:8001', 'Proxy reports upstream_url is http://127.0.0.1:8001');

    // 5B. Normalization through Next.js proxy
    const proxyCases = [
      {
        desc: 'Swiggy dinner order',
        expCat: 'Food',
        expType: 'essential',
        isIncome: false,
        expReview: false,
        note: 'Food & Dining -> Food',
      },
      {
        desc: 'Monthly house rent to landlord',
        expCat: 'Housing',
        expType: 'essential',
        isIncome: false,
        expReview: false,
        note: 'Housing & Rent -> Housing',
      },
      {
        desc: 'Society maintenance charges MyGate',
        expCat: 'Housing',
        expType: 'essential',
        isIncome: false,
        expReview: false,
        note: 'Society maintenance -> Housing',
      },
      {
        desc: 'Amazon Prime video subscription monthly',
        expCat: 'Entertainment',
        expType: 'discretionary',
        isIncome: false,
        expReview: false,
        note: 'Amazon Prime Video -> Entertainment (discretionary)',
      },
      {
        desc: 'FASTag ICICI toll debit NH44',
        expCat: 'Transportation',
        expType: 'essential',
        isIncome: false,
        expReview: false,
        note: 'FASTag -> Transportation (essential)',
      },
      {
        desc: 'Debit card annual maintenance charge AMC Rs 590',
        expCat: 'Other',
        expType: 'essential',
        isIncome: false,
        expReview: true,
        guidanceContains: 'Debts',
        note: 'AMC fee -> Other (essential, review, Debts guidance)',
      },
      {
        desc: 'Salary credited Infosys Ltd Oct',
        expCat: null,
        expType: null,
        isIncome: true,
        expReview: true,
        guidanceContains: 'Income module',
        note: 'Salary credit -> isIncome: true, category: null, Income redirection',
      },
      {
        desc: 'UPI/432198765432/Sharmaji/payment',
        expReview: true,
        note: 'Ambiguous P2P UPI -> needsReview: true in WealthIQ',
      },
    ];

    for (const pc of proxyCases) {
      const pRes = await fetch(`http://127.0.0.1:${testPort}/api/classify-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: pc.desc }),
      });
      const pData = await pRes.json();

      assert(pRes.status === 200, `[Proxy] "${pc.desc}" HTTP 200`);
      assert(pData.available === true, `[Proxy] "${pc.desc}" available: true`);
      if (pc.expCat !== undefined) {
        assert(pData.category === pc.expCat, `[Proxy] "${pc.desc}" normalized category: got "${pData.category}" (expected "${pc.expCat}")`);
      }
      if (pc.expType !== undefined) {
        assert(pData.suggestedExpenseType === pc.expType, `[Proxy] "${pc.desc}" suggestedExpenseType: got "${pData.suggestedExpenseType}" (expected "${pc.expType}")`);
      }
      if (pc.isIncome !== undefined) {
        assert(pData.isIncome === pc.isIncome, `[Proxy] "${pc.desc}" isIncome: got ${pData.isIncome} (expected ${pc.isIncome})`);
      }
      if (pc.expReview !== undefined) {
        assert(pData.needsReview === pc.expReview, `[Proxy] "${pc.desc}" needsReview: got ${pData.needsReview} (expected ${pc.expReview})`);
      }
      if (pc.guidanceContains) {
        assert(pData.userGuidance && pData.userGuidance.includes(pc.guidanceContains), `[Proxy] "${pc.desc}" userGuidance mentions "${pc.guidanceContains}"`);
      }
    }
  } finally {
    nextProcess.kill();
  }

  // -------------------------------------------------------------
  // TEST GROUP 6: GRACEFUL OFFLINE FALLBACK RESILIENCE
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 6: GRACEFUL FALLBACK RESILIENCE (OFFLINE UPSTREAM)');

  const offlinePort = 3460;
  const offlineNextProcess = spawn('npx', ['next', 'start', '-p', String(offlinePort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(offlinePort),
      TRANSACTION_CLASSIFIER_URL: 'http://127.0.0.1:9999', // Non-existent service
    },
    stdio: 'ignore',
  });

  let offlineNextReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://127.0.0.1:${offlinePort}/api/classify-transaction`);
      offlineNextReady = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!offlineNextReady) {
    console.error('Failed to start Next.js offline test server');
    offlineNextProcess.kill();
    process.exit(1);
  }

  try {
    const fallbackRes = await fetch(`http://127.0.0.1:${offlinePort}/api/classify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Swiggy food order' }),
    });
    const fallbackData = await fallbackRes.json();

    assert(fallbackRes.status === 200, 'Offline upstream returns HTTP 200 with structured fallback response');
    assert(fallbackData.available === false, 'Fallback reports available: false');
    assert(fallbackData.method === 'fallback', 'Fallback reports method: fallback');
    assert(fallbackData.category === null, 'Fallback returns category: null (manual entry preserved)');
    assert(fallbackData.reason === 'offline', 'Fallback reports reason: offline');
    assert(typeof fallbackData.userGuidance === 'string', 'Fallback provides clear userGuidance');
  } finally {
    offlineNextProcess.kill();
  }

  // -------------------------------------------------------------
  // TEST GROUP 7: PRESERVATION OF ORIGINAL V1 SERVICE ON PORT 8000
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 7: PRESERVATION OF V1 SERVICE ON PORT 8000');

  const v1FinalHealth = await fetch('http://127.0.0.1:8000/health');
  const v1FinalData = await v1FinalHealth.json();
  assert(v1FinalHealth.status === 200, 'Original v1 service on port 8000 is still running and healthy');
  assert(v1FinalData.status === 'healthy', 'v1 service health is still "healthy"');

  const v1PredictRes = await fetch('http://127.0.0.1:8000/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Swiggy dinner' }),
  });
  const v1PredictData = await v1PredictRes.json();
  assert(v1PredictRes.status === 200, 'v1 predict on port 8000 works normally');
  assert(typeof v1PredictData.category === 'string', 'v1 predicts category successfully');

  // -------------------------------------------------------------
  // TEST GROUP 8: UI WORKFLOW & SUPABASE INTEGRITY AUDIT
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 8: UI WORKFLOW & REPOSITORY INTEGRITY');

  const expensePage = fs.readFileSync('app/expenses/page.tsx', 'utf8');
  assert(expensePage.includes('Suggest Category'), 'Suggest Category action remains in app/expenses/page.tsx');
  assert(expensePage.includes('Go to Income Module'), 'Income suggestion redirect alert remains intact in page.tsx');
  assert(expensePage.includes("formData.category"), 'Category remains user-editable');
  assert(expensePage.includes("formData.expense_type"), 'Expense type remains user-editable');
  assert(expensePage.includes("supabase.from('expense_records')"), 'Supabase CRUD workflow is untouched');

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
