"""
Synthetic Longitudinal Household Expenditure Scenario Generator
WealthIQ — Phase 10 Offline Forecasting Benchmark

Generates 7 controlled, reproducible monthly spending time-series scenarios
(36 months, 2023-01 to 2025-12) representing typical personal finance patterns.
All amounts in Indian Rupees (INR).
Fixed Random Seed: 42 for exact reproducibility.
"""

import numpy as np
import pandas as pd
from pathlib import Path

SEED = 42
MONTHS = 36
DATES = pd.date_range(start="2023-01-01", periods=MONTHS, freq="MS").strftime("%Y-%m").tolist()

def generate_scenarios() -> pd.DataFrame:
    np.random.seed(SEED)
    t = np.arange(1, MONTHS + 1)
    
    # 1. Stable Spending (Stationary baseline with mild noise)
    noise_stable = np.random.normal(0, 2000, MONTHS)
    stable = np.maximum(10000, 40000 + noise_stable)
    
    # 2. Increasing Trend (Lifestyle inflation / salary growth)
    noise_inc = np.random.normal(0, 2500, MONTHS)
    increasing = np.maximum(10000, 30000 + 500 * t + noise_inc)
    
    # 3. Decreasing Trend (Aggressive austerity / debt repayment)
    noise_dec = np.random.normal(0, 2500, MONTHS)
    decreasing = np.maximum(10000, 55000 - 500 * t + noise_dec)
    
    # 4. Seasonal Spending (Annual festive spikes: Diwali in Oct, Year-end in Dec, Tax in Mar)
    month_of_year = np.array([int(d.split("-")[1]) for d in DATES])
    seasonal_boost = np.zeros(MONTHS)
    seasonal_boost[month_of_year == 10] = 25000  # Diwali / Festive shopping
    seasonal_boost[month_of_year == 12] = 15000  # Year-end travel / celebration
    seasonal_boost[month_of_year == 3] = 10000   # Financial year-end tax / schooling
    seasonal_boost[month_of_year == 7] = -5000   # Monsoon low spending
    noise_season = np.random.normal(0, 2000, MONTHS)
    seasonal = np.maximum(10000, 35000 + seasonal_boost + noise_season)
    
    # 5. Irregular Large Purchases (Lumpy outliers: medical, electronics, insurance)
    noise_lumpy = np.random.normal(0, 2000, MONTHS)
    lumpy = 38000 + noise_lumpy
    lumpy[7] += 45000   # Month 8 (Aug 2023): Medical emergency
    lumpy[18] += 30000  # Month 19 (Jul 2024): Annual insurance renewal
    lumpy[30] += 60000  # Month 31 (Jul 2025): Laptop / home appliance
    lumpy = np.maximum(10000, lumpy)
    
    # 6. Intermittent / Volatile (High variance freelancer cash-flows)
    noise_vol = np.random.normal(0, 12000, MONTHS)
    volatile = np.maximum(8000, 35000 + noise_vol)
    
    # 7. Zero-Spending Months (Intermittent app logging / inactive months)
    noise_zero = np.random.normal(0, 2500, MONTHS)
    zero_spending = np.maximum(10000, 35000 + noise_zero)
    # Inject 4 zero-spending months
    zero_indices = [4, 13, 21, 28]  # Months 5, 14, 22, 29
    zero_spending[zero_indices] = 0.0
    
    df = pd.DataFrame({
        "month": DATES,
        "step": t,
        "stable": np.round(stable, 2),
        "increasing_trend": np.round(increasing, 2),
        "decreasing_trend": np.round(decreasing, 2),
        "seasonal": np.round(seasonal, 2),
        "irregular_lumpy": np.round(lumpy, 2),
        "intermittent_volatile": np.round(volatile, 2),
        "zero_spending_months": np.round(zero_spending, 2),
    })
    
    return df

if __name__ == "__main__":
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "synthetic_monthly_scenarios.csv"
    
    df = generate_scenarios()
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} monthly observations across 7 scenarios -> {out_path}")
    print("\nScenario Summary Statistics (INR):")
    scenarios = [c for c in df.columns if c not in ["month", "step"]]
    stats = df[scenarios].describe().T[["mean", "std", "min", "max"]]
    print(stats.to_string())
