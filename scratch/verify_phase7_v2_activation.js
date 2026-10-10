/**
 * WealthIQ — Phase 7: Controlled Local Activation Verification Suite
 *
 * Verifies:
 * 1. Process environment audit & live v2 proxy routing on port 3000
 * 2. Real browser E2E UI verification on http://localhost:3000/expenses
 *    - Swiggy, Zomato, Blinkit, Zepto -> Food
 *    - Rent, PG accommodation, Society maintenance -> Housing
 *    - Electricity, Broadband, Mobile recharge -> Utilities
 *    - Amazon Shopping vs Amazon Prime Video disambiguation
 *    - AMC bank charges vs AMC Theatres disambiguation
 *    - FASTag -> Transportation
 *    - Salary credit -> Income module redirection
 *    - Ambiguous P2P UPI (Sharmaji) -> Review warning
 *    - Manual category & expense type override capability
 *    - Non-auto-save verification (no Supabase mutations)
 *    - Independent manual entry workflow
 * 3. Failure resilience & offline handling
 * 4. Safe rollback to v1 baseline on port 8000
 * 5. Final health check of all services
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

async function main() {
  console.log('================================================================');
  console.log('  WEALTHIQ — PHASE 7 CONTROLLED LOCAL ACTIVATION AUDIT');
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
  // PART 1: SERVICE HEALTH & PROXY OVERRIDE AUDIT
  // -------------------------------------------------------------
  console.log('>>> PART 1: SERVICE HEALTH & PROXY OVERRIDE AUDIT');

  // 1. Verify v1 service on port 8000
  const v1HealthRes = await fetch('http://127.0.0.1:8000/health');
  const v1Health = await v1HealthRes.json();
  assert(v1HealthRes.status === 200, 'Classifier v1 on port 8000 is healthy');
  assert(v1Health.status === 'healthy', 'v1 reports status: healthy');

  // 2. Verify v2 service on port 8001
  const v2HealthRes = await fetch('http://127.0.0.1:8001/health');
  const v2Health = await v2HealthRes.json();
  assert(v2HealthRes.status === 200, 'Classifier v2 on port 8001 is healthy');
  assert(v2Health.version === 'v2', 'v2 reports version: v2');
  assert(v2Health.model === 'indian_transaction_classifier_v2', 'v2 reports model: indian_transaction_classifier_v2');

  // 3. Verify Next.js proxy on port 3000 is pointed to v2
  const proxyStatusRes = await fetch('http://127.0.0.1:3000/api/classify-transaction');
  const proxyStatus = await proxyStatusRes.json();
  assert(proxyStatusRes.status === 200, 'Next.js proxy on port 3000 GET returns HTTP 200');
  assert(proxyStatus.upstream_url === 'http://127.0.0.1:8001', 'Next.js proxy upstream_url is http://127.0.0.1:8001 (v2 active)');
  assert(proxyStatus.upstream_healthy === true, 'Next.js proxy upstream is healthy');

  // 4. Verify differential behavior (proves app is executing v2, not v1 or cache)
  const diffRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Society maintenance charges Orchid Woods' }),
  });
  const diffData = await diffRes.json();
  assert(diffData.category === 'Housing', 'Proxy normalized "Society maintenance charges Orchid Woods" to "Housing" (v2 native class)');
  assert(diffData.rawCategory === 'Housing & Rent', 'Proxy reports rawCategory: "Housing & Rent" (exclusive to v2)');

  // -------------------------------------------------------------
  // PART 2: REAL BROWSER E2E UI AUDIT (PORT 3000)
  // -------------------------------------------------------------
  console.log('\n>>> PART 2: REAL BROWSER E2E EXPENSE-ENTRY AUDIT');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    headless: 'new',
    userDataDir: '/tmp/brave_test_profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    console.log('  Navigating to http://localhost:3000/expenses...');
    await page.goto('http://localhost:3000/expenses', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const pageH1 = await page.$eval('h1', (el) => el.innerText).catch(() => '');
    assert(pageH1.includes('Expenses'), 'Expenses page loaded successfully with H1 title');

    // Record initial table row count to guarantee no auto-saving occurs
    const initialRowCount = await page.evaluate(() => {
      return document.querySelectorAll('tbody tr').length;
    });
    console.log(`  Initial expense table row count: ${initialRowCount}`);

    // UI Helper: Get selected category
    async function getCategory() {
      return await page.evaluate(() => {
        const trigger = document.getElementById('category');
        return trigger ? trigger.innerText.trim() : null;
      });
    }

    // UI Helper: Get selected expense type
    async function getType() {
      return await page.evaluate(() => {
        const trigger = document.getElementById('type');
        return trigger ? trigger.innerText.trim().toLowerCase() : null;
      });
    }

    // UI Helper: Trigger suggest category
    async function suggestFor(text) {
      await page.evaluate(() => {
        const input = document.getElementById('description');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.type('#description', text);
      await new Promise((r) => setTimeout(r, 150));

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find((b) => b.innerText.includes('Suggest Category'));
        if (btn) btn.click();
      });

      await new Promise((r) => setTimeout(r, 1200));
    }

    // 2.1 Food delivery & quick commerce
    console.log('\n  [Suite 2.1: Food & Quick Commerce]');
    const foodTests = [
      { desc: 'Swiggy dinner order 48291', name: 'Swiggy' },
      { desc: 'Zomato restaurant food order', name: 'Zomato' },
      { desc: 'UPI/432198765432/Blinkit/blinkit@icici', name: 'Blinkit' },
      { desc: 'Zepto 10 min grocery delivery', name: 'Zepto' },
    ];
    for (const ft of foodTests) {
      await suggestFor(ft.desc);
      const cat = await getCategory();
      const type = await getType();
      assert(cat === 'Food', `[${ft.name}] "${ft.desc}" suggested category: Food (got: ${cat})`);
      assert(type === 'essential', `[${ft.name}] suggested expense type: essential (got: ${type})`);
    }

    // 2.2 Housing, Rent & Society Maintenance
    console.log('\n  [Suite 2.2: Housing, Rent & Society Maintenance]');
    const housingTests = [
      { desc: 'Monthly house rent to landlord', name: 'House Rent' },
      { desc: 'Paying guest monthly rent PG accommodation', name: 'PG Accommodation' },
      { desc: 'Society maintenance charges Orchid Woods', name: 'Society Maintenance' },
    ];
    for (const ht of housingTests) {
      await suggestFor(ht.desc);
      const cat = await getCategory();
      const type = await getType();
      assert(cat === 'Housing', `[${ht.name}] "${ht.desc}" suggested category: Housing (got: ${cat})`);
      assert(type === 'essential', `[${ht.name}] suggested expense type: essential (got: ${type})`);
    }

    // 2.3 Utilities, Broadband & Mobile
    console.log('\n  [Suite 2.3: Utilities, Broadband & Mobile Bills]');
    const utilTests = [
      { desc: 'BESCOM electricity bill payment Bangalore', name: 'Electricity Bill' },
      { desc: 'ACT Fibernet broadband bill', name: 'Broadband Bill' },
      { desc: 'Airtel prepaid mobile recharge plan', name: 'Mobile Recharge' },
    ];
    for (const ut of utilTests) {
      await suggestFor(ut.desc);
      const cat = await getCategory();
      const type = await getType();
      assert(cat === 'Utilities', `[${ut.name}] "${ut.desc}" suggested category: Utilities (got: ${cat})`);
      assert(type === 'essential', `[${ut.name}] suggested expense type: essential (got: ${type})`);
    }

    // 2.4 Brand Disambiguation: Amazon Shopping vs Amazon Prime Video
    console.log('\n  [Suite 2.4: Brand Disambiguation]');
    await suggestFor('Amazon India shopping retail purchase');
    const amzShopCat = await getCategory();
    const amzShopType = await getType();
    assert(amzShopCat === 'Shopping', `Amazon Shopping suggests Shopping (got: ${amzShopCat})`);
    assert(amzShopType === 'discretionary', `Amazon Shopping suggests discretionary (got: ${amzShopType})`);

    await suggestFor('Amazon Prime video subscription monthly');
    const amzPrimeCat = await getCategory();
    const amzPrimeType = await getType();
    assert(amzPrimeCat === 'Entertainment', `Amazon Prime Video suggests Entertainment (got: ${amzPrimeCat})`);
    assert(amzPrimeType === 'discretionary', `Amazon Prime Video suggests discretionary (got: ${amzPrimeType})`);

    // 2.5 AMC Disambiguation: Banking Charges vs Theatres
    console.log('\n  [Suite 2.5: AMC Disambiguation]');
    await suggestFor('Debit card annual maintenance charge AMC Rs 590');
    const amcBankCat = await getCategory();
    const amcBankNotice = await page.evaluate(() => document.body.innerText);
    assert(amcBankCat === 'Other', `Debit card AMC mapped to Other (got: ${amcBankCat})`);
    assert(amcBankNotice.includes('Debts') || amcBankNotice.includes('review'), 'AMC card fee prompts review & Debts module guidance');

    await suggestFor('AMC Theatres movie tickets weekend show');
    const amcMovieCat = await getCategory();
    assert(amcMovieCat === 'Entertainment', `AMC Theatres suggests Entertainment (got: ${amcMovieCat})`);

    // 2.6 Transportation: FASTag
    console.log('\n  [Suite 2.6: Transportation & FASTag]');
    await suggestFor('FASTag ICICI toll debit NH44');
    const fastagCat = await getCategory();
    const fastagType = await getType();
    assert(fastagCat === 'Transportation', `FASTag suggests Transportation (got: ${fastagCat})`);
    assert(fastagType === 'essential', `FASTag suggests essential (got: ${fastagType})`);

    // 2.7 Income Redirection: Salary
    console.log('\n  [Suite 2.7: Income Redirection]');
    await suggestFor('Salary credited Infosys Ltd Oct');
    const incomeCat = await getCategory();
    const incomeNotice = await page.evaluate(() => document.body.innerText);
    assert(incomeCat !== 'Income', 'Salary credit does NOT set Income as expense category');
    assert(incomeNotice.includes('Income Transaction Detected'), 'UI presents "Income Transaction Detected" banner');
    assert(incomeNotice.includes('Income Module') || incomeNotice.includes('Income module'), 'Banner instructs user to record under Income module');
    const hasIncomeLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some((a) => a.href.includes('/income') && a.innerText.includes('Income'));
    });
    assert(hasIncomeLink, 'Banner provides direct link to /income');

    // 2.8 Ambiguous P2P UPI Review Warning
    console.log('\n  [Suite 2.8: Ambiguous P2P UPI Review Flag]');
    await suggestFor('UPI/432198765432/Sharmaji/payment');
    const p2pCat = await getCategory();
    const p2pNotice = await page.evaluate(() => document.body.innerText);
    assert(p2pCat === 'Other', `Ambiguous P2P UPI mapped to Other (got: ${p2pCat})`);
    assert(
      p2pNotice.includes('Suggested with Review:') || p2pNotice.includes('Review') || p2pNotice.includes('review'),
      'UI displays review banner for ambiguous P2P UPI transaction'
    );

    // 2.9 User Control & Manual Overrides
    console.log('\n  [Suite 2.9: User Control & Overrides]');
    await suggestFor('Swiggy dinner order');
    assert((await getCategory()) === 'Food', 'Initial suggestion is Food');

    // Override Category dropdown to "Healthcare"
    await page.click('#category');
    await new Promise((r) => setTimeout(r, 400));
    const catOverridden = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="option"]'));
      const item = items.find((el) => el.innerText.trim() === 'Healthcare');
      if (item) {
        item.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 300));
    assert(catOverridden && (await getCategory()) === 'Healthcare', 'User successfully overrode category to "Healthcare"');

    // Override Expense Type dropdown to "discretionary"
    await page.click('#type');
    await new Promise((r) => setTimeout(r, 400));
    const typeOverridden = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="option"]'));
      const item = items.find((el) => el.innerText.trim().toLowerCase() === 'discretionary');
      if (item) {
        item.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 300));
    assert(typeOverridden && (await getType()) === 'discretionary', 'User successfully overrode expense type to "discretionary"');

    // 2.10 Non-Auto-Save Verification
    console.log('\n  [Suite 2.10: Financial Data Integrity]');
    const currentRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    assert(currentRows === initialRowCount, `No records auto-saved by classification (row count remained ${currentRows})`);

    // 2.11 Independent Manual Expense Entry
    console.log('\n  [Suite 2.11: Manual Entry Independence]');
    await page.evaluate(() => {
      const input = document.getElementById('description');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.type('#description', 'Manual Grocery Store Visit');

    // Check that Save Expense button exists and is clickable without using Suggestion
    const saveButtonActive = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
        b.innerText.includes('Save Expense')
      );
      return Boolean(btn && !btn.disabled);
    });
    assert(saveButtonActive, 'Manual expense entry remains fully enabled and independent of classifier');

  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------
  // PART 3: FAILURE RESILIENCE & OFFLINE HANDLING
  // -------------------------------------------------------------
  console.log('\n>>> PART 3: FAILURE RESILIENCE & OFFLINE HANDLING');

  // Test malformed requests to proxy
  const badBodyRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: '' }),
  });
  assert(badBodyRes.status === 400, 'Empty description returns HTTP 400');

  const nonJsonRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'plain string',
  });
  assert(nonJsonRes.status === 400, 'Non-JSON body returns HTTP 400');

  const longDescRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Z'.repeat(501) }),
  });
  assert(longDescRes.status === 400, 'Description > 500 chars returns HTTP 400');

  // Test offline fallback through a separate test instance pointed to dead port 9999
  const deadPort = 3461;
  const deadProcess = spawn('npx', ['next', 'start', '-p', String(deadPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(deadPort),
      TRANSACTION_CLASSIFIER_URL: 'http://127.0.0.1:9999',
    },
    stdio: 'ignore',
  });

  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://127.0.0.1:${deadPort}/api/classify-transaction`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  try {
    const offlineRes = await fetch(`http://127.0.0.1:${deadPort}/api/classify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Swiggy lunch order' }),
    });
    const offlineData = await offlineRes.json();
    assert(offlineRes.status === 200, 'Offline upstream returns HTTP 200 with structured fallback response');
    assert(offlineData.available === false, 'Offline response reports available: false');
    assert(offlineData.method === 'fallback', 'Offline response reports method: "fallback"');
    assert(offlineData.reason === 'offline', 'Offline response reports reason: "offline"');
    assert(offlineData.category === null, 'Offline response preserves category: null for manual selection');
  } finally {
    deadProcess.kill();
  }

  // -------------------------------------------------------------
  // PART 4: ROLLBACK RESTORATION AUDIT
  // -------------------------------------------------------------
  console.log('\n>>> PART 4: SAFE ROLLBACK RESTORATION AUDIT');

  // Verify that both background classifier services remain healthy
  const v1Check = await fetch('http://127.0.0.1:8000/health').then((r) => r.json());
  assert(v1Check.status === 'healthy', 'v1 service on port 8000 is still healthy before rollback');

  const v2Check = await fetch('http://127.0.0.1:8001/health').then((r) => r.json());
  assert(v2Check.status === 'healthy', 'v2 service on port 8001 is still healthy before rollback');

  console.log('  Restoring Next.js process configuration (reverting override to default port 8000)...');

  // Kill running Next.js process (task-413 on port 3000)
  execSync('fuser -k 3000/tcp || true', { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));

  // Restart Next.js WITHOUT the TRANSACTION_CLASSIFIER_URL override (reading default .env.local port 8000)
  const defaultNext = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  });
  defaultNext.unref();

  let defaultReady = false;
  for (let i = 0; i < 25; i++) {
    try {
      const r = await fetch('http://127.0.0.1:3000/api/classify-transaction');
      if (r.ok) {
        defaultReady = true;
        break;
      }
    } catch {
      await new Promise((res) => setTimeout(res, 500));
    }
  }
  assert(defaultReady, 'Next.js restarted cleanly on port 3000 with default configuration');

  // Verify that proxy now routes back to port 8000
  const rollbackStatusRes = await fetch('http://127.0.0.1:3000/api/classify-transaction');
  const rollbackStatus = await rollbackStatusRes.json();
  assert(rollbackStatus.upstream_url === 'http://127.0.0.1:8000', 'Next.js proxy upstream_url restored to http://127.0.0.1:8000');
  assert(rollbackStatus.upstream_healthy === true, 'Restored v1 upstream on port 8000 is healthy');

  // Verify v1 classification works through restored proxy
  const rollbackPredictRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Swiggy dinner order' }),
  });
  const rollbackPredictData = await rollbackPredictRes.json();
  assert(rollbackPredictRes.status === 200, 'Restored proxy POST returns HTTP 200');
  assert(rollbackPredictData.category === 'Food', 'v1 predicts Food for Swiggy');

  // -------------------------------------------------------------
  // PART 5: REPOSITORY & DATABASE INTEGRITY
  // -------------------------------------------------------------
  console.log('\n>>> PART 5: FINAL REPOSITORY & ENVIRONMENT INTEGRITY');

  const envLocal = fs.readFileSync('.env.local', 'utf8');
  assert(
    envLocal.includes('TRANSACTION_CLASSIFIER_URL=http://127.0.0.1:8000'),
    '.env.local file remained untouched and points to port 8000'
  );

  const finalV1 = await fetch('http://127.0.0.1:8000/health').then((r) => r.json());
  assert(finalV1.status === 'healthy', 'v1 service on port 8000 remains operational');

  const finalV2 = await fetch('http://127.0.0.1:8001/health').then((r) => r.json());
  assert(finalV2.status === 'healthy', 'v2 service on port 8001 remains operational');

  console.log('\n================================================================');
  console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
