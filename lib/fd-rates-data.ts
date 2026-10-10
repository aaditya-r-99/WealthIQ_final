// ============================================================
// WealthIQ Official Fixed Deposit Rate Repository
// Phase 19 — Verified Indian Bank Rate Configuration (October 2026)
// Sources: Official bank portals for Retail Deposits (< ₹3 Crore)
// ============================================================

export interface BankTenureBucket {
  tenureLabel: string;
  minMonths: number;
  maxMonths: number;
  regularRate: number;
  seniorRate: number;
}

export interface VerifiedBankFDProfile {
  bankId: string;
  bankName: string;
  shortName: string;
  depositClassification: string; // Retail (< ₹3 Crore)
  twelveMonthRegularRate: number;
  twelveMonthSeniorRate: number;
  minimumDepositAmount: number;
  compoundingFrequency: string;
  prematureWithdrawalPolicy: string;
  effectiveDate: string;
  officialSourceUrl: string;
  isVerified: boolean;
  tenureBuckets: BankTenureBucket[];
}

export const VERIFIED_OCT_2026_FD_PROFILES: VerifiedBankFDProfile[] = [
  {
    bankId: 'sbi',
    bankName: 'State Bank of India (SBI)',
    shortName: 'SBI',
    depositClassification: 'Retail Domestic Term Deposits (< ₹3 Crore)',
    twelveMonthRegularRate: 6.25,
    twelveMonthSeniorRate: 6.75,
    minimumDepositAmount: 1000,
    compoundingFrequency: 'Quarterly compounding on cumulative reinvestment deposits',
    prematureWithdrawalPolicy: '0.50% penalty up to ₹5L; 1.00% penalty above ₹5L on applicable card rate',
    effectiveDate: '2025-12-15 (Current in October 2026)',
    officialSourceUrl: 'https://sbi.bank.in/web/interest-rates/deposit-rates/retail-domestic-term-deposits',
    isVerified: true,
    tenureBuckets: [
      { tenureLabel: '7 days to 45 days', minMonths: 0, maxMonths: 1.5, regularRate: 3.05, seniorRate: 3.55 },
      { tenureLabel: '46 days to 179 days', minMonths: 1.5, maxMonths: 5.9, regularRate: 4.90, seniorRate: 5.40 },
      { tenureLabel: '180 days to 210 days', minMonths: 6, maxMonths: 7, regularRate: 5.65, seniorRate: 6.15 },
      { tenureLabel: '211 days to < 1 year', minMonths: 7.1, maxMonths: 11.9, regularRate: 5.90, seniorRate: 6.40 },
      { tenureLabel: '1 Year to < 2 years', minMonths: 12, maxMonths: 23.9, regularRate: 6.25, seniorRate: 6.75 },
      { tenureLabel: '2 years to < 3 years', minMonths: 24, maxMonths: 35.9, regularRate: 6.40, seniorRate: 6.90 },
      { tenureLabel: '3 years to < 5 years', minMonths: 36, maxMonths: 59.9, regularRate: 6.30, seniorRate: 6.80 },
      { tenureLabel: '5 years and up to 10 years', minMonths: 60, maxMonths: 120, regularRate: 6.05, seniorRate: 7.05 },
    ],
  },
  {
    bankId: 'hdfc',
    bankName: 'HDFC Bank',
    shortName: 'HDFC',
    depositClassification: 'Domestic / NRO / NRE Fixed Deposits (< ₹3 Crore)',
    twelveMonthRegularRate: 6.25,
    twelveMonthSeniorRate: 6.75,
    minimumDepositAmount: 5000,
    compoundingFrequency: 'Quarterly compounding for cumulative deposits (simple interest < 6 months)',
    prematureWithdrawalPolicy: '1.00% penalty on applicable rate. Senior citizen benefit applies to domestic deposits.',
    effectiveDate: '2026-08-19 (Current in October 2026)',
    officialSourceUrl: 'https://www.hdfc.bank.in/fixed-deposit/fd-interest-rate',
    isVerified: true,
    tenureBuckets: [
      { tenureLabel: '7 to 29 days', minMonths: 0, maxMonths: 0.9, regularRate: 2.75, seniorRate: 3.25 },
      { tenureLabel: '30 to 45 days', minMonths: 1, maxMonths: 1.5, regularRate: 3.25, seniorRate: 3.75 },
      { tenureLabel: '46 days to <= 6 months', minMonths: 1.6, maxMonths: 6, regularRate: 4.25, seniorRate: 4.75 },
      { tenureLabel: '6 months 1 day to <= 9 months', minMonths: 6.1, maxMonths: 9, regularRate: 5.50, seniorRate: 6.00 },
      { tenureLabel: '9 months 1 day to < 1 Year', minMonths: 9.1, maxMonths: 11.9, regularRate: 5.75, seniorRate: 6.25 },
      { tenureLabel: '1 Year to < 15 months', minMonths: 12, maxMonths: 14.9, regularRate: 6.25, seniorRate: 6.75 },
      { tenureLabel: '15 months to < 18 months', minMonths: 15, maxMonths: 17.9, regularRate: 6.35, seniorRate: 6.85 },
      { tenureLabel: '18 months to 2 years', minMonths: 18, maxMonths: 24, regularRate: 6.45, seniorRate: 6.95 },
      { tenureLabel: '2 Years 1 day to <= 3 Years', minMonths: 24.1, maxMonths: 36, regularRate: 6.45, seniorRate: 6.95 },
      { tenureLabel: '3 Years 1 day to < 5 Years', minMonths: 36.1, maxMonths: 59.9, regularRate: 6.50, seniorRate: 7.10 },
      { tenureLabel: '5 Years 1 day to 10 Years', minMonths: 60, maxMonths: 120, regularRate: 6.15, seniorRate: 6.65 },
    ],
  },
  {
    bankId: 'icici',
    bankName: 'ICICI Bank',
    shortName: 'ICICI',
    depositClassification: 'Domestic Term Deposits with premature withdrawal (< ₹3 Crore)',
    twelveMonthRegularRate: 6.25,
    twelveMonthSeniorRate: 6.75,
    minimumDepositAmount: 10000,
    compoundingFrequency: 'Quarterly compounding on reinvestment deposits; monthly/quarterly payout available',
    prematureWithdrawalPolicy: '0.50% penalty for < 1 year; 1.00% penalty for >= 1 year on contracted rate',
    effectiveDate: '2026-10-09 (Current in October 2026)',
    officialSourceUrl: 'https://www.icici.bank.in/personal-banking/deposits/fixed-deposit/fd-interest-rates',
    isVerified: true,
    tenureBuckets: [
      { tenureLabel: '7 to 29 Days', minMonths: 0, maxMonths: 0.9, regularRate: 3.50, seniorRate: 3.50 },
      { tenureLabel: '30 to 45 Days', minMonths: 1, maxMonths: 1.5, regularRate: 4.25, seniorRate: 4.25 },
      { tenureLabel: '46 to 60 Days', minMonths: 1.6, maxMonths: 2, regularRate: 4.50, seniorRate: 4.50 },
      { tenureLabel: '61 to 90 Days', minMonths: 2.1, maxMonths: 3, regularRate: 4.75, seniorRate: 4.75 },
      { tenureLabel: '91 to 184 Days', minMonths: 3.1, maxMonths: 6, regularRate: 5.25, seniorRate: 5.25 },
      { tenureLabel: '185 to 270 Days', minMonths: 6.1, maxMonths: 9, regularRate: 5.50, seniorRate: 6.00 },
      { tenureLabel: '271 Days to < 1 Year', minMonths: 9.1, maxMonths: 11.9, regularRate: 5.50, seniorRate: 6.00 },
      { tenureLabel: '1 Year to 389 Days', minMonths: 12, maxMonths: 12.9, regularRate: 6.25, seniorRate: 6.75 },
      { tenureLabel: '390 Days to < 18 Months', minMonths: 13, maxMonths: 17.9, regularRate: 6.25, seniorRate: 6.75 },
      { tenureLabel: '18 Months to 2 Years', minMonths: 18, maxMonths: 24, regularRate: 6.30, seniorRate: 6.80 },
      { tenureLabel: '2 Years 1 Day to 3 Years', minMonths: 24.1, maxMonths: 36, regularRate: 6.45, seniorRate: 6.95 },
      { tenureLabel: '3 Years 1 Day to 5 Years', minMonths: 36.1, maxMonths: 59.9, regularRate: 6.50, seniorRate: 7.10 },
      { tenureLabel: '5 Years 1 Day to 10 Years', minMonths: 60, maxMonths: 120, regularRate: 6.50, seniorRate: 7.00 },
    ],
  },
  {
    bankId: 'rbl',
    bankName: 'RBL Bank',
    shortName: 'RBL',
    depositClassification: 'Domestic Fixed Deposits (< ₹3 Crore)',
    twelveMonthRegularRate: 7.40,
    twelveMonthSeniorRate: 8.00,
    minimumDepositAmount: 1000,
    compoundingFrequency: 'Quarterly compounding for >= 181 days; simple interest at maturity for < 181 days',
    prematureWithdrawalPolicy: '1.00% penalty on applicable rate. Senior citizens (+0.50%) and Super Senior (+0.75%) applicable.',
    effectiveDate: '2026-10-01 (Current in October 2026)',
    officialSourceUrl: 'https://www.rbl.bank.in/interest-rates?tab=fixed-deposit',
    isVerified: true,
    tenureBuckets: [
      { tenureLabel: '7 to 14 days', minMonths: 0, maxMonths: 0.5, regularRate: 3.50, seniorRate: 4.00 },
      { tenureLabel: '15 to 45 days', minMonths: 0.6, maxMonths: 1.5, regularRate: 4.00, seniorRate: 4.50 },
      { tenureLabel: '46 to 90 days', minMonths: 1.6, maxMonths: 3, regularRate: 4.50, seniorRate: 5.00 },
      { tenureLabel: '91 to 180 days', minMonths: 3.1, maxMonths: 6, regularRate: 5.00, seniorRate: 5.50 },
      { tenureLabel: '181 to 364 days', minMonths: 6.1, maxMonths: 11.9, regularRate: 6.00, seniorRate: 6.50 },
      { tenureLabel: '365 to 452 days (12 Months)', minMonths: 12, maxMonths: 14.9, regularRate: 7.40, seniorRate: 8.00 },
      { tenureLabel: '453 to 724 days (~15-24M)', minMonths: 15, maxMonths: 24, regularRate: 7.50, seniorRate: 8.00 },
      { tenureLabel: '24 months to < 36 months', minMonths: 24.1, maxMonths: 35.9, regularRate: 7.20, seniorRate: 7.70 },
      { tenureLabel: '36 months to < 60 months', minMonths: 36, maxMonths: 59.9, regularRate: 6.80, seniorRate: 7.30 },
      { tenureLabel: '60 months to 120 months', minMonths: 60, maxMonths: 120, regularRate: 6.50, seniorRate: 7.00 },
    ],
  },
];

/**
 * Lookup verified card rate for a given bank, tenure in months, and senior citizen status.
 * Returns null if the bank is "Other Bank" or unverified.
 */
export function lookupVerifiedFDRate(
  bankName: string,
  tenureMonths: number,
  isSeniorCitizen: boolean
): { rate: number; bucketLabel: string; effectiveDate: string; sourceUrl: string } | null {
  const normName = bankName.trim().toLowerCase();
  const profile = VERIFIED_OCT_2026_FD_PROFILES.find(
    (p) =>
      p.shortName.toLowerCase() === normName ||
      p.bankName.toLowerCase().includes(normName) ||
      normName.includes(p.shortName.toLowerCase())
  );

  if (!profile) return null;

  // Find corresponding tenure bucket
  const bucket = profile.tenureBuckets.find(
    (b) => tenureMonths >= b.minMonths && tenureMonths <= b.maxMonths
  ) || profile.tenureBuckets.find((b) => b.minMonths <= tenureMonths) || profile.tenureBuckets[profile.tenureBuckets.length - 1];

  const rate = isSeniorCitizen ? bucket.seniorRate : bucket.regularRate;

  return {
    rate,
    bucketLabel: bucket.tenureLabel,
    effectiveDate: profile.effectiveDate,
    sourceUrl: profile.officialSourceUrl,
  };
}
