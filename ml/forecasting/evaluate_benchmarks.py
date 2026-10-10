"""
Chronological Walk-Forward Forecasting Evaluation Engine
WealthIQ — Phase 10 Offline Forecasting Benchmark

Executes leak-free rolling walk-forward evaluation across all 7 scenarios and 6 models.
Calculates MAE, WAPE, and baseline comparison against Phase 9 criteria:
- Model beats 3M Moving Average if MAE is reduced by at least 5% (MAE_model <= 0.95 * MAE_3M_SMA)
- Model beats Naive if WAPE_model < WAPE_naive
"""

import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from models import (
    NaiveForecaster,
    SimpleMovingAverageForecaster,
    ExponentialMovingAverageForecaster,
    SeasonalNaiveForecaster,
    RidgeLagForecaster,
    HoltWintersForecaster,
)

DATA_PATH = Path(__file__).parent / "data" / "synthetic_monthly_scenarios.csv"
REPORT_DIR = Path(__file__).parent / "reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

def run_evaluation():
    df = pd.read_csv(DATA_PATH)
    dates = df["month"].tolist()
    total_months = len(df)
    min_train = 12
    test_folds = total_months - min_train  # 36 - 12 = 24 test folds

    scenarios = [
        "stable",
        "increasing_trend",
        "decreasing_trend",
        "seasonal",
        "irregular_lumpy",
        "intermittent_volatile",
        "zero_spending_months",
    ]

    models = [
        NaiveForecaster(),
        SimpleMovingAverageForecaster(window=3),
        ExponentialMovingAverageForecaster(alpha=0.5),
        SeasonalNaiveForecaster(season=12),
        RidgeLagForecaster(lags=3, alpha=1.0),
        HoltWintersForecaster(season=12),
    ]

    results = {}

    for scenario in scenarios:
        series = df[scenario].values
        results[scenario] = {
            "scenario": scenario,
            "total_months": total_months,
            "min_train_months": min_train,
            "test_folds": test_folds,
            "test_dates": dates[min_train:],
            "models": {},
        }

        # Step 1: Collect predictions for each model across all 24 folds
        for model in models:
            preds = []
            actuals = []
            abs_errors = []

            for t in range(min_train, total_months):
                history = series[:t]
                actual = series[t]
                hist_dates = dates[:t]

                pred = model.predict(history, hist_dates)
                pred = max(0.0, float(pred))

                preds.append(round(pred, 2))
                actuals.append(round(actual, 2))
                abs_errors.append(round(abs(actual - pred), 2))

            mae = float(np.mean(abs_errors))
            sum_actual = float(np.sum(actuals))
            sum_abs_err = float(np.sum(abs_errors))

            # Documented zero-spending policy for WAPE:
            if sum_actual > 0:
                wape = float(sum_abs_err / sum_actual)
            else:
                wape = 0.0 if sum_abs_err == 0 else None

            results[scenario]["models"][model.name] = {
                "mae": round(mae, 2),
                "wape": round(wape, 4) if wape is not None else None,
                "predictions": preds,
                "actuals": actuals,
                "abs_errors": abs_errors,
            }

        # Step 2: Compare against Naive and 3M SMA baselines
        baseline_naive_wape = results[scenario]["models"]["Naive (Last Month)"]["wape"]
        baseline_3m_mae = results[scenario]["models"]["3M Simple Moving Average"]["mae"]

        for m_name, m_data in results[scenario]["models"].items():
            mae = m_data["mae"]
            wape = m_data["wape"]

            diff_pct_3m = round(((baseline_3m_mae - mae) / baseline_3m_mae) * 100, 2)
            beats_naive = bool(wape < baseline_naive_wape) if (wape is not None and baseline_naive_wape is not None) else False
            beats_3m_5pct = bool(mae <= 0.95 * baseline_3m_mae)

            m_data["diff_pct_vs_3m_sma"] = diff_pct_3m
            m_data["beats_naive_wape"] = beats_naive
            m_data["beats_3m_sma_5pct"] = beats_3m_5pct

    # Step 3: Compute aggregate summary across scenarios
    summary_table = []
    for m in models:
        m_name = m.name
        maes = [results[sc]["models"][m_name]["mae"] for sc in scenarios]
        wapes = [results[sc]["models"][m_name]["wape"] for sc in scenarios if results[sc]["models"][m_name]["wape"] is not None]
        beats_3m_count = sum(1 for sc in scenarios if results[sc]["models"][m_name]["beats_3m_sma_5pct"])
        beats_naive_count = sum(1 for sc in scenarios if results[sc]["models"][m_name]["beats_naive_wape"])

        summary_table.append({
            "model": m_name,
            "mean_mae": round(float(np.mean(maes)), 2),
            "mean_wape": round(float(np.mean(wapes)), 4),
            "scenarios_beating_3m_5pct": f"{beats_3m_count}/{len(scenarios)}",
            "scenarios_beating_naive": f"{beats_naive_count}/{len(scenarios)}",
        })

    # Save JSON report
    with open(REPORT_DIR / "benchmark_results.json", "w") as f:
        json.dump({"summary": summary_table, "scenarios": results}, f, indent=2)

    # Print summary table
    print("\n" + "=" * 95)
    print("      WEALTHIQ — PHASE 10 OFFLINE EXPENSE FORECASTING BENCHMARK RESULTS")
    print("=" * 95)
    print(f"{'Model':<38} | {'Mean MAE (₹)':<14} | {'Mean WAPE':<10} | {'Beats 3M MA (>=5%)':<18} | {'Beats Naive'}")
    print("-" * 95)
    for row in summary_table:
        print(f"{row['model']:<38} | ₹{row['mean_mae']:<13,.2f} | {row['mean_wape']*100:<9.2f}% | {row['scenarios_beating_3m_5pct']:<18} | {row['scenarios_beating_naive']}")
    print("-" * 95)

    print("\nDetailed Per-Scenario Breakdown (MAE in ₹ | WAPE in %):")
    for sc in scenarios:
        print(f"\n>>> Scenario: {sc.upper()}")
        print(f"{'Model':<38} | {'MAE (₹)':<12} | {'WAPE':<8} | {'vs 3M MA':<10} | {'Status'}")
        print("-" * 75)
        for m in models:
            m_res = results[sc]["models"][m.name]
            diff = m_res["diff_pct_vs_3m_sma"]
            diff_str = f"{diff:+.1f}%"
            win = "BEATS BOTH" if (m_res["beats_3m_sma_5pct"] and m_res["beats_naive_wape"]) else ("Beats 3M" if m_res["beats_3m_sma_5pct"] else ("Beats Naive" if m_res["beats_naive_wape"] else "Loss"))
            print(f"{m.name:<38} | ₹{m_res['mae']:<11,.2f} | {m_res['wape']*100:<7.2f}% | {diff_str:<10} | {win}")

    return summary_table, results

if __name__ == "__main__":
    run_evaluation()
