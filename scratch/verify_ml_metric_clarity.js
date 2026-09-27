const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function runAudit() {
  console.log('================================================================');
  console.log(' WEALTHIQ — FINAL ML & METRIC CLARITY VERIFICATION AUDIT');
  console.log('================================================================\n');

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const audit = {
    dashboardOpened: false,
    mlCardTitleClarified: false,
    modelV1BadgeShown: false,
    topClassLikelihoodShown: false,
    mlPredictionExplanationClear: false,
    probabilitiesSum100: false,
    howMLWorksSectionWorks: false,
    featureBreakdownUnchanged: false,
    featureLegendUpdated: false,
    healthScoreCardUpdated: false,
    healthScoreExplanationUpdated: false,
    dynamicScoreCalculationWorks: false,
    monthlySavingsRateClarified: false,
    emergencyFundFormatUpdated: false,
    netWorthSubtitlesUpdated: false,
    mobileViewReadable: false,
    noRuntimeErrors: true,
  };

  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('Browser Console Error:', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    console.error('Browser Page Error:', err.message);
    audit.noRuntimeErrors = false;
  });

  try {
    const sessionData = fs.readFileSync('/tmp/active_session.json', 'utf8');

    // -----------------------------------------------------------------
    // DESKTOP VERIFICATION (1280 x 900)
    // -----------------------------------------------------------------
    console.log('>>> [1/2] DESKTOP VERIFICATION (1280x900)...');
    await page.setViewport({ width: 1280, height: 900 });

    // Set auth session in localStorage
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.evaluate((tok) => {
      localStorage.setItem('sb-wqbanwxdzarmpqmxfnmw-auth-token', tok);
    }, sessionData);

    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 3000));

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    if (currentUrl.includes('/dashboard')) {
      audit.dashboardOpened = true;
    }

    // 1. Check ML Title & Subtitle & Badge
    const mlTitleInfo = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('h3, div, p, span')).map((el) => el.innerText ? el.innerText.trim() : '');
      const hasMlTitle = titles.some((t) => t.includes('ML Financial Archetype'));
      const hasOldTitle = titles.some((t) => t.includes('AI Financial Health Assessment'));
      const hasExplainableSubtitle = document.body.innerText.includes('Explainable ML classifier using 10 financial features');
      const hasModelV1 = document.body.innerText.includes('Model v1.0');
      const hasOldBadge = Array.from(document.querySelectorAll('.badge, div, span')).some(
        (el) => el.innerText && el.innerText.trim() === 'v1.0-knn-archetype'
      );
      return { hasMlTitle, hasOldTitle, hasExplainableSubtitle, hasModelV1, hasOldBadge };
    });

    console.log('1. ML Title & Header:', mlTitleInfo);
    if (mlTitleInfo.hasMlTitle && !mlTitleInfo.hasOldTitle && mlTitleInfo.hasExplainableSubtitle) {
      audit.mlCardTitleClarified = true;
    }
    if (mlTitleInfo.hasModelV1 && !mlTitleInfo.hasOldBadge) {
      audit.modelV1BadgeShown = true;
    }

    // 2. Check Top Class Likelihood Wording
    const likelihoodInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasTopClass = bodyText.includes('Top Class Likelihood');
      const hasDisclaimer = bodyText.includes(
        "This is the model's highest calculated class likelihood among the five financial archetypes. It is not a probability of a future financial outcome."
      );
      const hasPredictionScope = bodyText.includes(
        'The model estimates which financial-health archetype most closely matches your CURRENT financial profile.'
      );
      const hasNoFuturePredict = bodyText.includes(
        'The model does not predict future income, future wealth, stock prices, market returns, or guaranteed financial outcomes.'
      );
      return { hasTopClass, hasDisclaimer, hasPredictionScope, hasNoFuturePredict };
    });

    console.log('2. Top Class Likelihood & Explanation:', likelihoodInfo);
    if (likelihoodInfo.hasTopClass && likelihoodInfo.hasDisclaimer) {
      audit.topClassLikelihoodShown = true;
    }
    if (likelihoodInfo.hasPredictionScope && likelihoodInfo.hasNoFuturePredict) {
      audit.mlPredictionExplanationClear = true;
    }

    // 3. Multi-Class Probability Distribution
    const probInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasTotal100 = bodyText.includes('Total: 100%');
      const hasArchetypeSelected = bodyText.includes(
        'The archetype with the highest class likelihood'
      );
      return { hasTotal100, hasArchetypeSelected };
    });
    console.log('3. Probability Distribution:', probInfo);
    if (probInfo.hasTotal100 && probInfo.hasArchetypeSelected) {
      audit.probabilitiesSum100 = true;
    }

    // 4. Test "How the ML model works" Expandable
    console.log('\n4. Testing "How the ML model works" expandable...');
    const clickedHowML = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('How the ML model works')
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clickedHowML) {
      await new Promise((r) => setTimeout(r, 800));

      const methodologyContent = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasPipeline = bodyText.includes('10 financial features are extracted');
        const hasEuclidean = bodyText.includes('d_k = √(Σ w_j(x_j − c_k,j)²)') || bodyText.includes('Weighted Euclidean Distance');
        const hasRbf = bodyText.includes('z_k = −γd_k') || bodyText.includes('RBF Transformation');
        const hasSoftmax = bodyText.includes('P(k) = exp(z_k) / Σ exp(z_m)') || bodyText.includes('Softmax Probability');
        const hasSystemRoles = bodyText.includes('Deterministic 0–100 rubric across 5 weighted pillars');
        const hasInternalId = bodyText.includes('v1.0-knn-archetype');
        return { hasPipeline, hasEuclidean, hasRbf, hasSoftmax, hasSystemRoles, hasInternalId };
      });

      console.log('Methodology Expandable Content:', methodologyContent);
      if (
        methodologyContent.hasPipeline &&
        methodologyContent.hasEuclidean &&
        methodologyContent.hasRbf &&
        methodologyContent.hasSoftmax &&
        methodologyContent.hasSystemRoles &&
        methodologyContent.hasInternalId
      ) {
        audit.howMLWorksSectionWorks = true;
      }
    }

    // 5. Test "View All 10 Model Features" Expandable
    console.log('\n5. Testing "View All 10 Model Features" expandable...');
    const clickedFeatures = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('View All 10 Model Features')
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clickedFeatures) {
      await new Promise((r) => setTimeout(r, 800));

      const featureBreakdownInfo = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasLegendRecorded = bodyText.includes('Recorded Value: Actual value from your financial records.');
        const hasLegendWeight = bodyText.includes('Weight: Predefined importance assigned to this feature in the current ML model.');
        const hasLegendNorm = bodyText.includes('Normalized: The feature converted to a comparable model scale.');
        const hasLegendImpact = bodyText.includes('Impact: Whether the feature contributes positively or negatively to the current profile classification.');
        const hasWeightNote = bodyText.includes('Feature weights are predefined parameters of the current model; they are not learned from a large real-world customer training dataset.');

        const tableText = document.querySelector('table')?.innerText || '';
        const hasSavingsRate18 = tableText.includes('18%');
        const hasExpenseRatio16 = tableText.includes('16%');
        const hasDti15 = tableText.includes('15%');
        const hasEmergency14 = tableText.includes('14%');
        const hasNetWorth12 = tableText.includes('12%');
        const hasInvestment8 = tableText.includes('8%');
        const hasFd5 = tableText.includes('5%');

        return {
          hasLegendRecorded,
          hasLegendWeight,
          hasLegendNorm,
          hasLegendImpact,
          hasWeightNote,
          hasSavingsRate18,
          hasExpenseRatio16,
          hasDti15,
          hasEmergency14,
          hasNetWorth12,
          hasInvestment8,
          hasFd5,
        };
      });

      console.log('Feature Breakdown Info:', featureBreakdownInfo);
      if (
        featureBreakdownInfo.hasLegendRecorded &&
        featureBreakdownInfo.hasLegendWeight &&
        featureBreakdownInfo.hasLegendNorm &&
        featureBreakdownInfo.hasLegendImpact &&
        featureBreakdownInfo.hasWeightNote
      ) {
        audit.featureLegendUpdated = true;
      }
      if (
        featureBreakdownInfo.hasSavingsRate18 &&
        featureBreakdownInfo.hasExpenseRatio16 &&
        featureBreakdownInfo.hasDti15 &&
        featureBreakdownInfo.hasEmergency14 &&
        featureBreakdownInfo.hasNetWorth12
      ) {
        audit.featureBreakdownUnchanged = true;
      }
    }

    // 6. Test MetricCards in Dashboard
    console.log('\n6. Checking Metric Cards (Monthly Savings Rate, Net Worth, Ratios, Emergency Fund)...');
    const metricCardsInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Monthly Savings Rate
      const hasMonthlySavingsRate = bodyText.includes('Monthly Savings Rate');
      const hasSavingsRateSubtitle = bodyText.includes('Based on income minus recorded expenses.');

      // Net Worth
      const hasNetWorthSubtitle = bodyText.includes('Total assets minus outstanding debt');

      // Expense Ratio & DTI
      const hasExpenseRatioSubtitle = bodyText.includes('Recorded monthly expenses / monthly income');
      const hasDtiSubtitle = bodyText.includes('Monthly EMI / monthly income');

      // Emergency Fund
      const hasEmergencyFundMonths = bodyText.includes('months') || bodyText.includes('< 1 month');
      const hasZeroPointOneMonth = bodyText.includes('0.1 months') || bodyText.includes('0.0 months');

      return {
        hasMonthlySavingsRate,
        hasSavingsRateSubtitle,
        hasNetWorthSubtitle,
        hasExpenseRatioSubtitle,
        hasDtiSubtitle,
        hasEmergencyFundMonths,
        hasZeroPointOneMonth,
      };
    });

    console.log('Metric Cards Info:', metricCardsInfo);
    if (metricCardsInfo.hasMonthlySavingsRate && metricCardsInfo.hasSavingsRateSubtitle) {
      audit.monthlySavingsRateClarified = true;
    }
    if (metricCardsInfo.hasNetWorthSubtitle && metricCardsInfo.hasExpenseRatioSubtitle && metricCardsInfo.hasDtiSubtitle) {
      audit.netWorthSubtitlesUpdated = true;
    }
    if (metricCardsInfo.hasEmergencyFundMonths && !metricCardsInfo.hasZeroPointOneMonth) {
      audit.emergencyFundFormatUpdated = true;
    }

    // 7. Check Health Score Card & Explanation
    console.log('\n7. Checking Health Score Section...');
    const healthScoreInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasCleanDescription = bodyText.includes(
        'Transparent 0–100 score based on five weighted financial pillars and predefined benchmarks.'
      );
      const hasOldIncomeStability = bodyText.includes('and income stability');
      const hasExactTitle = bodyText.includes(
        'How Your Health Score Is Calculated (Deterministic Rule-Based Score)'
      );

      // Check the 5 pillars
      const hasSavingsPillar = bodyText.includes('Savings Behavior') && bodyText.includes('Weight: 25%');
      const hasExpensePillar = bodyText.includes('Expense Burden') && bodyText.includes('Weight: 25%');
      const hasDebtPillar = bodyText.includes('Debt Burden') && bodyText.includes('Weight: 20%');
      const hasEmergencyPillar = bodyText.includes('Emergency Fund') && bodyText.includes('Weight: 15%');
      const hasInvestmentPillar = bodyText.includes('Investments & Assets') && bodyText.includes('Weight: 15%');

      return {
        hasCleanDescription,
        hasOldIncomeStability,
        hasExactTitle,
        hasSavingsPillar,
        hasExpensePillar,
        hasDebtPillar,
        hasEmergencyPillar,
        hasInvestmentPillar,
      };
    });

    console.log('Health Score Info:', healthScoreInfo);
    if (healthScoreInfo.hasCleanDescription && !healthScoreInfo.hasOldIncomeStability) {
      audit.healthScoreCardUpdated = true;
    }
    if (
      healthScoreInfo.hasExactTitle &&
      healthScoreInfo.hasSavingsPillar &&
      healthScoreInfo.hasExpensePillar &&
      healthScoreInfo.hasDebtPillar &&
      healthScoreInfo.hasEmergencyPillar &&
      healthScoreInfo.hasInvestmentPillar
    ) {
      audit.healthScoreExplanationUpdated = true;
    }

    // 8. Test Dynamic Example Calculation Expandable
    console.log('\n8. Testing Dynamic Example Calculation...');
    const clickedExampleCalc = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('Example calculation')
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clickedExampleCalc) {
      await new Promise((r) => setTimeout(r, 800));

      const calcBreakdownText = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasDynamicHeading = bodyText.includes('Dynamic Calculation from Your Current Pillar Scores:');
        const hasSavingsCalc = bodyText.includes('Savings:') && bodyText.includes('× 25% =');
        const hasExpenseCalc = bodyText.includes('Expense:') && bodyText.includes('× 25% =');
        const hasDebtCalc = bodyText.includes('Debt:') && bodyText.includes('× 20% =');
        const hasEmergencyCalc = bodyText.includes('Emergency Fund:') && bodyText.includes('× 15% =');
        const hasInvestmentCalc = bodyText.includes('Investments:') && bodyText.includes('× 15% =');
        const hasTotalSum = bodyText.includes('Total:');
        const hasTherefore = bodyText.includes('Therefore:') && bodyText.includes('Financial Health Score =');

        return {
          hasDynamicHeading,
          hasSavingsCalc,
          hasExpenseCalc,
          hasDebtCalc,
          hasEmergencyCalc,
          hasInvestmentCalc,
          hasTotalSum,
          hasTherefore,
        };
      });

      console.log('Dynamic Calculation Breakdown:', calcBreakdownText);
      if (
        calcBreakdownText.hasDynamicHeading &&
        calcBreakdownText.hasSavingsCalc &&
        calcBreakdownText.hasExpenseCalc &&
        calcBreakdownText.hasDebtCalc &&
        calcBreakdownText.hasEmergencyCalc &&
        calcBreakdownText.hasInvestmentCalc &&
        calcBreakdownText.hasTotalSum &&
        calcBreakdownText.hasTherefore
      ) {
        audit.dynamicScoreCalculationWorks = true;
      }
    }

    // Take Desktop Screenshot
    const desktopScreenshotPath = path.join(screenshotsDir, 'desktop_dashboard.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    console.log('\nDesktop screenshot saved to:', desktopScreenshotPath);

    // -----------------------------------------------------------------
    // MOBILE VERIFICATION (375 x 812)
    // -----------------------------------------------------------------
    console.log('\n>>> [2/2] MOBILE VERIFICATION (375x812)...');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    // Open Feature details on mobile to verify stacked cards
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('View All 10 Model Features')
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const mobileCheck = await page.evaluate(() => {
      const mobileCards = document.querySelectorAll('.block.md\\:hidden .rounded-lg.border');
      const isScrollXOverflowing = document.documentElement.scrollWidth > window.innerWidth;
      return {
        mobileCardCount: mobileCards.length,
        isScrollXOverflowing,
      };
    });

    console.log('Mobile Check:', mobileCheck);
    if (mobileCheck.mobileCardCount >= 10 && !mobileCheck.isScrollXOverflowing) {
      audit.mobileViewReadable = true;
    }

    // Take Mobile Screenshot
    const mobileScreenshotPath = path.join(screenshotsDir, 'mobile_dashboard.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    console.log('Mobile screenshot saved to:', mobileScreenshotPath);

  } catch (err) {
    console.error('Audit exception:', err);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('                    AUDIT RESULTS SUMMARY                       ');
  console.log('================================================================');
  console.log(JSON.stringify(audit, null, 2));

  const allPassed = Object.values(audit).every((v) => v === true);
  console.log('\nOVERALL RESULT:', allPassed ? 'ALL AUDIT CHECKS PASSED ✅' : 'SOME CHECKS FAILED ❌');
}

runAudit();
