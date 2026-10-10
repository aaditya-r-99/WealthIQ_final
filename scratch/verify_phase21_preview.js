const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PREVIEW_URL = 'https://wealthiq-5bcc49hby-adityaprajapati-5528s-projects.vercel.app';
const BENCHMARK_MICROSERVICE_URL = 'https://wealthiq-benchmark.vercel.app';
const CLASSIFIER_MICROSERVICE_URL = 'https://wealthiq-classifier-o7nt9hbk3-adityaprajapati-5528s-projects.vercel.app';

async function main() {
  console.log('================================================================');
  console.log('WealthIQ Phase 21 — Deployed Preview & Microservice Verification');
  console.log('Preview Target: ' + PREVIEW_URL);
  console.log('Benchmark Service: ' + BENCHMARK_MICROSERVICE_URL);
  console.log('Classifier Service: ' + CLASSIFIER_MICROSERVICE_URL);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function testPass(msg) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  }

  function testFail(msg, err) {
    console.error(`  [FAIL] ${msg}:`, err?.message || err);
    failed++;
  }

  // --- 1. Direct Microservice Health & Prediction Checks ---
  console.log('--- 1. Direct Microservice Endpoints ---');
  try {
    const res = await fetch(`${BENCHMARK_MICROSERVICE_URL}/health`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.states_count, 36);
    testPass('Direct Benchmark Microservice /health returns 200 healthy (36 states)');
  } catch (err) {
    testFail('Direct Benchmark Microservice /health check failed', err);
  }

  try {
    const res = await fetch(`${BENCHMARK_MICROSERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: '27',
        sector: 'urban',
        highest_education: 'graduate_above',
        livelihood: 'regular_wage',
        dwelling_type: 'pucca',
        cooking_fuel: 'lpg',
        land_owned: 'not_owned',
        hh_size: 4,
        num_adults: 2,
        num_children: 2,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.state_name, 'Maharashtra');
    assert.ok(data.estimated_mpce > 10000);
    testPass(`Direct Benchmark Microservice /predict returns MPCE: ₹${data.estimated_mpce.toLocaleString('en-IN')}`);
  } catch (err) {
    testFail('Direct Benchmark Microservice /predict failed', err);
  }

  try {
    const res = await fetch(`${CLASSIFIER_MICROSERVICE_URL}/health`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'healthy');
    testPass('Direct Classifier Microservice /health returns 200 healthy');
  } catch (err) {
    testFail('Direct Classifier Microservice /health failed', err);
  }

  // --- 2. Deployed Web Preview Next.js API Routes ---
  console.log('\n--- 2. Deployed Web Preview Next.js API Routes ---');
  try {
    const res = await fetch(`${PREVIEW_URL}/api/household-benchmark`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.upstream_healthy, true);
    assert.strictEqual(data.model_algorithm, 'HistGradientBoostingRegressor');
    testPass('Web Preview /api/household-benchmark GET reports upstream_healthy: true');
  } catch (err) {
    testFail('Web Preview /api/household-benchmark GET failed', err);
  }

  try {
    const res = await fetch(`${PREVIEW_URL}/api/classify-transaction`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.upstream_healthy, true);
    testPass('Web Preview /api/classify-transaction GET reports upstream_healthy: true');
  } catch (err) {
    testFail('Web Preview /api/classify-transaction GET failed', err);
  }

  try {
    const res = await fetch(`${PREVIEW_URL}/api/household-benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: '27',
        sector: 'urban',
        highest_education: 'graduate_above',
        livelihood: 'regular_wage',
        dwelling_type: 'pucca',
        cooking_fuel: 'lpg',
        land_owned: 'not_owned',
        hh_size: 4,
        num_adults: 2,
        num_children: 2,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.state_name, 'Maharashtra');
    assert.ok(data.estimated_mpce > 0);
    assert.ok(data.reference_benchmarks.sample_size === 11117);
    assert.ok(data.uncertainty.segment_mae > 0);
    testPass(`Web Preview /api/household-benchmark POST inference successful (MPCE: ₹${data.estimated_mpce.toFixed(2)}, HH Total: ₹${data.estimated_household_total.toFixed(2)})`);
  } catch (err) {
    testFail('Web Preview /api/household-benchmark POST failed', err);
  }

  try {
    const res = await fetch(`${PREVIEW_URL}/api/household-benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: '99' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 422);
    assert.ok(data.error.includes('Invalid or missing state code'));
    testPass('Web Preview /api/household-benchmark validation error handling (HTTP 422 on invalid state)');
  } catch (err) {
    testFail('Web Preview /api/household-benchmark validation failed', err);
  }

  // --- 3. Browser E2E Puppeteer Verification ---
  console.log('\n--- 3. Browser End-to-End Verification on Deployed Preview ---');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/brave-browser',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
      defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`  [BROWSER CONSOLE ERROR]: ${msg.text()}`);
      }
    });

    // Load auth token into localStorage
    const sessionFile = '/tmp/active_session_fresh.json';
    if (fs.existsSync(sessionFile)) {
      const sessionData = fs.readFileSync(sessionFile, 'utf8');
      console.log('  Navigating to /login to seed auth token...');
      await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate((tok) => {
        localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
      }, sessionData);
      testPass('Authenticated session token injected into preview localStorage');
    } else {
      console.warn('  Warning: No active session file found at /tmp/active_session_fresh.json');
    }

    // Navigate to Household Benchmark page
    console.log('  Navigating to /household-benchmark on preview...');
    await page.goto(`${PREVIEW_URL}/household-benchmark`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the page title
    await page.waitForSelector('h1', { timeout: 10000 });
    const titleText = await page.$eval('h1', (el) => el.innerText);
    assert.ok(titleText.includes('Household Spending Benchmark'), `Expected title to contain Household Spending Benchmark, got "${titleText}"`);
    testPass(`Household Benchmark page loaded with title: "${titleText}"`);

    // Click "Calculate Benchmark" button
    console.log('  Clicking "Calculate Benchmark" button in UI...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Calculate Benchmark'));
      if (btn) btn.click();
    });

    // Wait for result to appear
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Per Capita Expenditure (MPCE)') ||
             document.body.innerText.includes('Estimated Household Total') ||
             document.body.innerText.includes('State Median MPCE');
    }, { timeout: 15000 });

    const pageContent = await page.evaluate(() => document.body.innerText);
    assert.ok(pageContent.includes('Per Capita Expenditure (MPCE)'), 'Results section missing MPCE');
    assert.ok(pageContent.includes('Estimated Household Total'), 'Results section missing Household Total');
    assert.ok(pageContent.includes('State Median MPCE'), 'Results section missing State Median MPCE');
    testPass('Household Benchmark ML prediction rendered in preview UI (MPCE, Household Total, and Reference Benchmarks visible)');

    // Capture screenshot of Household Benchmark page
    const screenshotPath = path.resolve(__dirname, 'p21_household_benchmark_preview.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testPass(`Saved screenshot to ${screenshotPath}`);

    // --- 4. Verify Classifier on Deployed Expenses Page ---
    console.log('\n--- 4. Verify Classifier on Deployed Expenses Page ---');
    console.log('  Navigating to /expenses on preview...');
    await page.goto(`${PREVIEW_URL}/expenses`, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('h1', { timeout: 10000 });
    const expensesTitle = await page.$eval('h1', (el) => el.innerText);
    testPass(`Expenses page loaded with title: "${expensesTitle}"`);

    // Type into description and suggest category
    const descInput = await page.$('#description');
    if (descInput) {
      await descInput.type('Swiggy dinner delivery', { delay: 30 });
      console.log('  Typed "Swiggy dinner delivery", clicking "Suggest Category"...');

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.innerText.includes('Suggest Category'));
        if (btn) btn.click();
      });

      // Wait for suggestion badge or result
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Food & Dining') ||
               document.body.innerText.includes('Suggested:') ||
               document.body.innerText.includes('Suggested Category') ||
               document.body.innerText.includes('Food');
      }, { timeout: 15000 });

      testPass('Transaction classifier successfully suggested category for "Swiggy dinner delivery" on deployed preview');

      const classifierScreenshotPath = path.resolve(__dirname, 'p21_classifier_expenses_preview.png');
      await page.screenshot({ path: classifierScreenshotPath, fullPage: true });
      testPass(`Saved screenshot to ${classifierScreenshotPath}`);
    } else {
      testFail('Could not find #description input on expenses page', new Error('Missing input'));
    }

  } catch (err) {
    testFail('Browser End-to-End Verification failed', err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // --- Summary ---
  console.log('\n================================================================');
  console.log(`Phase 21 Preview Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
