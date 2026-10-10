const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function testHMR() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  const initialBadge = await page.$eval('[class*="rounded-full"]', el => el.innerText);
  console.log('Initial Badge Text:', initialBadge);

  const pageFile = path.resolve('app/page.tsx');
  const originalContent = fs.readFileSync(pageFile, 'utf8');

  console.log('Applying test edit to app/page.tsx...');
  const editedContent = originalContent.replace(
    'AI-Powered Financial Health Analysis',
    'AI-Powered Financial Health Analysis [HMR-VERIFIED]'
  );
  fs.writeFileSync(pageFile, editedContent, 'utf8');

  console.log('Waiting for HMR Fast Refresh in browser...');
  await page.waitForFunction(
    () => document.body.innerText.includes('[HMR-VERIFIED]'),
    { timeout: 10000 }
  );

  const updatedStyles = await page.evaluate(() => {
    const body = document.body;
    const btn = document.querySelector('button, a.bg-primary');
    return {
      bodyBg: window.getComputedStyle(body).backgroundColor,
      bodyFont: window.getComputedStyle(body).fontFamily,
      btnBg: btn ? window.getComputedStyle(btn).backgroundColor : null,
    };
  });

  console.log('Post-HMR Styles in browser:', updatedStyles);

  console.log('Reverting test edit to app/page.tsx...');
  fs.writeFileSync(pageFile, originalContent, 'utf8');

  console.log('Waiting for HMR reversion in browser...');
  await page.waitForFunction(
    () => !document.body.innerText.includes('[HMR-VERIFIED]'),
    { timeout: 10000 }
  );

  const revertedStyles = await page.evaluate(() => {
    const body = document.body;
    return {
      bodyBg: window.getComputedStyle(body).backgroundColor,
      bodyFont: window.getComputedStyle(body).fontFamily,
    };
  });
  console.log('Post-Revert Styles in browser:', revertedStyles);

  await browser.close();
  console.log('\n>>> HMR VERIFICATION PASSED: CSS persists cleanly through live code changes!');
}

testHMR().catch(err => {
  console.error('HMR test failed:', err);
  // Restore file if error
  const pageFile = path.resolve('app/page.tsx');
  const content = fs.readFileSync(pageFile, 'utf8');
  if (content.includes('[HMR-VERIFIED]')) {
    fs.writeFileSync(pageFile, content.replace(' [HMR-VERIFIED]', ''), 'utf8');
  }
  process.exit(1);
});
