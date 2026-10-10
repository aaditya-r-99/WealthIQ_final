const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Starting Phase 14B UI & Layout Verification...');
  const artifactDir = '/home/aditya/.gemini/antigravity-cli/brain/4d04b55e-10bb-486d-8626-077a333acd96';
  const sessionData = fs.readFileSync('/tmp/active_session_fresh.json', 'utf8');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

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

  // --- 1. LANDING PAGE (Monochrome Audit) ---
  console.log('\n--- 1. Testing Landing Page (Monochrome Audit) ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  const landingBg = await page.evaluate(() => {
    const body = document.body;
    const bg = window.getComputedStyle(body).backgroundColor;
    return bg;
  });
  console.log(`   Landing page background computed color: ${landingBg}`);

  const landingScreenshotPath = path.join(artifactDir, 'desktop_landing_monochrome.png');
  await page.screenshot({ path: landingScreenshotPath, fullPage: true });
  console.log(`   Saved monochrome landing page screenshot: ${landingScreenshotPath}`);

  // --- 2. AUTH INJECTION ---
  console.log('\n--- 2. Injecting Auth Session ---');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => {
    localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
    // Ensure clean initial sidebar state
    localStorage.removeItem('wealthiq_sidebar_collapsed');
  }, sessionData);

  // --- 3. 1920x1080 DESKTOP WIDE VIEWPORT & SIDEBAR COLLAPSE TEST ---
  console.log('\n--- 3. Testing 1920x1080 Desktop Viewport & Sidebar Collapse ---');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Measure initial expanded state
  const expandedLayout = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const mainContainer = document.querySelector('main');
    const asideRect = aside ? aside.getBoundingClientRect() : null;
    const mainRect = mainContainer ? mainContainer.getBoundingClientRect() : null;
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const asideBg = aside ? window.getComputedStyle(aside).backgroundColor : null;

    return {
      asideWidth: asideRect ? asideRect.width : 0,
      mainWidth: mainRect ? mainRect.width : 0,
      mainLeftMargin: mainRect ? mainRect.left : 0,
      bodyBg,
      asideBg,
    };
  });
  console.log('   Expanded state measurements:', expandedLayout);

  const expandedScreenshot = path.join(artifactDir, 'desktop_1920_expanded.png');
  await page.screenshot({ path: expandedScreenshot, fullPage: false });
  console.log(`   Saved 1920px expanded screenshot: ${expandedScreenshot}`);

  // Click collapse toggle button
  console.log('   Clicking collapse toggle button...');
  const collapseBtnFound = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Collapse sidebar"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log(`   Collapse button found and clicked: ${collapseBtnFound}`);

  // Wait for 400ms transition
  await new Promise((r) => setTimeout(r, 600));

  // Measure collapsed state
  const collapsedLayout = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const mainContainer = document.querySelector('main');
    const asideRect = aside ? aside.getBoundingClientRect() : null;
    const mainRect = mainContainer ? mainContainer.getBoundingClientRect() : null;
    const storedState = localStorage.getItem('wealthiq_sidebar_collapsed');

    return {
      asideWidth: asideRect ? asideRect.width : 0,
      mainWidth: mainRect ? mainRect.width : 0,
      mainLeftMargin: mainRect ? mainRect.left : 0,
      storedState,
    };
  });
  console.log('   Collapsed state measurements:', collapsedLayout);

  const collapsedScreenshot = path.join(artifactDir, 'desktop_1920_collapsed.png');
  await page.screenshot({ path: collapsedScreenshot, fullPage: false });
  console.log(`   Saved 1920px collapsed screenshot: ${collapsedScreenshot}`);

  // Click expand toggle button
  console.log('   Clicking expand toggle button to restore...');
  const expandBtnFound = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Expand sidebar"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log(`   Expand button found and clicked: ${expandBtnFound}`);
  await new Promise((r) => setTimeout(r, 600));

  const restoredLayout = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const asideRect = aside ? aside.getBoundingClientRect() : null;
    const storedState = localStorage.getItem('wealthiq_sidebar_collapsed');
    return {
      asideWidth: asideRect ? asideRect.width : 0,
      storedState,
    };
  });
  console.log('   Restored expanded state measurements:', restoredLayout);

  // --- 4. 1366x768 DESKTOP STANDARD VIEWPORT ---
  console.log('\n--- 4. Testing 1366x768 Standard Desktop Viewport ---');
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  const d1366Screenshot = path.join(artifactDir, 'desktop_1366_dashboard.png');
  await page.screenshot({ path: d1366Screenshot, fullPage: false });
  console.log(`   Saved 1366px dashboard screenshot: ${d1366Screenshot}`);

  // Test Expenses on 1366
  console.log('   Navigating to /expenses on 1366px...');
  await page.goto('http://localhost:3000/expenses', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  const expScreenshot = path.join(artifactDir, 'desktop_1366_expenses.png');
  await page.screenshot({ path: expScreenshot, fullPage: false });
  console.log(`   Saved 1366px expenses screenshot: ${expScreenshot}`);

  // Test Forecast on 1366
  console.log('   Navigating to /forecast on 1366px...');
  await page.goto('http://localhost:3000/forecast', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  const fcastScreenshot = path.join(artifactDir, 'desktop_1366_forecast.png');
  await page.screenshot({ path: fcastScreenshot, fullPage: false });
  console.log(`   Saved 1366px forecast screenshot: ${fcastScreenshot}`);

  // --- 5. 390x844 MOBILE VIEWPORT & DRAWER TEST ---
  console.log('\n--- 5. Testing 390x844 Mobile Viewport & Drawer ---');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Check initial mobile drawer is closed / hidden
  const mobileInitial = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const isHidden = aside ? aside.classList.contains('-translate-x-full') : false;
    return { isHidden };
  });
  console.log('   Mobile initial sidebar is hidden offscreen:', mobileInitial.isHidden);

  const mobileDashScreenshot = path.join(artifactDir, 'mobile_390_dashboard.png');
  await page.screenshot({ path: mobileDashScreenshot, fullPage: false });
  console.log(`   Saved 390px mobile dashboard screenshot: ${mobileDashScreenshot}`);

  // Open mobile drawer
  console.log('   Clicking mobile menu hamburger button...');
  const menuBtnFound = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Toggle menu"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log(`   Mobile menu button found and clicked: ${menuBtnFound}`);
  await new Promise((r) => setTimeout(r, 600));

  const drawerState = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const isVisible = aside ? aside.classList.contains('translate-x-0') : false;
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/60');
    return { isVisible, hasBackdrop: !!backdrop };
  });
  console.log('   Drawer state after hamburger click:', drawerState);

  const mobileDrawerScreenshot = path.join(artifactDir, 'mobile_390_drawer.png');
  await page.screenshot({ path: mobileDrawerScreenshot, fullPage: false });
  console.log(`   Saved 390px mobile drawer screenshot: ${mobileDrawerScreenshot}`);

  // Close mobile drawer via close button
  console.log('   Closing mobile drawer via close button...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Close navigation"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const drawerClosedState = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const isHidden = aside ? aside.classList.contains('-translate-x-full') : false;
    return { isHidden };
  });
  console.log('   Drawer state after close button click:', drawerClosedState);

  await browser.close();

  // Verification assertions
  const isAsideWidthExpanded = Math.round(expandedLayout.asideWidth) === 256;
  const isAsideWidthCollapsed = Math.round(collapsedLayout.asideWidth) === 80;
  const isAsideWidthRestored = Math.round(restoredLayout.asideWidth) === 256;
  const isStoragePersisted = collapsedLayout.storedState === 'true' && restoredLayout.storedState === 'false';
  const isMobileDrawerOperational = menuBtnFound && drawerState.isVisible && drawerClosedState.isHidden;

  console.log('\n=============================================');
  console.log('           PHASE 14B VERIFICATION AUDIT       ');
  console.log('=============================================');
  console.log(`- Expanded Aside Width (256px): ${isAsideWidthExpanded ? 'PASS' : 'FAIL'} (${expandedLayout.asideWidth}px)`);
  console.log(`- Collapsed Aside Width (80px): ${isAsideWidthCollapsed ? 'PASS' : 'FAIL'} (${collapsedLayout.asideWidth}px)`);
  console.log(`- Restored Aside Width (256px): ${isAsideWidthRestored ? 'PASS' : 'FAIL'} (${restoredLayout.asideWidth}px)`);
  console.log(`- localStorage Persistence: ${isStoragePersisted ? 'PASS' : 'FAIL'}`);
  console.log(`- Main Container 1920px fluid width: ${collapsedLayout.mainWidth}px (expanded: ${expandedLayout.mainWidth}px)`);
  console.log(`- Mobile Drawer Operation: ${isMobileDrawerOperational ? 'PASS' : 'FAIL'}`);
  console.log(`- Console Errors: ${consoleErrors.length}`);
  console.log(`- Failed Network Requests: ${failedRequests.length}`);

  const allPassed =
    isAsideWidthExpanded &&
    isAsideWidthCollapsed &&
    isAsideWidthRestored &&
    isStoragePersisted &&
    isMobileDrawerOperational;

  console.log(`\nOVERALL SUITE RESULT: ${allPassed ? 'ALL VERIFICATIONS PASSED' : 'SOME VERIFICATIONS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error('Fatal error in Phase 14B verification:', err);
  process.exit(1);
});
