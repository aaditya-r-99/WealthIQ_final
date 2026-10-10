const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Load session if available
  if (fs.existsSync('/tmp/active_session_fresh.json')) {
    const sessionData = fs.readFileSync('/tmp/active_session_fresh.json', 'utf8');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.evaluate((tok) => {
      localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
    }, sessionData);
  }

  // 1. Dashboard expanded
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'scratch/before_dashboard_expanded.png' });

  // 2. Dashboard collapsed
  const collapseBtn = await page.$('button[aria-label="Collapse sidebar"]');
  if (collapseBtn) {
    await collapseBtn.click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: 'scratch/before_dashboard_collapsed.png' });
  }

  // 3. Forecast page
  await page.goto('http://localhost:3000/forecast', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'scratch/before_forecast_chart.png' });

  await browser.close();
  console.log('Screenshots captured successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
