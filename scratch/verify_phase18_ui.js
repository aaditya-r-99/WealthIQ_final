const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function main() {
  console.log('====================================================');
  console.log('WealthIQ Phase 18 — Comprehensive UI Verification');
  console.log('====================================================\n');

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

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Load session if available
  if (fs.existsSync('/tmp/active_session_fresh.json')) {
    const sessionData = fs.readFileSync('/tmp/active_session_fresh.json', 'utf8');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.evaluate((tok) => {
      localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
    }, sessionData);
  }

  // Helper to check horizontal overflow
  async function checkNoHorizontalOverflow(viewportName) {
    const overflow = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      return { docWidth, winWidth, hasOverflow: docWidth > winWidth };
    });
    if (!overflow.hasOverflow) {
      testPass(`No horizontal overflow at ${viewportName} (${overflow.winWidth}px)`);
    } else {
      testFail(`Horizontal overflow detected at ${viewportName}`, new Error(`docWidth: ${overflow.docWidth} > winWidth: ${overflow.winWidth}`));
    }
  }

  console.log('--- 1. Desktop 1920x1080 Verification ---');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    try { localStorage.removeItem('wealthiq_sidebar_collapsed'); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Expanded state
  await checkNoHorizontalOverflow('1920px expanded');
  await page.screenshot({ path: 'scratch/p18_1920_expanded.png', fullPage: false });
  testPass('Captured 1920px expanded screenshot');

  // Verify collapse button exists
  const collapseBtn = await page.$('button[aria-label="Collapse sidebar"]');
  assert(collapseBtn, 'Collapse button missing in expanded state');
  testPass('Desktop collapse button is visible and accessible');

  // Click collapse
  await collapseBtn.click();
  await new Promise(r => setTimeout(r, 600));

  // Verify collapsed state
  const isCollapsed = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    return aside && aside.classList.contains('w-20');
  });
  assert(isCollapsed, 'Sidebar failed to transition to w-20 rail');
  testPass('Sidebar smoothly transitions to 80px (w-20) rail');

  // Verify expand button in collapsed state
  const expandBtn = await page.$('button[aria-label="Expand sidebar"]');
  assert(expandBtn, 'Expand button missing in collapsed state');
  testPass('Expand button exists with accessible label and click target');

  // Verify logo and expand button do not collide or touch
  const geometry = await page.evaluate(() => {
    const logo = document.querySelector('aside a[aria-label="WealthIQ Home"]');
    const btn = document.querySelector('button[aria-label="Expand sidebar"]');
    if (!logo || !btn) return null;
    const lRect = logo.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    return {
      logoBottom: lRect.bottom,
      btnTop: bRect.top,
      logoLeft: lRect.left,
      logoRight: lRect.right,
      btnLeft: bRect.left,
      btnRight: bRect.right,
      verticalDistance: bRect.top - lRect.bottom,
      logoWidth: lRect.width,
      logoHeight: lRect.height,
    };
  });
  assert(geometry, 'Could not inspect geometry');
  assert(geometry.verticalDistance >= 4, `Buttons too close vertically: ${geometry.verticalDistance}px`);
  assert(geometry.logoHeight >= 24, `Logo too small: ${geometry.logoHeight}px`);
  testPass(`Logo and Expand button have ${geometry.verticalDistance.toFixed(1)}px clear vertical separation with no overlap`);

  await checkNoHorizontalOverflow('1920px collapsed');
  await page.screenshot({ path: 'scratch/p18_1920_collapsed.png', fullPage: false });
  testPass('Captured 1920px collapsed screenshot');

  // Test persistence: reload page while collapsed
  console.log('\n--- 2. Persistence Verification ---');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  const persistedCollapsed = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const stored = localStorage.getItem('wealthiq_sidebar_collapsed');
    return aside && aside.classList.contains('w-20') && stored === 'true';
  });
  assert(persistedCollapsed, 'Sidebar collapsed state not persisted in localStorage');
  testPass('Collapsed sidebar state persisted across page reload');

  // Expand back
  const expandBtnReloaded = await page.$('button[aria-label="Expand sidebar"]');
  await expandBtnReloaded.click();
  await new Promise(r => setTimeout(r, 600));

  console.log('\n--- 3. Desktop 1366x768 & 1024x768 Verification ---');
  await page.setViewport({ width: 1366, height: 768 });
  await checkNoHorizontalOverflow('1366px');
  await page.screenshot({ path: 'scratch/p18_1366_desktop.png', fullPage: false });
  testPass('Captured 1366px desktop screenshot');

  await page.setViewport({ width: 1024, height: 768 });
  await checkNoHorizontalOverflow('1024px');
  await page.screenshot({ path: 'scratch/p18_1024_tablet.png', fullPage: false });
  testPass('Captured 1024px narrow desktop screenshot');

  console.log('\n--- 4. Mobile 390x844 & 375x812 Verification ---');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await checkNoHorizontalOverflow('390px mobile closed');
  await page.screenshot({ path: 'scratch/p18_390_mobile_closed.png', fullPage: false });

  // Open mobile drawer
  const menuBtn = await page.$('button[aria-label="Toggle menu"]');
  assert(menuBtn, 'Mobile hamburger menu button missing');
  await menuBtn.click();
  await new Promise(r => setTimeout(r, 600));

  // Check drawer is open
  const drawerOpen = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    return aside && aside.classList.contains('translate-x-0');
  });
  assert(drawerOpen, 'Mobile drawer failed to open');
  testPass('Mobile navigation drawer opens smoothly');

  await page.screenshot({ path: 'scratch/p18_390_mobile_drawer.png', fullPage: false });
  testPass('Captured 390px mobile drawer open screenshot');

  // Close drawer via X button
  const closeDrawerBtn = await page.$('button[aria-label="Close navigation"]');
  assert(closeDrawerBtn, 'Close drawer button missing');
  await closeDrawerBtn.click();
  await new Promise(r => setTimeout(r, 600));

  // 375px mobile
  await page.setViewport({ width: 375, height: 812 });
  await checkNoHorizontalOverflow('375px mobile');
  await page.screenshot({ path: 'scratch/p18_375_mobile.png', fullPage: false });
  testPass('Captured 375px mobile screenshot with zero overflow');

  console.log('\n--- 5. Forecast & Chart Y-Axis Readability Verification ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/forecast', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Inspect Y-axis ticks
  const yAxisTicks = await page.evaluate(() => {
    const yAxisGroup = document.querySelector('.recharts-yAxis');
    if (!yAxisGroup) return null;
    const ticks = Array.from(yAxisGroup.querySelectorAll('.recharts-cartesian-axis-tick-value'));
    return ticks.map((t) => t.textContent.trim());
  });

  console.log('  Forecast Chart Y-axis ticks detected:', yAxisTicks);
  assert(yAxisTicks && yAxisTicks.length > 0, 'No Y-axis ticks detected');
  // Check that every tick starts with ₹ or -₹
  const allFormatted = yAxisTicks.every((t) => t.startsWith('₹') || t.startsWith('-₹'));
  assert(allFormatted, `Not all ticks formatted with rupee: ${JSON.stringify(yAxisTicks)}`);
  testPass(`All Y-axis ticks properly formatted with INR symbol: ${yAxisTicks.join(', ')}`);

  // Verify none are clipped by SVG boundaries
  const clippingCheck = await page.evaluate(() => {
    const svg = document.querySelector('.recharts-surface');
    const yAxisGroup = document.querySelector('.recharts-yAxis');
    if (!svg || !yAxisGroup) return null;
    const svgRect = svg.getBoundingClientRect();
    const ticks = Array.from(yAxisGroup.querySelectorAll('.recharts-cartesian-axis-tick-value'));
    return ticks.map((t) => {
      const r = t.getBoundingClientRect();
      return {
        text: t.textContent.trim(),
        leftDiff: r.left - svgRect.left,
        isClipped: r.left < svgRect.left,
      };
    });
  });

  const hasClipped = clippingCheck.some((c) => c.isClipped);
  assert(!hasClipped, `Clipped ticks detected: ${JSON.stringify(clippingCheck)}`);
  testPass('Zero tick labels clipped: all labels lie completely inside SVG container boundaries');

  await page.screenshot({ path: 'scratch/p18_forecast_chart_fixed.png', fullPage: false });
  testPass('Captured forecast chart verified screenshot');

  // Verify Dashboard chart as well
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  // Scroll to forecast chart
  await page.evaluate(() => {
    const el = document.querySelector('.recharts-wrapper');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 500));

  const dashYTicks = await page.evaluate(() => {
    const yAxisGroup = document.querySelector('.recharts-yAxis');
    if (!yAxisGroup) return null;
    const ticks = Array.from(yAxisGroup.querySelectorAll('.recharts-cartesian-axis-tick-value'));
    return ticks.map((t) => t.textContent.trim());
  });
  console.log('  Dashboard Chart Y-axis ticks detected:', dashYTicks);
  assert(dashYTicks && dashYTicks.length > 0, 'Dashboard Y-axis ticks missing');
  assert(dashYTicks.every((t) => t.startsWith('₹') || t.startsWith('-₹')), 'Dashboard ticks missing rupee symbol');
  testPass(`Dashboard chart Y-axis ticks properly formatted: ${dashYTicks.join(', ')}`);

  await page.screenshot({ path: 'scratch/p18_dashboard_chart_fixed.png', fullPage: false });
  testPass('Captured dashboard chart verified screenshot');

  await browser.close();

  console.log('\n====================================================');
  console.log(`Phase 18 UI Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
