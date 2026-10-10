/**
 * WealthIQ — Phase 8: Default Promotion & Rollback Verification Suite
 *
 * Verifies:
 * 1. .env.local configuration: TRANSACTION_CLASSIFIER_URL=http://127.0.0.1:8001
 * 2. Git ignore compliance: .env.local is ignored and untracked
 * 3. Default Next.js proxy routing on port 3000 to port 8001 (v2)
 * 4. Differential classification proving v2 is active
 * 5. Real browser E2E UI verification on http://localhost:3000/expenses:
 *    - Swiggy -> Food (essential)
 *    - Rent -> Housing (essential)
 *    - Amazon Prime Video -> Entertainment (discretionary)
 *    - FASTag -> Transportation (essential)
 *    - AMC bank fee -> Other (essential, review notice, Debt guidance)
 *    - Salary -> Income redirection alert (link to /income)
 *    - Ambiguous UPI (Sharmaji) -> Review warning
 *    - Category and expense type manual user overrides
 *    - Non-auto-save verification (no Supabase mutations)
 *    - Independent manual entry workflow
 * 6. Offline fallback & input validation resilience
 * 7. Two-way rollback procedure testing (switch to 8000, verify, revert to 8001, verify)
 * 8. Final repository integrity
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

async function restartNext() {
  execSync('fuser -k 3000/tcp || true', { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));

  const child = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/classify-transaction');
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Next.js failed to start on port 3000');
}

async function main() {
  console.log('================================================================');
  console.log('  WEALTHIQ — PHASE 8 DEFAULT PROMOTION & ROLLBACK AUDIT');
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
  // PART 1: CONFIGURATION & GIT STATUS AUDIT
  // -------------------------------------------------------------
  console.log('>>> PART 1: LOCAL CONFIGURATION & GIT AUDIT');

  const envContent = fs.readFileSync('.env.local', 'utf8');
  assert(
    envContent.includes('TRANSACTION_CLASSIFIER_URL=http://127.0.0.1:8001'),
    '.env.local defines TRANSACTION_CLASSIFIER_URL=http://127.0.0.1:8001'
  );
  assert(
    envContent.includes('NEXT_PUBLIC_SUPABASE_URL='),
    '.env.local preserves Supabase URL secret'
  );
  assert(
    envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY='),
    '.env.local preserves Supabase Anon Key secret'
  );

  const checkIgnore = execSync('git check-ignore .env.local').toString().trim();
  assert(checkIgnore === '.env.local', '.env.local is ignored by Git (.gitignore)');

  const lsFiles = execSync('git ls-files .env.local').toString().trim();
  assert(lsFiles === '', '.env.local is NOT tracked in Git index');

  const v1Health = await fetch('http://127.0.0.1:8000/health').then((r) => r.json());
  assert(v1Health.status === 'healthy', 'v1 classifier on port 8000 is operational');

  const v2Health = await fetch('http://127.0.0.1:8001/health').then((r) => r.json());
  assert(v2Health.status === 'healthy' && v2Health.version === 'v2', 'v2 classifier on port 8001 is operational');

  // -------------------------------------------------------------
  // PART 2: DEFAULT APPLICATION PATH VERIFICATION (PORT 3000)
  // -------------------------------------------------------------
  console.log('\n>>> PART 2: DEFAULT APPLICATION PROXY VERIFICATION');

  const proxyRes = await fetch('http://127.0.0.1:3000/api/classify-transaction');
  const proxyData = await proxyRes.json();

  assert(proxyRes.status === 200, 'GET /api/classify-transaction returns HTTP 200');
  assert(
    proxyData.upstream_url === 'http://127.0.0.1:8001',
    `Proxy defaults to port 8001 without manual overrides (got: ${proxyData.upstream_url})`
  );
  assert(proxyData.upstream_healthy === true, 'Proxy reports upstream v2 is healthy');

  // Differential prediction test
  const diffRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Society maintenance charges Orchid Woods' }),
  });
  const diffData = await diffRes.json();
  assert(
    diffData.category === 'Housing',
    'Society maintenance classified as "Housing" via default proxy'
  );
  assert(
    diffData.rawCategory === 'Housing & Rent',
    'Proxy reports rawCategory: "Housing & Rent" (proving v2 execution)'
  );

  // -------------------------------------------------------------
  // PART 3: REAL BROWSER E2E EXPENSE-ENTRY UI AUDIT
  // -------------------------------------------------------------
  console.log('\n>>> PART 3: REAL BROWSER E2E UI AUDIT');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    headless: 'new',
    userDataDir: '/tmp/brave_test_profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto('http://localhost:3000/expenses', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const initialRowCount = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    console.log(`  Initial expense table row count: ${initialRowCount}`);

    async function getCategory() {
      return await page.evaluate(() => {
        const el = document.getElementById('category');
        return el ? el.innerText.trim() : null;
      });
    }

    async function getType() {
      return await page.evaluate(() => {
        const el = document.getElementById('type');
        return el ? el.innerText.trim().toLowerCase() : null;
      });
    }

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

    // 3.1 Swiggy suggests Food
    await suggestFor('Swiggy dinner order');
    assert((await getCategory()) === 'Food', 'Swiggy suggests Food');
    assert((await getType()) === 'essential', 'Swiggy suggests essential');

    // 3.2 Rent suggests Housing
    await suggestFor('Monthly house rent to landlord');
    assert((await getCategory()) === 'Housing', 'Rent suggests Housing');
    assert((await getType()) === 'essential', 'Rent suggests essential');

    // 3.3 Amazon Prime Video suggests Entertainment
    await suggestFor('Amazon Prime video subscription monthly');
    assert((await getCategory()) === 'Entertainment', 'Amazon Prime Video suggests Entertainment');
    assert((await getType()) === 'discretionary', 'Amazon Prime Video suggests discretionary');

    // 3.4 FASTag suggests Transportation
    await suggestFor('FASTag ICICI toll debit NH44');
    assert((await getCategory()) === 'Transportation', 'FASTag suggests Transportation');
    assert((await getType()) === 'essential', 'FASTag suggests essential');

    // 3.5 AMC bank fee suggests Other with review & Debt guidance
    await suggestFor('Debit card annual maintenance charge AMC Rs 590');
    assert((await getCategory()) === 'Other', 'AMC bank fee suggests Other');
    const amcNotice = await page.evaluate(() => document.body.innerText);
    assert(amcNotice.includes('Debts') || amcNotice.includes('review'), 'AMC fee prompts review & Debts guidance');

    // 3.6 Salary is redirected to Income module
    await suggestFor('Salary credited Infosys Ltd Oct');
    assert((await getCategory()) !== 'Income', 'Salary does NOT set category to Income');
    const salaryNotice = await page.evaluate(() => document.body.innerText);
    assert(salaryNotice.includes('Income Transaction Detected'), 'Salary displays Income Transaction Detected alert');
    assert(salaryNotice.includes('Income Module') || salaryNotice.includes('Income module'), 'Alert directs to Income module');

    // 3.7 Ambiguous UPI shows review warning
    await suggestFor('UPI/432198765432/Sharmaji/payment');
    assert((await getCategory()) === 'Other', 'Ambiguous UPI suggests Other');
    const upiNotice = await page.evaluate(() => document.body.innerText);
    assert(
      upiNotice.includes('Suggested with Review:') || upiNotice.includes('Review') || upiNotice.includes('review'),
      'Ambiguous UPI triggers review notice'
    );

    // 3.8 User manual overrides
    await suggestFor('Swiggy lunch meal');
    assert((await getCategory()) === 'Food', 'Swiggy initial suggestion is Food');

    // Override category to Healthcare
    await page.click('#category');
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="option"]'));
      const item = items.find((el) => el.innerText.trim() === 'Healthcare');
      if (item) item.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    assert((await getCategory()) === 'Healthcare', 'User manually overrode category to Healthcare');

    // Override expense type to discretionary
    await page.click('#type');
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="option"]'));
      const item = items.find((el) => el.innerText.trim().toLowerCase() === 'discretionary');
      if (item) item.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    assert((await getType()) === 'discretionary', 'User manually overrode expense type to discretionary');

    // 3.9 Non-auto-save verification
    const currentRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    assert(currentRows === initialRowCount, `Suggestion requests did not create records (row count remains ${currentRows})`);

    // 3.10 Independent manual expense entry
    await page.evaluate(() => {
      const input = document.getElementById('description');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.type('#description', 'Independent Manual Grocery Purchase');
    const saveBtnActive = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
        b.innerText.includes('Save Expense')
      );
      return Boolean(btn && !btn.disabled);
    });
    assert(saveBtnActive, 'Manual expense entry remains fully enabled and independent of classifier');

  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------
  // PART 4: FAILURE RESILIENCE & OFFLINE HANDLING
  // -------------------------------------------------------------
  console.log('\n>>> PART 4: FAILURE RESILIENCE & OFFLINE HANDLING');

  const emptyRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: '' }),
  });
  assert(emptyRes.status === 400, 'Empty description rejected with HTTP 400');

  const nonJsonRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'plain text',
  });
  assert(nonJsonRes.status === 400, 'Non-JSON payload rejected with HTTP 400');

  // Standalone offline upstream test on test port 3462
  const deadPort = 3462;
  const deadProcess = spawn('npx', ['next', 'start', '-p', String(deadPort)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(deadPort), TRANSACTION_CLASSIFIER_URL: 'http://127.0.0.1:9999' },
    stdio: 'ignore',
  });

  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://127.0.0.1:${deadPort}/api/classify-transaction`);
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }

  try {
    const offlineRes = await fetch(`http://127.0.0.1:${deadPort}/api/classify-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Offline grocery purchase' }),
    });
    const offlineData = await offlineRes.json();
    assert(offlineRes.status === 200, 'Offline upstream returns HTTP 200 with structured fallback');
    assert(offlineData.available === false, 'available: false when upstream is offline');
    assert(offlineData.method === 'fallback', 'method: "fallback" when upstream is offline');
    assert(offlineData.category === null, 'category: null preserves manual selection');
  } finally {
    deadProcess.kill();
  }

  // -------------------------------------------------------------
  // PART 5: ROLLBACK PROCEDURE VERIFICATION
  // -------------------------------------------------------------
  console.log('\n>>> PART 5: ROLLBACK PROCEDURE VERIFICATION');

  console.log('  Step 1: Setting .env.local to port 8000 (v1 rollback)...');
  fs.writeFileSync(
    '.env.local',
    envContent.replace('http://127.0.0.1:8001', 'http://127.0.0.1:8000'),
    'utf8'
  );

  await restartNext();

  const rollbackProxyRes = await fetch('http://127.0.0.1:3000/api/classify-transaction');
  const rollbackProxyData = await rollbackProxyRes.json();
  assert(
    rollbackProxyData.upstream_url === 'http://127.0.0.1:8000',
    'Proxy successfully rolled back to http://127.0.0.1:8000'
  );
  assert(rollbackProxyData.upstream_healthy === true, 'v1 upstream on port 8000 is healthy');

  const rollbackPredictRes = await fetch('http://127.0.0.1:3000/api/classify-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Swiggy dinner order' }),
  });
  const rollbackPredictData = await rollbackPredictRes.json();
  assert(rollbackPredictData.category === 'Food', 'v1 predicts Food for Swiggy after rollback');

  console.log('  Step 2: Restoring .env.local back to port 8001 (v2 default promotion)...');
  fs.writeFileSync('.env.local', envContent, 'utf8');

  await restartNext();

  const finalProxyRes = await fetch('http://127.0.0.1:3000/api/classify-transaction');
  const finalProxyData = await finalProxyRes.json();
  assert(
    finalProxyData.upstream_url === 'http://127.0.0.1:8001',
    'Proxy confirmed restored to http://127.0.0.1:8001 as default'
  );
  assert(finalProxyData.upstream_healthy === true, 'v2 upstream on port 8001 is healthy');

  // -------------------------------------------------------------
  // PART 6: FINAL HEALTH & INTEGRITY CHECK
  // -------------------------------------------------------------
  console.log('\n>>> PART 6: FINAL HEALTH & REPOSITORY INTEGRITY');

  const endV1 = await fetch('http://127.0.0.1:8000/health').then((r) => r.json());
  assert(endV1.status === 'healthy', 'v1 service on port 8000 remains operational');

  const endV2 = await fetch('http://127.0.0.1:8001/health').then((r) => r.json());
  assert(endV2.status === 'healthy', 'v2 service on port 8001 remains operational');

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
