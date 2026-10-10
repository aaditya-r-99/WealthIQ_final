const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function testResearchLab() {
  console.log('================================================================');
  console.log('   WEALTHIQ: BROWSER VERIFICATION FOR /research-lab (PROMPT 3)  ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    userDataDir: '/tmp/brave_test_profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();

  try {
    // 1. Desktop Test (1280 x 800)
    console.log('--- TEST 1: DESKTOP VIEWPORT (1280 x 800) ---');
    await page.setViewport({ width: 1280, height: 800 });

    console.log('Step 1: Navigating to Dashboard to verify ML Archetype card label & link...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const mlBadge = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('span, div'));
      const found = badges.find(b => b.innerText && b.innerText.includes('Predefined-Centroid Model'));
      return found ? found.innerText.trim() : null;
    });
    console.log('Dashboard ML Badge found:', mlBadge);

    const researchLinkFound = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some(a => a.href.includes('/research-lab'));
    });
    console.log('Dashboard link to /research-lab found:', researchLinkFound);

    // Step 2: Navigate to /research-lab
    console.log('\nStep 2: Navigating to http://localhost:3000/research-lab...');
    await page.goto('http://localhost:3000/research-lab', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));

    const pageTitle = await page.$eval('h1', el => el.innerText).catch(() => '');
    console.log('Research Lab Page Title:', pageTitle);

    const bodyText = await page.evaluate(() => document.body.innerText);

    const checks = {
      titleCorrect: pageTitle.includes('India Financial Research Lab'),
      provenanceShown: bodyText.includes('IND_2024_FINDEX_v01_M') && bodyText.includes('2024'),
      sample3000: bodyText.includes('3,000') && bodyText.includes('2,989'),
      features46: bodyText.includes('46') && bodyText.includes('Zero leakage'),
      class1Correct: bodyText.includes('2,029') && (bodyText.includes('67.88%') || bodyText.includes('67.8822%')),
      class0Correct: bodyText.includes('960') && (bodyText.includes('32.12%') || bodyText.includes('32.1178%')),
      caveatPresent: bodyText.includes('Class 0 Does Not Imply Absolute Financial Security') || bodyText.includes('somewhat difficult'),
      winnerLabeled: bodyText.includes('Random Forest (Balanced)') && bodyText.includes('CV Winner'),
      cvScoresShown: bodyText.includes('0.6949') && bodyText.includes('0.7011'),
      testScoresShown: bodyText.includes('0.7007') && bodyText.includes('0.6690') && bodyText.includes('0.7405'),
      confusionMatrix: bodyText.includes('117') && bodyText.includes('75') && bodyText.includes('104') && bodyText.includes('302'),
      featuresShown: bodyText.includes('Respondent Age') || bodyText.includes('Income Quintile'),
      kmeansClusters: bodyText.includes('Silhouette Score: 0.1645') && bodyText.includes('Traditional Moderately Vulnerable'),
      clusterDistressRates: bodyText.includes('69.6%') && bodyText.includes('45.0%') && bodyText.includes('81.5%'),
      noRawMicrodata: !bodyText.includes('111154966') && !bodyText.includes('wpid_random'),
    };

    console.log('\n--- VERIFICATION CHECKLIST (DESKTOP) ---');
    for (const [k, v] of Object.entries(checks)) {
      console.log(`  ${v ? '✅' : '❌'} ${k}: ${v}`);
    }

    // 2. Mobile Viewport Test (375 x 667)
    console.log('\n--- TEST 2: MOBILE VIEWPORT (375 x 667 - iPhone SE) ---');
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const mobileTitle = await page.$eval('h1', el => el.innerText).catch(() => '');
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    console.log('Mobile Page Title:', mobileTitle);
    console.log('Mobile Horizontal Scroll Overflow:', hasHorizontalScroll ? 'WARNING (overflow detected)' : 'CLEAN (no overflow)');

    const allPassed = Object.values(checks).every(Boolean) && !hasHorizontalScroll && mobileTitle.includes('India Financial Research');
    console.log('\nOVERALL BROWSER TEST RESULT:', allPassed ? 'PASS' : 'FAIL');

  } catch (err) {
    console.error('Browser testing error:', err);
  } finally {
    await browser.close();
  }
}

testResearchLab();
