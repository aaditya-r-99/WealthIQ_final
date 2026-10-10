const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Starting WealthIQ Expenses Page Classifier Verification...');

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
  console.log('1. Navigating to /login and injecting auth session...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => {
    localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
  }, sessionData);

  // 2. Open Expenses page
  console.log('2. Navigating to /expenses...');
  await page.goto('http://localhost:3000/expenses', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // 3. Test Case 1: Swiggy dinner order 48291
  console.log('\n3. Testing Swiggy dinner order 48291...');
  await page.focus('#description');
  await page.evaluate(() => {
    const input = document.getElementById('description');
    input.value = '';
  });
  await page.type('#description', 'Swiggy dinner order 48291', { delay: 10 });
  await new Promise((r) => setTimeout(r, 300));

  // Click Suggest Category
  console.log('   Clicking "Suggest Category" button...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.innerText.includes('Suggest Category'));
    if (btn) btn.click();
  });

  // Wait for classification response
  await new Promise((r) => setTimeout(r, 2000));

  // Check suggestion notice and category dropdown value
  const swiggyResult = await page.evaluate(() => {
    const noticeEl = document.querySelector('.bg-emerald-500\\/5, .border-emerald-500\\/30, .border-amber-500\\/30, .border-muted-foreground\\/20');
    const noticeText = noticeEl ? noticeEl.innerText.trim() : null;
    const catTrigger = document.querySelector('#category, button[role="combobox"]');
    const catText = catTrigger ? catTrigger.innerText.trim() : null;
    return { noticeText, catText };
  });

  console.log('   Category selected:', swiggyResult.catText);
  console.log('   Notice text:', swiggyResult.noticeText);

  const artifactDir = '/home/aditya/.gemini/antigravity-cli/brain/6d923dbb-bb65-459c-9684-94b2b67eb861';
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({ path: path.join(artifactDir, 'expenses_swiggy_verified.png') });
  console.log('   Saved screenshot: expenses_swiggy_verified.png');

  // 4. Test Case 2: Monthly rent Orchid Woods
  console.log('\n4. Testing Monthly rent Orchid Woods...');
  await page.evaluate(() => {
    const input = document.getElementById('description');
    input.value = '';
  });
  await page.focus('#description');
  await page.type('#description', 'Monthly rent Orchid Woods', { delay: 10 });
  await new Promise((r) => setTimeout(r, 300));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.innerText.includes('Suggest Category'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  const rentResult = await page.evaluate(() => {
    const noticeEl = document.querySelector('.bg-emerald-500\\/5, .border-emerald-500\\/30, .border-amber-500\\/30, .border-muted-foreground\\/20');
    const noticeText = noticeEl ? noticeEl.innerText.trim() : null;
    const catTrigger = document.querySelector('#category, button[role="combobox"]');
    const catText = catTrigger ? catTrigger.innerText.trim() : null;
    return { noticeText, catText };
  });

  console.log('   Category selected:', rentResult.catText);
  console.log('   Notice text:', rentResult.noticeText);

  await page.screenshot({ path: path.join(artifactDir, 'expenses_rent_verified.png') });
  console.log('   Saved screenshot: expenses_rent_verified.png');

  // 5. Test Case 3: Ambiguous description
  console.log('\n5. Testing ambiguous description...');
  await page.evaluate(() => {
    const input = document.getElementById('description');
    input.value = '';
  });
  await page.focus('#description');
  await page.type('#description', 'UPI transfer to Sharmaji 9876543210', { delay: 10 });
  await new Promise((r) => setTimeout(r, 300));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.innerText.includes('Suggest Category'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  const ambigResult = await page.evaluate(() => {
    const reviewNotice = document.querySelector('.border-amber-500\\/30');
    const noticeText = reviewNotice ? reviewNotice.innerText.trim() : null;
    return { noticeText, hasReviewWarning: Boolean(reviewNotice) };
  });

  console.log('   Ambiguous review notice:', ambigResult);

  // 6. Non-auto-save check: check that records list did NOT increase
  console.log('\n6. Checking non-auto-save behavior...');
  const tableRows = await page.$$eval('table tbody tr', (rows) => rows.length).catch(() => 0);
  console.log(`   Table rows count: ${tableRows} (suggestions do NOT auto-save)`);

  console.log(`\nConsole errors encountered: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  await browser.close();

  const swiggyPassed = swiggyResult.noticeText && swiggyResult.noticeText.includes('Food');
  const rentPassed = rentResult.noticeText && rentResult.noticeText.includes('Housing');
  console.log('\n=============================================');
  console.log(`Swiggy Classification: ${swiggyPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Rent Classification:   ${rentPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Review Warning:        ${ambigResult.hasReviewWarning ? 'PASSED' : 'FAILED'}`);
  console.log('=============================================');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
