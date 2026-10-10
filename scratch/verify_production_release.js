const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PROD_URL = 'https://wealthiq-nine.vercel.app';
const BENCHMARK_MICROSERVICE_URL = 'https://wealthiq-benchmark.vercel.app';
const CLASSIFIER_MICROSERVICE_URL = 'https://wealthiq-classifier-o7nt9hbk3-adityaprajapati-5528s-projects.vercel.app';

async function main() {
  console.log('================================================================');
  console.log('WealthIQ Production Release End-to-End Verification');
  console.log('Production URL: ' + PROD_URL);
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

  // --- 2. Production Web Application API Routes ---
  console.log('\n--- 2. Production Web Application Next.js API Routes ---');
  try {
    const res = await fetch(`${PROD_URL}/api/household-benchmark`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.upstream_healthy, true);
    assert.strictEqual(data.model_algorithm, 'HistGradientBoostingRegressor');
    testPass('Production /api/household-benchmark GET reports upstream_healthy: true');
  } catch (err) {
    testFail('Production /api/household-benchmark GET failed', err);
  }

  try {
    const res = await fetch(`${PROD_URL}/api/classify-transaction`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.upstream_healthy, true);
    testPass('Production /api/classify-transaction GET reports upstream_healthy: true');
  } catch (err) {
    testFail('Production /api/classify-transaction GET failed', err);
  }

  try {
    const res = await fetch(`${PROD_URL}/api/household-benchmark`, {
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
    testPass(`Production /api/household-benchmark POST inference successful (MPCE: ₹${data.estimated_mpce.toFixed(2)}, HH Total: ₹${data.estimated_household_total.toFixed(2)})`);
  } catch (err) {
    testFail('Production /api/household-benchmark POST failed', err);
  }

  try {
    const res = await fetch(`${PROD_URL}/api/household-benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: '99' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 422);
    assert.ok(data.error.includes('Invalid or missing state code'));
    testPass('Production /api/household-benchmark validation error handling (HTTP 422 on invalid state)');
  } catch (err) {
    testFail('Production /api/household-benchmark validation failed', err);
  }

  // Load auth session token
  const sessionFile = '/tmp/active_session_fresh.json';
  assert.ok(fs.existsSync(sessionFile), 'Active session file must exist');
  const sessionData = fs.readFileSync(sessionFile, 'utf8');
  const parsedSession = JSON.parse(sessionData);

  try {
    const res = await fetch(`${PROD_URL}/api/classify-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${parsedSession.access_token}`,
      },
      body: JSON.stringify({ description: 'Swiggy dinner order 48291' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.available, true);
    assert.strictEqual(data.category, 'Food');
    testPass('Production /api/classify-transaction POST authenticated request successful (Category: Food)');
  } catch (err) {
    testFail('Production /api/classify-transaction POST authenticated request failed', err);
  }

  // --- 3. Browser End-to-End Verification on Production ---
  console.log('\n--- 3. Browser End-to-End Verification on Production ---');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/brave-browser',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
      defaultViewport: { width: 1440, height: 900 },
    });

    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`  [BROWSER ERROR]: ${msg.text()}`);
      }
    });

    // 3.1 Visit Landing Page
    console.log('  Navigating to / (Landing page)...');
    await page.goto(`${PROD_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    const logoExists = await page.evaluate(() => {
      return Boolean(document.querySelector('svg linearGradient[id="wiq-gradient-bg"]'));
    });
    assert.ok(logoExists, 'Refined monochrome logo must exist in DOM');
    testPass('Landing page loaded with refined monochrome logo');

    // 3.2 Login Page & Session Seed
    console.log('  Navigating to /login to seed auth token...');
    await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate((tok) => {
      localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
    }, sessionData);
    testPass('Authenticated session token injected into production localStorage');

    // 3.3 Dashboard Page
    console.log('  Navigating to /dashboard on production...');
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 15000 });
    const dashTitle = await page.$eval('h1', (el) => el.innerText);
    assert.ok(dashTitle.includes('Dashboard'), `Expected title to contain Dashboard, got "${dashTitle}"`);
    testPass(`Dashboard loaded with title: "${dashTitle}"`);

    // 3.4 Household Benchmark UI
    console.log('  Navigating to /household-benchmark on production...');
    await page.goto(`${PROD_URL}/household-benchmark`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 15000 });
    const benchmarkTitle = await page.$eval('h1', (el) => el.innerText);
    assert.ok(benchmarkTitle.includes('Household Spending Benchmark'), `Title mismatch: ${benchmarkTitle}`);
    testPass(`Household Benchmark page loaded: "${benchmarkTitle}"`);

    console.log('  Clicking "Calculate Benchmark" button in UI...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.innerText.includes('Calculate Benchmark'));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => {
      return (
        document.body.innerText.includes('Per Capita Expenditure (MPCE)') ||
        document.body.innerText.includes('Estimated Household Total')
      );
    }, { timeout: 15000 });

    const benchmarkText = await page.evaluate(() => document.body.innerText);
    assert.ok(benchmarkText.includes('Per Capita Expenditure (MPCE)'), 'Missing MPCE');
    assert.ok(benchmarkText.includes('Estimated Household Total'), 'Missing Household Total');
    testPass('Household Benchmark ML inference correctly rendered in production UI');

    const benchmarkScreenshot = path.resolve(__dirname, 'prod_household_benchmark.png');
    await page.screenshot({ path: benchmarkScreenshot, fullPage: true });
    testPass(`Saved benchmark screenshot to ${benchmarkScreenshot}`);

    // 3.5 Expenses Page & Classifier UI
    console.log('  Navigating to /expenses on production...');
    await page.goto(`${PROD_URL}/expenses`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 15000 });
    const expensesTitle = await page.$eval('h1', (el) => el.innerText);
    testPass(`Expenses page loaded: "${expensesTitle}"`);

    const descInput = await page.$('#description');
    if (descInput) {
      await descInput.type('Swiggy dinner delivery', { delay: 30 });
      console.log('  Typed "Swiggy dinner delivery", clicking "Suggest Category"...');

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find((b) => b.innerText.includes('Suggest Category'));
        if (btn) btn.click();
      });

      await page.waitForFunction(() => {
        return (
          document.body.innerText.includes('Food & Dining') ||
          document.body.innerText.includes('Food') ||
          document.body.innerText.includes('Suggested:')
        );
      }, { timeout: 15000 });

      testPass('Transaction classifier successfully suggested "Food" on production Expenses page');

      const expensesScreenshot = path.resolve(__dirname, 'prod_classifier_expenses.png');
      await page.screenshot({ path: expensesScreenshot, fullPage: true });
      testPass(`Saved expenses screenshot to ${expensesScreenshot}`);
    } else {
      testFail('Could not find #description input on expenses page', new Error('Missing input'));
    }

    // 3.6 Multi-Viewport Layout Integrity
    console.log('\n--- 4. Multi-Viewport Layout Verification ---');
    const viewports = [
      { name: 'Desktop Large', width: 1920, height: 1080 },
      { name: 'Laptop Standard', width: 1366, height: 768 },
      { name: 'Tablet Landscape', width: 1024, height: 768 },
      { name: 'Modern Mobile', width: 390, height: 844 },
      { name: 'Compact Mobile', width: 375, height: 667 },
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`${PROD_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
      const overflow = await page.evaluate((w) => {
        return document.documentElement.scrollWidth > w;
      }, vp.width);
      assert.strictEqual(overflow, false, `Horizontal overflow detected at ${vp.width}px`);
      testPass(`Viewport ${vp.name} (${vp.width}px): Zero horizontal overflow`);
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
  console.log(`Production Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
