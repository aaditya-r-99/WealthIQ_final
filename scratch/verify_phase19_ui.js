const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function main() {
  console.log('====================================================');
  console.log('WealthIQ Phase 19 — UI, Content & Chart Verification');
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

  // Load session from /tmp/active_session_fresh.json
  if (fs.existsSync('/tmp/active_session_fresh.json')) {
    const sessionData = fs.readFileSync('/tmp/active_session_fresh.json', 'utf8');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate((tok) => {
      localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
    }, sessionData);
  }

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

  console.log('--- 1. Multi-Viewport Responsiveness & Layout Checks ---');
  const viewports = [
    { name: '1920px Desktop Large', width: 1920, height: 1080, key: '1920' },
    { name: '1366px Laptop', width: 1366, height: 768, key: '1366' },
    { name: '1024px Tablet', width: 1024, height: 768, key: '1024' },
    { name: '390px Mobile', width: 390, height: 844, key: '390' },
    { name: '375px Mobile Small', width: 375, height: 667, key: '375' }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1200));

    await checkNoHorizontalOverflow(vp.name);
    await page.screenshot({ path: `scratch/p19_${vp.key}_dashboard.png`, fullPage: false });
    testPass(`Captured dashboard screenshot at ${vp.name}`);
  }

  console.log('\n--- 2. Dashboard Content Audit & Health Score Verification ---');
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  // Check no raw formula arithmetic block (score * weight = product) on dashboard
  const hasRawFormula = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('score × weight') || text.includes('Deterministic Ratio Rules');
  });
  if (!hasRawFormula) {
    testPass('Raw formula clutter ("score × weight", "Deterministic Ratio Rules") removed from primary dashboard');
  } else {
    testFail('Raw formula clutter still found on dashboard');
  }

  // Check 5 pillars rendered cleanly
  const pillarsRendered = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Savings Behavior') &&
           text.includes('Expense Burden') &&
           text.includes('Debt Burden') &&
           text.includes('Emergency Fund') &&
           text.includes('Investments & Assets');
  });
  if (pillarsRendered) {
    testPass('All 5 financial health pillars rendered cleanly in progress grid');
  } else {
    testFail('Missing financial health pillars on dashboard');
  }

  // Check expandable methodology section
  const toggleFound = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText.includes('Scoring Methodology'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (toggleFound) {
    testPass('Methodology disclosure is accessible via expandable toggle');
    await new Promise(r => setTimeout(r, 600));
    const methodologyVisible = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Savings Behavior (25%)') &&
             text.includes('Emergency Fund (15%)') &&
             text.includes('Deterministic Five-Pillar Scoring Rubric:');
    });
    if (methodologyVisible) {
      testPass('Methodology details and 5-pillar weights cleanly disclosed when expanded');
    } else {
      testFail('Methodology details not rendered upon expanding toggle');
    }
  } else {
    testFail('Methodology toggle button not found on dashboard');
  }

  console.log('\n--- 3. Fixed Deposit (FD) Rates & Multi-Tenure Verification ---');
  await page.goto('http://localhost:3000/fd', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await checkNoHorizontalOverflow('FD Page 1366px');

  // Verify October 2026 bank rate table
  const fdTableVerified = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasSBI = text.includes('State Bank of India') && text.includes('6.25%');
    const hasHDFC = text.includes('HDFC Bank') && text.includes('6.25%');
    const hasICICI = text.includes('ICICI Bank') && text.includes('6.25%');
    const hasRBL = text.includes('RBL Bank') && text.includes('7.40%');
    const hasDisclaimer = text.includes('October 2026') && text.includes('< ₹3 Crore');
    return { hasSBI, hasHDFC, hasICICI, hasRBL, hasDisclaimer };
  });

  if (fdTableVerified.hasSBI && fdTableVerified.hasHDFC && fdTableVerified.hasICICI && fdTableVerified.hasRBL) {
    testPass('Verified Oct 2026 bank rates displayed (SBI: 6.25%, HDFC: 6.25%, ICICI: 6.25%, RBL: 7.40%)');
  } else {
    testFail('Bank rate display mismatch', new Error(JSON.stringify(fdTableVerified)));
  }

  if (fdTableVerified.hasDisclaimer) {
    testPass('Official October 2026 date attribution and retail limit (< ₹3 Crore) clearly noted');
  } else {
    testFail('Official date attribution or deposit limit note missing on FD page');
  }

  // Test schedule toggle
  const scheduleToggleSuccess = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const scheduleBtn = buttons.find(b => b.innerText.includes('Full Tenure Schedules'));
    if (scheduleBtn) {
      scheduleBtn.click();
      return true;
    }
    return false;
  });
  if (scheduleToggleSuccess) {
    testPass('Toggled to "Full Tenure Schedules" view');
    await new Promise(r => setTimeout(r, 600));
    const schedulesVisible = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('full rate schedule') &&
             text.includes('10 years') &&
             text.includes('compounding');
    });
    if (schedulesVisible) {
      testPass('Full multi-tenure schedules and compounding notes rendered for all banks');
    } else {
      testFail('Full multi-tenure schedules missing expected tenure rows');
    }
  } else {
    testFail('Could not find "Full Tenure Schedules" toggle button');
  }

  await page.screenshot({ path: 'scratch/p19_fd_rate_comparison.png', fullPage: false });
  testPass('Captured FD rate comparison screenshot');

  console.log('\n--- 4. Chart Verification & Clearance Checks ---');
  await page.goto('http://localhost:3000/forecast', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await checkNoHorizontalOverflow('Forecast Page 1366px');

  // Verify Forecast chart ReferenceLine clearance against Y-axis ticks
  const chartGeometry = await page.evaluate(() => {
    const yTicks = Array.from(document.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick text'));
    const refText = Array.from(document.querySelectorAll('text')).find(t => t.textContent?.includes('Forecast →'));
    
    if (!refText || yTicks.length === 0) {
      return { found: false, count: yTicks.length, refFound: Boolean(refText) };
    }

    const refRect = refText.getBoundingClientRect();
    const tickRects = yTicks.map(t => {
      const r = t.getBoundingClientRect();
      return { text: t.textContent?.trim(), right: r.right, left: r.left, top: r.top, bottom: r.bottom };
    });

    const highestTick = tickRects[tickRects.length - 1]; // Top tick
    const clearance = refRect.left - highestTick.right;

    return {
      found: true,
      topTick: highestTick.text,
      topTickRight: highestTick.right,
      refLabelLeft: refRect.left,
      clearance: clearance,
      isOverlapping: clearance < 0
    };
  });

  if (chartGeometry.found) {
    if (!chartGeometry.isOverlapping && chartGeometry.clearance >= 15) {
      testPass(`Forecast chart: "${chartGeometry.topTick}" Y-axis tick has clean clearance (+${chartGeometry.clearance.toFixed(1)}px) from "Forecast →" label`);
    } else if (!chartGeometry.isOverlapping) {
      testPass(`Forecast chart: No overlap between Y-axis tick and "Forecast →" label (clearance: +${chartGeometry.clearance.toFixed(1)}px)`);
    } else {
      testFail('Forecast chart label overlap detected', new Error(`Clearance is negative: ${chartGeometry.clearance}px`));
    }
  } else {
    testFail('Could not find Forecast chart elements', new Error(JSON.stringify(chartGeometry)));
  }

  await page.screenshot({ path: 'scratch/p19_forecast_chart_verified.png', fullPage: false });
  testPass('Captured verified Forecast chart screenshot');

  await browser.close();

  console.log('\n====================================================');
  console.log(`Phase 19 Verification: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
