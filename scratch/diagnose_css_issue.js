const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function testBrowser() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const failedRequests = [];
  const consoleMessages = [];

  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure() ? req.failure().errorText : 'unknown',
    });
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push({
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
      });
    }
  });

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  await page.screenshot({ path: 'scratch/current_page_state.png' });
  console.log('Saved screenshot to scratch/current_page_state.png');

  const computedStyles = await page.evaluate(() => {
    const body = document.querySelector('body');
    const h1 = document.querySelector('h1');
    const firstButton = document.querySelector('button, a.bg-primary');
    return {
      bodyBg: body ? window.getComputedStyle(body).backgroundColor : null,
      bodyFont: body ? window.getComputedStyle(body).fontFamily : null,
      h1FontSize: h1 ? window.getComputedStyle(h1).fontSize : null,
      h1Color: h1 ? window.getComputedStyle(h1).color : null,
      buttonBg: firstButton ? window.getComputedStyle(firstButton).backgroundColor : null,
      linksCount: document.querySelectorAll('link[rel="stylesheet"]').length,
      stylesheetsCount: document.styleSheets.length,
    };
  });

  console.log('\n--- Computed Styles in Browser ---');
  console.log(JSON.stringify(computedStyles, null, 2));

  console.log('\n--- Failed Network Requests (' + failedRequests.length + ') ---');
  failedRequests.forEach((r) => console.log(JSON.stringify(r)));

  console.log('\n--- Browser Console Messages (' + consoleMessages.length + ') ---');
  consoleMessages.forEach((m) => console.log(`[${m.type}] ${m.text}`));

  await browser.close();
}

testBrowser().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
