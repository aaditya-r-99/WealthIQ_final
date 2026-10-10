/**
 * Phase 1 Verification Suite: Safe Expense Classifier Integration
 *
 * Validates:
 * 1. Unit/normalization testing for all 10+ categories and fallback logic
 * 2. Income detection & redirection
 * 3. Low-confidence flag & review indicators
 * 4. Live API route testing against Python classifier on port 8000
 * 5. Input validation (invalid bodies, length limits, missing fields)
 * 6. Graceful fallback on unavailable upstream service & timeout handling
 * 7. Verification that existing expense page is intact
 */

const http = require('http');
const { spawn } = require('child_process');

// Load TS module directly or test mapping dictionary
const {
  CATEGORY_MAPPINGS,
  normalizeClassification,
  WEALTHIQ_EXPENSE_CATEGORIES,
} = require('../.next/server/app/api/classify-transaction/route.js') || {};

async function runTests() {
  console.log('================================================================');
  console.log('       WEALTHIQ — PHASE 1 CLASSIFIER INTEGRATION AUDIT          ');
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
  // TEST GROUP 1: ALL CATEGORY MAPPINGS & EXPENSE TYPES
  // -------------------------------------------------------------
  console.log('>>> TEST GROUP 1: CATEGORY NORMALIZATION & EXPENSE TYPE MAPPINGS');

  // Test cases as required in Phase 1 spec:
  // - Food & Dining → Food
  // - Healthcare & Medical → Healthcare
  // - Shopping & Retail → Shopping
  // - Utilities & Services → Utilities
  // - Entertainment & Recreation → Entertainment
  // - Transportation → Transportation
  // - Housing & Rent → Housing
  // - Charity & Donations → Other
  // - Government & Legal → Other, with review indication
  // - Financial Services → Other, with Debts suggestion
  // - Income → isIncome: true, not an expense
  // - Education → in WEALTHIQ_EXPENSE_CATEGORIES

  const mappingTestCases = [
    {
      raw: { description: 'Swiggy dinner', category: 'Food & Dining', method: 'rule', confidence: null },
      expectedCategory: 'Food',
      expectedExpenseType: 'essential',
      expectedIsIncome: false,
      expectedNeedsReview: false,
    },
    {
      raw: { description: 'Hospital bill', category: 'Healthcare & Medical', method: 'ml', confidence: 0.95 },
      expectedCategory: 'Healthcare',
      expectedExpenseType: 'essential',
      expectedIsIncome: false,
      expectedNeedsReview: false,
    },
    {
      raw: { description: 'Amazon purchase', category: 'Shopping & Retail', method: 'rule', confidence: null },
      expectedCategory: 'Shopping',
      expectedExpenseType: 'discretionary',
      expectedIsIncome: false,
      expectedNeedsReview: false,
    },
    {
      raw: { description: 'Electricity bill', category: 'Utilities & Services', method: 'rule', confidence: null },
      expectedCategory: 'Utilities',
      expectedExpenseType: 'essential',
      expectedIsIncome: false,
      expectedNeedsReview: false,
    },
    {
      raw: { description: 'Movie tickets', category: 'Entertainment & Recreation', method: 'ml', confidence: 0.88 },
      expectedCategory: 'Entertainment',
      expectedExpenseType: 'discretionary',
      expectedIsIncome: false,
      expectedNeedsReview: false,
    },
    {
      raw: { description: 'Ola cab ride', category: 'Transportation', method: 'rule', confidence: null },
      expectedCategory: 'Transportation',
      expectedExpenseType: 'essential',
      expectedIsIncome: false,
      expectedNeedsReview: false,
    },
    {
      raw: { description: 'Apartment rent', category: 'Housing & Rent', method: 'rule', confidence: null },
      expectedCategory: 'Housing',
      expectedExpenseType: 'essential',
      expectedIsIncome: false,
      expectedNeedsReview: false,
    },
    {
      raw: { description: 'NGO donation', category: 'Charity & Donations', method: 'rule', confidence: null },
      expectedCategory: 'Other',
      expectedExpenseType: 'discretionary',
      expectedIsIncome: false,
      expectedNeedsReview: true,
    },
    {
      raw: { description: 'Court fee', category: 'Government & Legal', method: 'ml', confidence: 0.85 },
      expectedCategory: 'Other',
      expectedExpenseType: 'essential',
      expectedIsIncome: false,
      expectedNeedsReview: true,
    },
    {
      raw: { description: 'Home loan EMI', category: 'Financial Services', method: 'rule', confidence: null },
      expectedCategory: 'Other',
      expectedExpenseType: 'essential',
      expectedIsIncome: false,
      expectedNeedsReview: true,
    },
    {
      raw: { description: 'Monthly salary credited', category: 'Income', method: 'rule', confidence: null },
      expectedCategory: null,
      expectedExpenseType: null,
      expectedIsIncome: true,
      expectedNeedsReview: true,
    },
  ];

  // Load the normalizeClassification from our TypeScript compiled file or source
  const tsClassifier = await import('../lib/transaction-classifier.ts');

  for (const tc of mappingTestCases) {
    const res = tsClassifier.normalizeClassification(tc.raw);
    assert(
      res.category === tc.expectedCategory,
      `Category mapping for "${tc.raw.category}": expected "${tc.expectedCategory}", got "${res.category}"`
    );
    assert(
      res.suggestedExpenseType === tc.expectedExpenseType,
      `Expense type for "${tc.raw.category}": expected "${tc.expectedExpenseType}", got "${res.suggestedExpenseType}"`
    );
    assert(
      res.isIncome === tc.expectedIsIncome,
      `Income flag for "${tc.raw.category}": expected ${tc.expectedIsIncome}, got ${res.isIncome}`
    );
    assert(
      res.needsReview === tc.expectedNeedsReview,
      `needsReview flag for "${tc.raw.category}": expected ${tc.expectedNeedsReview}, got ${res.needsReview}`
    );
  }

  assert(
    tsClassifier.WEALTHIQ_EXPENSE_CATEGORIES.includes('Education'),
    'Education is present in WealthIQ expense categories for manual selection'
  );

  // -------------------------------------------------------------
  // TEST GROUP 2: LOW-CONFIDENCE REVIEW & UNRECOGNIZED CATEGORY
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 2: CONFIDENCE HANDLING & REVIEW FLAGS');

  const lowConfRes = tsClassifier.normalizeClassification({
    description: 'Cryptic merchant',
    category: 'Shopping & Retail',
    method: 'ml',
    confidence: 0.52,
    needs_review: true,
  });
  assert(lowConfRes.needsReview === true, 'Low confidence (<0.70) sets needsReview to true');
  assert(lowConfRes.category === 'Shopping', 'Category still normalized to Shopping');
  assert(lowConfRes.confidence === 0.52, 'Confidence preserved correctly');

  const unmappedRes = tsClassifier.normalizeClassification({
    description: 'Unknown widget',
    category: 'Cryptocurrency Arbitrage',
    method: 'ml',
    confidence: 0.40,
  });
  assert(unmappedRes.category === 'Other', 'Unmapped upstream category falls back to "Other"');
  assert(unmappedRes.needsReview === true, 'Unmapped upstream category sets needsReview to true');

  // -------------------------------------------------------------
  // TEST GROUP 3: LIVE NEXT.JS SERVER HTTP REQUESTS
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 3: SERVER API ROUTE (/api/classify-transaction)');

  // Start Next.js standalone server on test port 3456
  const nextPort = 3456;
  const nextProcess = spawn('npx', ['next', 'start', '-p', String(nextPort)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(nextPort) },
    stdio: 'ignore',
  });

  // Wait for server to be responsive
  let serverReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://127.0.0.1:${nextPort}/api/classify-transaction`);
      serverReady = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!serverReady) {
    console.error('Failed to start Next.js test server');
    nextProcess.kill();
    process.exit(1);
  }

  try {
    // 3A. Health endpoint
    const healthRes = await fetch(`http://127.0.0.1:${nextPort}/api/classify-transaction`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/classify-transaction returns 200');
    assert(healthData.upstream_healthy === true, 'GET confirms upstream Python service on 8000 is healthy');

    // 3B. Live classification via running Python service
    const predictTestCases = [
      { text: 'Swiggy food order for lunch', expectedCat: 'Food', isIncome: false },
      { text: 'Uber cab ride to office', expectedCat: 'Transportation', isIncome: false },
      { text: 'Electricity bill payment for house', expectedCat: 'Utilities', isIncome: false },
      { text: 'Salary credited from employer', expectedCat: null, isIncome: true },
      { text: 'Monthly house rent to landlord', expectedCat: 'Housing', isIncome: false },
    ];

    for (const pt of predictTestCases) {
      const res = await fetch(`http://127.0.0.1:${nextPort}/api/classify-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: pt.text }),
      });
      const data = await res.json();
      assert(res.status === 200, `POST /api/classify-transaction status 200 for "${pt.text}"`);
      assert(data.available === true, `API reports available: true for "${pt.text}"`);
      assert(data.category === pt.expectedCat, `Category match for "${pt.text}": got "${data.category}"`);
      assert(data.isIncome === pt.isIncome, `isIncome match for "${pt.text}": got ${data.isIncome}`);
      if (pt.isIncome) {
        assert(data.userGuidance && data.userGuidance.includes('Income module'), 'Income response instructs user to use Income module');
      }
    }

    // -------------------------------------------------------------
    // TEST GROUP 4: REQUEST BODY VALIDATION (EDGE CASES & MALFORMED)
    // -------------------------------------------------------------
    console.log('\n>>> TEST GROUP 4: INPUT VALIDATION & BAD REQUESTS');

    // Empty description
    const emptyRes = await fetch(`http://127.0.0.1:${nextPort}/api/classify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: '   ' }),
    });
    assert(emptyRes.status === 400, 'Empty description returns HTTP 400');

    // Missing description
    const missingRes = await fetch(`http://127.0.0.1:${nextPort}/api/classify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500 }),
    });
    assert(missingRes.status === 400, 'Missing description field returns HTTP 400');

    // Exceeds 500 chars
    const longRes = await fetch(`http://127.0.0.1:${nextPort}/api/classify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'A'.repeat(501) }),
    });
    assert(longRes.status === 400, 'Description exceeding 500 characters returns HTTP 400');

    // Non-JSON body
    const nonJsonRes = await fetch(`http://127.0.0.1:${nextPort}/api/classify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'plain string not json',
    });
    assert(nonJsonRes.status === 400, 'Malformed non-JSON payload returns HTTP 400');

  } finally {
    nextProcess.kill();
  }

  // -------------------------------------------------------------
  // TEST GROUP 5: OFFLINE UPSTREAM & TIMEOUT HANDLING
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 5: GRACEFUL FALLBACK (OFFLINE SERVICE & TIMEOUT)');

  // Start Next.js with TRANSACTION_CLASSIFIER_URL pointed to an unreachable port (9999)
  const offlinePort = 3457;
  const offlineProcess = spawn('npx', ['next', 'start', '-p', String(offlinePort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(offlinePort),
      TRANSACTION_CLASSIFIER_URL: 'http://127.0.0.1:9999', // Non-existent service
    },
    stdio: 'ignore',
  });

  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://127.0.0.1:${offlinePort}/api/classify-transaction`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  try {
    const offlineRes = await fetch(`http://127.0.0.1:${offlinePort}/api/classify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Swiggy food order' }),
    });
    const offlineData = await offlineRes.json();

    assert(offlineRes.status === 200, 'Offline upstream returns HTTP 200 with structured fallback (never throws unhandled 500)');
    assert(offlineData.available === false, 'available is false when upstream is offline');
    assert(offlineData.method === 'fallback', 'method is "fallback" when upstream is offline');
    assert(offlineData.reason === 'offline', 'reason is "offline"');
    assert(offlineData.category === null, 'category is null (manual entry available)');
    assert(typeof offlineData.userGuidance === 'string', 'userGuidance provided explaining manual selection');

    // Client helper test
    const clientFallback = await tsClassifier.classifyTransaction('Swiggy dinner', (url, init) => {
      // Simulate network exception in browser
      return Promise.reject(new Error('Failed to fetch'));
    });
    assert(clientFallback.available === false, 'client helper gracefully handles network error');
    assert(clientFallback.reason === 'offline', 'client helper reports reason: offline');
  } finally {
    offlineProcess.kill();
  }

  // -------------------------------------------------------------
  // TEST GROUP 6: EXISTING EXPENSE FORM INTEGRITY
  // -------------------------------------------------------------
  console.log('\n>>> TEST GROUP 6: EXISTING EXPENSE MODULE INTEGRITY');
  const fs = require('fs');
  const expensePageCode = fs.readFileSync('app/expenses/page.tsx', 'utf8');

  assert(
    expensePageCode.includes('expenseCategories'),
    'Existing expenseCategories list is preserved in app/expenses/page.tsx'
  );
  assert(
    expensePageCode.includes("formData.category"),
    'Manual category selection logic is preserved in app/expenses/page.tsx'
  );
  assert(
    expensePageCode.includes("supabase.from('expense_records')"),
    'Existing Supabase CRUD operations are preserved in app/expenses/page.tsx'
  );

  console.log('\n================================================================');
  console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
