const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Starting Phase 14A Puppeteer Browser Verification...');
  const artifactDir = '/home/aditya/.gemini/antigravity-cli/brain/4d04b55e-10bb-486d-8626-077a333acd96';
  const sessionData = fs.readFileSync('/tmp/active_session_fresh.json', 'utf8');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const failedRequests = [];
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
  });

  // 1. Landing Page (Public)
  console.log('1. Visiting Landing Page: http://localhost:3000/ ...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  const landingScreenshotPath = path.join(artifactDir, 'strike_landing.png');
  await page.screenshot({ path: landingScreenshotPath, fullPage: true });
  console.log(`   Saved landing page screenshot to ${landingScreenshotPath}`);

  // Inject session for protected app pages
  console.log('2. Injecting auth session into localStorage...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => {
    localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
  }, sessionData);

  // 3. Dashboard Page
  console.log('3. Visiting Dashboard Page: http://localhost:3000/dashboard ...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 3000));
  const dashboardScreenshotPath = path.join(artifactDir, 'strike_dashboard.png');
  await page.screenshot({ path: dashboardScreenshotPath, fullPage: true });
  console.log(`   Saved dashboard screenshot to ${dashboardScreenshotPath}`);

  // Check Dashboard Content
  const hasHealthScore = await page.evaluate(() => {
    return document.body.innerText.includes('Financial Health Score');
  });
  const hasForecast = await page.evaluate(() => {
    return document.body.innerText.includes('Financial Forecast & Net Worth Trajectory');
  });
  const hasExpenseBreakdown = await page.evaluate(() => {
    return document.body.innerText.includes('Expense Breakdown');
  });
  const hasArchetypeOrLab = await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes('financial archetype') || text.includes('research lab') || text.includes('centroid');
  });

  console.log(`   Dashboard Health Score rendered: ${hasHealthScore}`);
  console.log(`   Dashboard Forecast rendered: ${hasForecast}`);
  console.log(`   Dashboard Expense Breakdown rendered: ${hasExpenseBreakdown}`);
  console.log(`   Dashboard legacy Archetype/Lab present: ${hasArchetypeOrLab}`);

  // 4. Expenses Page
  console.log('4. Visiting Expenses Page: http://localhost:3000/expenses ...');
  await page.goto('http://localhost:3000/expenses', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 3000));
  const expensesScreenshotPath = path.join(artifactDir, 'strike_expenses.png');
  await page.screenshot({ path: expensesScreenshotPath, fullPage: true });
  console.log(`   Saved expenses screenshot to ${expensesScreenshotPath}`);

  // Test Smart Suggestion on Expenses page
  console.log('5. Testing Smart Suggestion on Expenses Page...');
  await page.type('#description', 'Swiggy lunch order');
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.innerText.includes('Suggest Category'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  const suggestionResult = await page.evaluate(() => {
    const categoryEl = document.getElementById('category');
    const notice = document.querySelector('[role="alert"], .bg-success\\/5, .text-success, .text-emerald-500, .bg-emerald-500\\/10');
    return {
      category: categoryEl ? categoryEl.innerText.trim() : null,
      noticeText: notice ? notice.innerText.trim() : null,
    };
  });
  console.log('   Suggestion result for "Swiggy lunch order":', suggestionResult);

  // Take screenshot of expense page with suggestion notice
  const expenseSuggestionScreenshotPath = path.join(artifactDir, 'strike_expense_suggestion.png');
  await page.screenshot({ path: expenseSuggestionScreenshotPath, fullPage: false });
  console.log(`   Saved expense suggestion screenshot to ${expenseSuggestionScreenshotPath}`);

  // 6. Check 404 on deleted routes
  console.log('6. Verifying retired routes return 404...');
  const recRes = await page.goto('http://localhost:3000/recommendations', { waitUntil: 'networkidle2' });
  console.log(`   /recommendations status: ${recRes.status()}`);

  const labRes = await page.goto('http://localhost:3000/research-lab', { waitUntil: 'networkidle2' });
  console.log(`   /research-lab status: ${labRes.status()}`);

  await browser.close();

  console.log('\n--- VERIFICATION AUDIT SUMMARY ---');
  console.log(`Console errors count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console errors:', consoleErrors.slice(0, 5));
  }
  console.log(`Failed requests count: ${failedRequests.length}`);
  if (failedRequests.length > 0) {
    console.log('Failed requests:', failedRequests.slice(0, 5));
  }

  const success =
    hasHealthScore &&
    hasForecast &&
    hasExpenseBreakdown &&
    !hasArchetypeOrLab &&
    suggestionResult.category === 'Food' &&
    recRes.status() === 404 &&
    labRes.status() === 404;

  console.log(`\nOVERALL SUITE RESULT: ${success ? 'PASSED ALL CRITERIA' : 'FAILED AUDIT'}`);
  process.exit(success ? 0 : 1);
}

run().catch((err) => {
  console.error('Fatal error in script:', err);
  process.exit(1);
});
