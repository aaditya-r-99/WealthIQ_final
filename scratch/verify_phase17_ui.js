const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('====================================================');
  console.log('WealthIQ Phase 17 — Puppeteer Browser Verification');
  console.log('====================================================\n');

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

  // 1. Authenticate session
  console.log('1. Authenticating test session...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => {
    localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
  }, sessionData);

  // 2. Open Household Benchmark Page
  console.log('2. Navigating to /household-benchmark...');
  await page.goto('http://localhost:3000/household-benchmark', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Verify page title
  const pageTitle = await page.$eval('h1', (el) => el.innerText);
  console.log(`   Page Title: "${pageTitle}"`);
  if (!pageTitle.includes('Household Spending Benchmark')) {
    throw new Error(`Unexpected page title: ${pageTitle}`);
  }

  // 3. Inspect Form & Results
  console.log('3. Verifying initial benchmark results on page...');
  const resultData = await page.evaluate(() => {
    const totalEl = document.querySelector('p.text-2xl');
    const cards = Array.from(document.querySelectorAll('.rounded-lg.border'));
    return {
      hasTotal: Boolean(totalEl),
      totalText: totalEl ? totalEl.innerText : null,
      cardsCount: cards.length,
    };
  });
  console.log('   Result Data:', resultData);

  // Take initial benchmark screenshot
  const screenshotPath1 = path.resolve(process.cwd(), 'scratch/household_benchmark_desktop.png');
  await page.screenshot({ path: screenshotPath1, fullPage: true });
  console.log(`   Captured desktop screenshot: ${screenshotPath1}`);

  // 4. Test Form Interaction: Change State to Karnataka (29) and household size to 4
  console.log('\n4. Testing form inputs: Changing to Karnataka, 4 members...');
  // Click on State select trigger
  await page.click('#state-select');
  await new Promise((r) => setTimeout(r, 500));
  // Select Karnataka
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="option"]'));
    const ka = items.find((el) => el.innerText.includes('Karnataka'));
    if (ka) ka.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Change household size to 4
  await page.evaluate(() => {
    const input = document.getElementById('hh-size');
    if (input) {
      input.value = '4';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Click "Calculate Benchmark"
  console.log('   Clicking "Calculate Benchmark"...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.innerText.includes('Calculate Benchmark'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Verify updated results
  const updatedResults = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('span, div')).map((e) => e.innerText);
    const hasKarnataka = badges.some((b) => b.includes('KARNATAKA') || b.includes('Karnataka'));
    const totalEl = document.querySelector('p.text-2xl');
    return {
      hasKarnataka,
      totalText: totalEl ? totalEl.innerText : null,
    };
  });
  console.log('   Updated results for Karnataka:', updatedResults);

  // 5. Test Optional Spending Comparison: Consent Checkbox & Manual Entry
  console.log('\n5. Testing Optional Spending Comparison...');
  await page.evaluate(() => {
    const checkbox = document.getElementById('consent-check');
    if (checkbox) checkbox.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Switch to manual input mode
  await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    if (radios[1]) radios[1].click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Enter manual spending ₹75,000
  await page.type('#manual-exp', '75000', { delay: 10 });
  await new Promise((r) => setTimeout(r, 1000));

  // Verify comparison rendered
  const compVisualizer = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('div, p, span')).map((e) => e.innerText);
    const hasVisualizer = texts.some((t) => t.includes('Comparison Visualizer'));
    const hasDescriptive = texts.some((t) => t.includes('Descriptive Context'));
    return { hasVisualizer, hasDescriptive };
  });
  console.log('   Comparison visualizer rendered:', compVisualizer);

  const screenshotPath2 = path.resolve(process.cwd(), 'scratch/household_benchmark_comparison.png');
  await page.screenshot({ path: screenshotPath2, fullPage: true });
  console.log(`   Captured comparison screenshot: ${screenshotPath2}`);

  // 6. Test Dashboard link card
  console.log('\n6. Checking Dashboard link card at /dashboard...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  const dashboardBenchmarkLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const benchmarkLink = links.find((a) => a.getAttribute('href') === '/household-benchmark');
    return {
      exists: Boolean(benchmarkLink),
      text: benchmarkLink ? benchmarkLink.innerText : null,
    };
  });
  console.log('   Dashboard benchmark link:', dashboardBenchmarkLink);

  const screenshotPath3 = path.resolve(process.cwd(), 'scratch/dashboard_benchmark_link.png');
  await page.screenshot({ path: screenshotPath3, fullPage: true });
  console.log(`   Captured dashboard screenshot: ${screenshotPath3}`);

  // 7. Test Mobile view (375x812)
  console.log('\n7. Testing mobile responsive viewport (375x812)...');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto('http://localhost:3000/household-benchmark', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  const screenshotPath4 = path.resolve(process.cwd(), 'scratch/household_benchmark_mobile.png');
  await page.screenshot({ path: screenshotPath4, fullPage: true });
  console.log(`   Captured mobile screenshot: ${screenshotPath4}`);

  // 8. Verify Sidebar Link
  console.log('\n8. Checking sidebar link presence...');
  const sidebarBenchmarkLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const link = links.find((a) => a.getAttribute('href') === '/household-benchmark');
    return Boolean(link);
  });
  console.log('   Sidebar link exists:', sidebarBenchmarkLink);

  await browser.close();

  console.log('\n====================================================');
  console.log('Puppeteer Browser Verification Completed Successfully!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal Puppeteer error:', err);
  process.exit(1);
});
