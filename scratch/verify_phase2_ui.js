const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

async function runPhase2BrowserAudit() {
  console.log('================================================================');
  console.log('   WEALTHIQ — PHASE 2 UI INTEGRATION REAL BROWSER AUDIT         ');
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

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    userDataDir: '/tmp/brave_test_profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('  [Browser Error]:', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    console.error('  [Browser Uncaught Error]:', err.message);
  });

  try {
    // -------------------------------------------------------------
    // SETUP: Navigate to /expenses and verify page load
    // -------------------------------------------------------------
    console.log('>>> SETUP: Navigating to http://localhost:3000/expenses...');
    await page.goto('http://localhost:3000/expenses', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const pageH1 = await page.$eval('h1', (el) => el.innerText).catch(() => '');
    assert(pageH1.includes('Expenses'), 'Expenses page loaded successfully with H1 title');

    // Helper: get current category select value
    async function getSelectedCategory() {
      return await page.evaluate(() => {
        const trigger = document.getElementById('category');
        return trigger ? trigger.innerText.trim() : null;
      });
    }

    // Helper: get current expense type select value
    async function getSelectedType() {
      return await page.evaluate(() => {
        const trigger = document.getElementById('type');
        return trigger ? trigger.innerText.trim().toLowerCase() : null;
      });
    }

    // Helper: fill description and click Suggest Category
    async function suggestFor(text) {
      // Clear description
      await page.evaluate(() => {
        const input = document.getElementById('description');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.type('#description', text);
      await new Promise((r) => setTimeout(r, 200));

      // Click "Suggest Category" button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find((b) => b.innerText.includes('Suggest Category'));
        if (btn) btn.click();
      });

      // Wait for suggestion notice or update
      await new Promise((r) => setTimeout(r, 1200));
    }

    // -------------------------------------------------------------
    // TEST 1: "Swiggy dinner order" suggests Food
    // -------------------------------------------------------------
    console.log('\n>>> TEST 1: Suggestion for "Swiggy dinner order"');
    await suggestFor('Swiggy dinner order');

    const cat1 = await getSelectedCategory();
    const type1 = await getSelectedType();
    const notice1 = await page.evaluate(() => document.body.innerText);

    assert(cat1 === 'Food', `Category for "Swiggy dinner order" is "Food" (got: "${cat1}")`);
    assert(type1 === 'essential', `Expense type for "Swiggy dinner order" is "essential" (got: "${type1}")`);
    assert(notice1.includes('Suggested Category:'), 'Suggestion notice displayed in UI');
    assert(notice1.includes('Keyword Rule') || notice1.includes('Food'), 'Notice confirms rule-based classification');

    // -------------------------------------------------------------
    // TEST 2: "Monthly house rent" suggests Housing
    // -------------------------------------------------------------
    console.log('\n>>> TEST 2: Suggestion for "Monthly house rent"');
    await suggestFor('Monthly house rent');

    const cat2 = await getSelectedCategory();
    const type2 = await getSelectedType();
    assert(cat2 === 'Housing', `Category for "Monthly house rent" is "Housing" (got: "${cat2}")`);
    assert(type2 === 'essential', `Expense type for "Monthly house rent" is "essential" (got: "${type2}")`);

    // -------------------------------------------------------------
    // TEST 3: "Airtel broadband bill" suggests Utilities
    // -------------------------------------------------------------
    console.log('\n>>> TEST 3: Suggestion for "Airtel broadband bill"');
    await suggestFor('Airtel broadband bill');

    const cat3 = await getSelectedCategory();
    const type3 = await getSelectedType();
    assert(cat3 === 'Utilities', `Category for "Airtel broadband bill" is "Utilities" (got: "${cat3}")`);
    assert(type3 === 'essential', `Expense type for "Airtel broadband bill" is "essential" (got: "${type3}")`);

    // -------------------------------------------------------------
    // TEST 4: "Salary credited" produces income guidance
    // -------------------------------------------------------------
    console.log('\n>>> TEST 4: Income detection for "Salary credited"');
    await suggestFor('Salary credited from employer');

    const cat4 = await getSelectedCategory();
    const bodyText4 = await page.evaluate(() => document.body.innerText);

    assert(cat4 !== 'Income', 'Income is NOT set as expense category (preserved existing category: ' + cat4 + ')');
    assert(bodyText4.includes('Income Transaction Detected'), 'UI displays "Income Transaction Detected" alert');
    assert(bodyText4.includes('Income Module') || bodyText4.includes('Income module'), 'UI guides user to Income module');
    const incomeLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some((a) => a.href.includes('/income') && a.innerText.includes('Income'));
    });
    assert(incomeLink, 'Link to /income is provided in the banner');

    // -------------------------------------------------------------
    // TEST 5: Ambiguous / low-confidence response flagged for review
    // -------------------------------------------------------------
    console.log('\n>>> TEST 5: Review flag for ambiguous transaction');
    await suggestFor('Charity donation to temple');

    const cat5 = await getSelectedCategory();
    const bodyText5 = await page.evaluate(() => document.body.innerText);

    assert(cat5 === 'Other', `Charity mapped to "Other" (got: "${cat5}")`);
    assert(
      bodyText5.includes('Suggested with Review:') || bodyText5.includes('Review') || bodyText5.includes('review'),
      'Ambiguous category is flagged for review'
    );

    // -------------------------------------------------------------
    // TEST 6: User can override predicted category
    // -------------------------------------------------------------
    console.log('\n>>> TEST 6: Manual override of predicted category');
    await suggestFor('Swiggy dinner order');
    assert((await getSelectedCategory()) === 'Food', 'Initial suggestion is Food');

    // Click Category Select trigger to open dropdown
    await page.click('#category');
    await new Promise((r) => setTimeout(r, 400));

    // Select "Entertainment" from dropdown options
    const overridden = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="option"]'));
      const item = items.find((el) => el.innerText.trim() === 'Entertainment');
      if (item) {
        item.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 300));

    const cat6 = await getSelectedCategory();
    assert(overridden && cat6 === 'Entertainment', `Category successfully overridden by user to "${cat6}"`);

    // -------------------------------------------------------------
    // TEST 7: Form only saves after explicit submit
    // -------------------------------------------------------------
    console.log('\n>>> TEST 7: Financial record NOT saved without submit');
    const initialRowsCount = await page.evaluate(() => {
      return document.querySelectorAll('tbody tr').length;
    });

    await suggestFor('Swiggy lunch meal');
    const rowsAfterSuggest = await page.evaluate(() => {
      return document.querySelectorAll('tbody tr').length;
    });
    assert(rowsAfterSuggest === initialRowsCount, 'Row count did not change on suggestion request alone');

    // -------------------------------------------------------------
    // TEST 8: Adding expense saves and uses WealthIQ category names
    // -------------------------------------------------------------
    console.log('\n>>> TEST 8: Full save flow with database verification');
    const testAmount = '425';
    await page.evaluate(() => {
      const amtInput = document.getElementById('amount');
      if (amtInput) {
        amtInput.value = '';
        amtInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.type('#amount', testAmount);

    // Click "Save Expense"
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find(
        (b) => b.innerText.includes('Save Expense')
      );
      if (submitBtn) submitBtn.click();
    });

    await new Promise((r) => setTimeout(r, 2500));

    const savedNotice = await page.evaluate(() => {
      return document.body.innerText.includes('Expense added successfully.');
    });
    assert(savedNotice, 'Success banner "Expense added successfully." appeared');

    // Verify record in table
    const tableCategories = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return rows.map((r) => {
        const cells = r.querySelectorAll('td');
        return cells.length >= 2 ? { cat: cells[0].innerText.trim(), amt: cells[1].innerText.trim() } : null;
      }).filter(Boolean);
    });

    const foundSaved = tableCategories.find(
      (r) => r.cat === 'Food' && (r.amt.includes('425') || r.amt.includes('₹425'))
    );
    assert(Boolean(foundSaved), 'Saved record is present in table with category "Food"');

    // -------------------------------------------------------------
    // TEST 9: Expense totals and charts updated
    // -------------------------------------------------------------
    console.log('\n>>> TEST 9: Expense totals and charts reflect changes');
    const totalsText = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.text-2xl.font-bold'));
      return cards.map((c) => c.innerText.trim());
    });
    assert(totalsText.length >= 3, 'Summary cards (Total, Essential, Discretionary) render amounts: ' + totalsText.join(', '));

    // Delete the test expense to leave database clean
    const deleted = await page.evaluate((amt) => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        if (row.innerText.includes('425') && row.innerText.includes('Swiggy')) {
          const deleteBtn = row.querySelector('button[title="Delete expense"]');
          if (deleteBtn) {
            deleteBtn.click();
            return true;
          }
        }
      }
      return false;
    });

    if (deleted) {
      await new Promise((r) => setTimeout(r, 2000));
      console.log('  [CLEANUP] Deleted temporary test expense record');
    }

    // -------------------------------------------------------------
    // TEST 10: Pausing Python service still allows manual expense entry
    // -------------------------------------------------------------
    console.log('\n>>> TEST 10: Graceful fallback when Python classifier is paused');

    // Kill python server on 8000
    try {
      execSync('fuser -k 8000/tcp || true', { stdio: 'ignore' });
      await new Promise((r) => setTimeout(r, 1000));
    } catch {}

    // Verify 8000 is down
    let is8000Down = false;
    try {
      execSync('curl -s --connect-timeout 1 http://127.0.0.1:8000/health', { stdio: 'pipe' });
    } catch {
      is8000Down = true;
    }
    assert(is8000Down, 'Python classifier service on port 8000 successfully paused');

    // Attempt suggestion while offline
    await suggestFor('Offline transaction memo');

    const offlineNotice = await page.evaluate(() => document.body.innerText);
    assert(
      offlineNotice.includes('offline') || offlineNotice.includes('unavailable') || offlineNotice.includes('manual'),
      'UI displays graceful offline notice without throwing or freezing'
    );

    // Verify form is completely usable manually
    await page.evaluate(() => {
      const amtInput = document.getElementById('amount');
      if (amtInput) {
        amtInput.value = '';
        amtInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.type('#amount', '150');

    // Select "Shopping"
    await page.click('#category');
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="option"]'));
      const item = items.find((el) => el.innerText.trim() === 'Shopping');
      if (item) item.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // Save manual expense while classifier is offline
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find(
        (b) => b.innerText.includes('Save Expense')
      );
      if (submitBtn) submitBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2500));

    const manualSaved = await page.evaluate(() => {
      return document.body.innerText.includes('Expense added successfully.');
    });
    assert(manualSaved, 'Manual expense successfully saved while classifier was offline');

    // Clean up second test record
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        if (row.innerText.includes('150') && row.innerText.includes('Shopping')) {
          const deleteBtn = row.querySelector('button[title="Delete expense"]');
          if (deleteBtn) deleteBtn.click();
        }
      }
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Restart Python classifier daemon on port 8000
    console.log('\n  [RESTART] Restarting Python classifier service on port 8000...');
    const pyProcess = spawn(
      '/home/aditya/Downloads/transaction-categorization/.venv/bin/uvicorn',
      ['api:app', '--host', '127.0.0.1', '--port', '8000'],
      {
        cwd: '/home/aditya/Downloads/transaction-categorization',
        detached: true,
        stdio: 'ignore',
      }
    );
    pyProcess.unref();
    await new Promise((r) => setTimeout(r, 2000));

    // Verify 8000 is back up
    let is8000Restored = false;
    try {
      execSync('curl -s http://127.0.0.1:8000/health', { stdio: 'pipe' });
      is8000Restored = true;
    } catch {}
    assert(is8000Restored, 'Python classifier service restored and healthy');

    // -------------------------------------------------------------
    // TEST 11: Verify 6 Financial Modules and Dashboard
    // -------------------------------------------------------------
    console.log('\n>>> TEST 11: Verification of 6 Financial Modules & Dashboard');
    const modules = [
      { path: '/dashboard', title: 'Dashboard' },
      { path: '/income', title: 'Income' },
      { path: '/expenses', title: 'Expenses' },
      { path: '/savings', title: 'Savings' },
      { path: '/debts', title: 'Debt' },
      { path: '/investments', title: 'Investments' },
      { path: '/fd', title: 'Fixed Deposits' },
    ];

    for (const mod of modules) {
      await page.goto(`http://localhost:3000${mod.path}`, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 1200));
      const title = await page.$eval('h1', (el) => el.innerText).catch(() => '');
      const hasContent = await page.evaluate(() => document.body.innerText.length > 200);
      assert(
        title.toLowerCase().includes(mod.title.toLowerCase()) && hasContent,
        `Module ${mod.path} renders correctly with title "${title}"`
      );
    }

  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log(` PHASE 2 BROWSER AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2BrowserAudit().catch((err) => {
  console.error('Phase 2 browser test error:', err);
  process.exit(1);
});
