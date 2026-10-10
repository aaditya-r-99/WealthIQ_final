# WealthIQ — Phase 10: Offline Next-Month Expense Forecasting Benchmark Report

## 1. Executive Summary

Phase 10 implemented and evaluated an offline, chronological walk-forward benchmarking experiment comparing 4 baseline forecasters and 2 candidate ML/statistical models across 7 controlled personal expenditure scenarios (36 monthly periods, 24 held-out evaluation folds each, totaling 1,008 walk-forward predictions).

### Key Takeaway
- **The 3-Month Simple Moving Average (3M SMA) and 6-Month EWMA are remarkably strong baselines**: 3M SMA beat the Naive baseline in 100% of scenarios (7/7) and outperformed Ridge Regression on 5 out of 7 scenarios.
- **Candidate ML models (Ridge Lag Regression and Holt-Winters) did not consistently beat 3M SMA**:
  - Ridge Lag Regression beat 3M SMA by $\ge 5\%$ in only **2 of 7 scenarios** (Seasonal: +9.8%, Irregular Lumpy: +8.2%), but had a worse overall mean MAE (₹6,188 vs ₹6,155 for 3M SMA).
  - Holt-Winters beat 3M SMA in **3 of 7 scenarios** (Seasonal: +18.4%, Irregular Lumpy: +10.7%, Zero-Spending: +21.0%), but degraded severely on volatile series (-23.2%) and steady trends (-30.9%).
  - Seasonal Naive crushed all models on the Seasonal scenario (66.7% error reduction over 3M SMA), but failed on non-seasonal trends.
- **Scientific Verdict**: Because these results are derived from synthetic scenarios and no candidate ML model unconditionally outperformed the moving-average baselines, **real-world ML forecasting superiority remains unproven**. Complex ML models should not be deployed as an unconditional replacement for moving average baselines.

---

## 2. Dataset Strategy & Provenance Audit

### Investigation of Local and Public Datasets
1. **Live Supabase Database**:
   - Contains only **4 expense records** across **1 calendar month** (`2026-09`) for the user. Completely insufficient for longitudinal time-series evaluation ($T=1$).
2. **MoSPI HCES 2023-24 (`HCES_Data_2023-24_Csv.zip`)**:
   - Cross-sectional household consumption expenditure survey conducted by the National Sample Survey Office (NSSO), India.
   - **Critical Limitation**: HCES is a cross-sectional survey where each household is interviewed once for a 30-day recall period. It is **NOT** a longitudinal panel tracking the same individual across consecutive months over time. It cannot construct a 24-month or 36-month time-series for an individual user.
3. **US BLS CEX Panel (`intrvw24.zip`, `diary24.zip`)**:
   - US rotating panel tracking households for at most 4 quarterly interviews or two 1-week diaries. Not Indian, non-monthly, and too short for annual seasonal modeling.

### Controlled Synthetic Longitudinal Framework
To validate algorithms without temporal leakage, a reproducible synthetic dataset of 36 monthly observations (`2023-01` to `2025-12`) was generated under 7 distinct personal-finance patterns (Random Seed = 42):
- **Scenario 1 (Stable)**: Stationary spending around ₹40,000/month with low variance ($\sigma = 2,000$).
- **Scenario 2 (Increasing Trend)**: Lifestyle inflation / salary growth: ₹30,000 + ₹500/month drift + $\mathcal{N}(0, 2500^2)$.
- **Scenario 3 (Decreasing Trend)**: Budget austerity / debt paydown: ₹55,000 - ₹500/month drift + $\mathcal{N}(0, 2500^2)$.
- **Scenario 4 (Seasonal)**: Annual festive spikes (Diwali in Oct +₹25k, Year-end in Dec +₹15k, Tax in Mar +₹10k, Monsoon dip in Jul -₹5k).
- **Scenario 5 (Irregular Lumpy)**: Baseline ₹38,000 with irregular outlier purchases (Month 8: Medical ₹45k; Month 19: Insurance ₹30k; Month 31: Appliance ₹60k).
- **Scenario 6 (Intermittent Volatile)**: High-variance freelancer spending: ₹35,000 + $\mathcal{N}(0, 12000^2)$.
- **Scenario 7 (Zero-Spending Months)**: Inactive app usage: baseline ₹35,000 with 4 zero-spending months (Months 5, 14, 22, 29 = ₹0).

> [!NOTE]
> All synthetic data is strictly used for software verification and algorithmic benchmarking. Results from synthetic scenarios are not represented as empirical proof of real-world user accuracy.

---

## 3. Models & Walk-Forward Evaluation Methodology

### Evaluated Models
1. **Naive Baseline**: $\hat{y}_{t+1} = y_t$
2. **3-Month Simple Moving Average (3M SMA)**: $\hat{y}_{t+1} = \frac{1}{3}\sum_{i=0}^2 y_{t-i}$
3. **6-Month EWMA**: $\hat{y}_{t+1} = 0.5 y_t + 0.5 \hat{y}_t$
4. **Seasonal Naive (12M)**: $\hat{y}_{t+1} = y_{t-11}$ (same month last year)
5. **Ridge Lag Regression**: Ridge($\alpha=1.0$) with 3 spending lags, 3M rolling mean, and cyclical month-of-year sine/cosine features.
6. **Holt-Winters Smoothing**: Additive level, trend, and annual seasonality ($m=12$) with parameters $(\alpha, \beta, \gamma)$ optimized via L-BFGS-B minimizing training SSE.

*All models apply non-negative clipping: $\hat{y}_{t+1} = \max(0, \hat{y})$.*

### Leak-Free Chronological Walk-Forward Protocol
- **Total Series Length**: 36 months (`2023-01` to `2025-12`).
- **Initial Training Window**: 12 months (`2023-01` to `2023-12`).
- **Held-Out Test Window**: 24 chronological folds (`2024-01` to `2025-12`).
- **Zero Temporal Leakage**: For each test month $k$, models are fitted strictly using observations $1 \dots k-1$. Future observations are never visible during feature creation or parameter estimation.

---

## 4. Benchmark Results

### Overall Aggregate Performance (Across all 7 Scenarios & 24 Folds = 1,008 Predictions)
| Model | Mean MAE (₹) | Mean WAPE (%) | Scenarios Beating 3M SMA ($\ge 5\%$) | Scenarios Beating Naive |
| :--- | :--- | :--- | :--- | :--- |
| **Naive (Last Month)** | ₹7,162.90 | 19.07% | 0 / 7 | 0 / 7 |
| **3M Simple Moving Average** | ₹6,155.35 | 16.45% | Baseline | **7 / 7** |
| **6M EWMA ($\alpha=0.5$)** | ₹6,124.50 | 16.34% | 0 / 7 | **7 / 7** |
| **Seasonal Naive (12M)** | ₹6,620.53 | 17.52% | 2 / 7 | 4 / 7 |
| **Ridge Lag Regression** | ₹6,188.09 | 16.49% | 2 / 7 | 5 / 7 |
| **Holt-Winters Smoothing** | **₹6,074.78** | **16.02%** | 3 / 7 | 4 / 7 |

---

### Detailed Per-Scenario Performance Breakdown

#### Scenario 1: Stable Spending (Low Noise)
| Model | MAE (₹) | WAPE (%) | vs 3M SMA (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **3M SMA** | **₹1,667.39** | **4.25%** | Baseline | **Winner** |
| Ridge Lag Regression | ₹1,803.47 | 4.60% | -8.2% | Worse than 3M SMA |
| 6M EWMA | ₹1,824.92 | 4.65% | -9.4% | Worse than 3M SMA |
| Holt-Winters | ₹2,130.61 | 5.43% | -27.8% | Worse than 3M SMA |
| Seasonal Naive | ₹2,404.72 | 6.13% | -44.2% | Worse than 3M SMA |
| Naive | ₹2,440.02 | 6.22% | -46.3% | Worse than 3M SMA |

*Finding: On stationary series, simple 3-month averaging cancels noise better than fitting parameters on small training windows.*

#### Scenario 2: Increasing Trend (Upward Drift)
| Model | MAE (₹) | WAPE (%) | vs 3M SMA (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **6M EWMA** | **₹2,226.99** | **5.24%** | +0.6% | Beats Naive & 3M SMA |
| **3M SMA** | ₹2,239.62 | 5.27% | Baseline | Beats Naive |
| Naive | ₹2,434.25 | 5.73% | -8.7% | Loss |
| Ridge Lag Regression | ₹2,929.67 | 6.89% | -30.8% | Loss |
| Holt-Winters | ₹2,932.69 | 6.90% | -30.9% | Loss |
| Seasonal Naive | ₹6,597.89 | 15.53% | -194.6% | Severe Lag Loss |

#### Scenario 3: Decreasing Trend (Downward Drift)
| Model | MAE (₹) | WAPE (%) | vs 3M SMA (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **6M EWMA** | **₹1,833.93** | **4.31%** | +3.8% | Beats Naive & 3M SMA |
| **3M SMA** | ₹1,907.01 | 4.49% | Baseline | Beats Naive |
| Naive | ₹1,981.10 | 4.66% | -3.9% | Loss |
| Holt-Winters | ₹2,131.47 | 5.01% | -11.8% | Loss |
| Ridge Lag Regression | ₹2,503.75 | 5.89% | -31.3% | Loss |
| Seasonal Naive | ₹6,255.50 | 14.71% | -228.0% | Severe Lag Loss |

#### Scenario 4: Seasonal Spending (Diwali / Year-End / Tax Spikes)
| Model | MAE (₹) | WAPE (%) | vs 3M SMA (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Seasonal Naive** | **₹2,473.34** | **6.41%** | **+66.7%** | **Massive Winner** |
| **Holt-Winters** | ₹6,060.89 | 15.71% | **+18.4%** | Beats 3M SMA by >5% |
| **Ridge Lag Regression** | ₹6,707.07 | 17.39% | **+9.8%** | Beats 3M SMA by >5% |
| 3M SMA | ₹7,431.87 | 19.27% | Baseline | Beats Naive |
| 6M EWMA | ₹8,267.12 | 21.43% | -11.2% | Worse than 3M SMA |
| Naive | ₹11,030.71 | 28.60% | -48.4% | Loss |

*Finding: When annual seasonality is present, seasonal models reduce forecast error by up to 66.7% compared to moving averages.*

#### Scenario 5: Irregular Large Purchases (Lumpy Outliers)
| Model | MAE (₹) | WAPE (%) | vs 3M SMA (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Seasonal Naive** | ₹6,382.18 | 15.03% | +29.1% | Beats Both |
| **Holt-Winters** | ₹8,037.02 | 18.92% | +10.7% | Beats Both |
| **Ridge Lag Regression** | ₹8,260.17 | 19.45% | +8.2% | Beats Both |
| 6M EWMA | ₹8,630.34 | 20.32% | +4.1% | Beats Naive |
| 3M SMA | ₹9,003.19 | 21.20% | Baseline | Beats Naive |
| Naive | ₹9,783.94 | 23.04% | -8.7% | Loss |

#### Scenario 6: Intermittent / Volatile Spending
| Model | MAE (₹) | WAPE (%) | vs 3M SMA (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **6M EWMA** | **₹10,421.93** | **26.86%** | +3.3% | Beats Naive & 3M SMA |
| **3M SMA** | ₹10,781.71 | 27.79% | Baseline | Beats Naive |
| Seasonal Naive | ₹11,246.75 | 28.98% | -4.3% | Loss |
| Ridge Lag Regression | ₹11,250.77 | 29.00% | -4.3% | Loss |
| Naive | ₹11,813.94 | 30.45% | -9.6% | Loss |
| Holt-Winters | ₹13,281.53 | 34.23% | -23.2% | Heavy Overfit Loss |

*Finding: High volatility causes parameterized models (especially Holt-Winters) to overfit past noise, while simple moving averages remain more resilient.*

#### Scenario 7: Zero-Spending Months (Sparse Usage)
| Model | MAE (₹) | WAPE (%) | vs 3M SMA (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Holt-Winters** | **₹7,949.26** | **25.96%** | **+21.0%** | **Winner** |
| 6M EWMA | ₹9,666.28 | 31.57% | +3.9% | Beats Naive |
| Ridge Lag Regression | ₹9,861.75 | 32.21% | +1.9% | Beats Naive |
| 3M SMA | ₹10,056.63 | 32.85% | Baseline | Beats Naive |
| Naive | ₹10,656.33 | 34.80% | -6.0% | Loss |
| Seasonal Naive | ₹10,983.36 | 35.87% | -9.2% | Loss |

---

## 5. Candidate Application Tiering Architecture (Design Only)

Based on empirical performance across scenarios and data depth requirements, an eventual production forecasting feature should adopt a **4-tier staged capability model**:

```
[ User Expense History Length ]
           │
           ├── < 3 Months  ───> Tier 0: Deterministic Run-Rate Extrapolation
           │                    (Static Monthly Income - Recorded Expenses)
           │
           ├── 3 - 5 Months ──> Tier 1: 3-Month Simple Moving Average (3M SMA)
           │                    (Proven robust baseline; cancels noise without parameter risk)
           │
           ├── 6 - 11 Months ─> Tier 2: 6-Month EWMA / Weighted Trend Extrapolation
           │                    (Tracks medium-term drift; non-negative clipped)
           │
           └── >= 12 Months ──> Tier 3: Adaptive Model Selection Contest
                                (Backtested walk-forward contest: Candidate ML must beat 3M SMA by >= 5%,
                                 otherwise system automatically falls back to Tier 1/2)
```

### Fallback & Safety Guarantees
- If a user has $< 3$ months of history, the UI displays: *"Projected from current run-rate (Requires 3+ months for trend analysis)"*.
- If an ML model is backtested on a user's data and fails to achieve a 5% MAE reduction over 3M SMA, the system silently serves the 3M SMA forecast with zero quality degradation.
- Zero financial promises or investment outcome claims will ever be attached to the forecast.

---

## 6. Phase 11 Proposal

In Phase 11, instead of training an unverified ML model or altering user databases:
1. **Implement the Deterministic Tier 1 & Tier 2 Moving-Average Engine** in WealthIQ's existing client/server architecture (`lib/financial-engine.ts`).
2. Add genuine monthly date-filtering to `app/expenses/page.tsx` so historical transactions are organized into real calendar months.
3. Keep ML forecasting dormant until live accounts accumulate $\ge 12$ months of genuine user transaction history.
