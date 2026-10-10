"""
WealthIQ — Phase 17: HCES 2023-24 Household Spending Benchmark Model Training
Reproducible training and evaluation pipeline using official NSSO/MoSPI HCES 2023-24 microdata.
"""

import zipfile
import io
import csv
import time
import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import Ridge
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Set seed for reproducibility
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

def weighted_metrics(y_true, y_pred, weights):
    """Computes weighted MAE, RMSE, and R2."""
    weights = np.asarray(weights, dtype=float)
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    sum_w = np.sum(weights)
    weighted_mae = np.sum(weights * np.abs(y_true - y_pred)) / sum_w
    weighted_mse = np.sum(weights * (y_true - y_pred) ** 2) / sum_w
    weighted_rmse = np.sqrt(weighted_mse)

    # Weighted R2
    weighted_mean = np.sum(weights * y_true) / sum_w
    weighted_var = np.sum(weights * (y_true - weighted_mean) ** 2) / sum_w
    weighted_r2 = 1.0 - (weighted_mse / weighted_var) if weighted_var > 0 else 0.0

    return {
        "mae": float(weighted_mae),
        "rmse": float(weighted_rmse),
        "r2": float(weighted_r2),
    }

def unweighted_metrics(y_true, y_pred):
    """Computes standard unweighted MAE, RMSE, and R2."""
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    return {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2),
    }

def load_and_preprocess_hces(zip_path):
    print("Loading HCES 2023-24 from zip archive...")
    t0 = time.time()
    zf = zipfile.ZipFile(zip_path)

    # 1. Level 15: Target & Weights
    target_15 = "HCES_Data_2023-24_Csv/HCES_Data_2023-24_Csv/LEVEL - 15 (Section 1_1, A2,B2  C2).csv"
    hh_exp = {}
    with zf.open(target_15) as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="ignore"))
        for r in reader:
            key = (r["FSU_Serial_No"], r["Sample_SU_No"], r["Second_Stage_Stratum_No"], r["Sample_Household_No"])
            sec = r["SECTION"]
            if key not in hh_exp:
                hh_exp[key] = {
                    "state": r["State"].zfill(2),
                    "sector": int(r["Sector"]), # 1: Rural, 2: Urban
                    "weight": float(r["MULTIPLIER"]) if r["MULTIPLIER"] else 1.0,
                    "hh_size": 0,
                    "exp_food": 0.0,
                    "exp_consumables": 0.0,
                    "exp_durables": 0.0,
                }
            if r["HOUSEHOLD_SIZE"]:
                try:
                    hh_exp[key]["hh_size"] = int(float(r["HOUSEHOLD_SIZE"]))
                except ValueError:
                    pass
            exp_val = float(r["MONTHLY_CONSUMPTION_EXP"]) if r["MONTHLY_CONSUMPTION_EXP"] else 0.0
            if sec == "A2":
                hh_exp[key]["exp_food"] = exp_val
            elif sec == "B2":
                hh_exp[key]["exp_consumables"] = exp_val
            elif sec == "C2":
                hh_exp[key]["exp_durables"] = exp_val

    # 2. Level 02: Demographics
    target_02 = "HCES_Data_2023-24_Csv/HCES_Data_2023-24_Csv/LEVEL - 02 (Section 3).csv"
    hh_demo = {}
    with zf.open(target_02) as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="ignore"))
        for r in reader:
            key = (r["FSU_Serial_No"], r["Sample_SU_No"], r["Second_Stage_Stratum_No"], r["Sample_Household_No"])
            if key not in hh_demo:
                hh_demo[key] = {"num_adults": 0, "num_children": 0, "max_education": 0}
            try:
                age = int(r["Age"]) if r["Age"] else 0
            except ValueError:
                age = 0
            if age >= 18:
                hh_demo[key]["num_adults"] += 1
            else:
                hh_demo[key]["num_children"] += 1
            try:
                edu = int(r["Education_Level"]) if r["Education_Level"] else 0
            except ValueError:
                edu = 0
            if edu > hh_demo[key]["max_education"]:
                hh_demo[key]["max_education"] = edu

    # 3. Level 03: Household Characteristics
    target_03 = "HCES_Data_2023-24_Csv/HCES_Data_2023-24_Csv/LEVEL - 03.csv"
    hh_char = {}
    with zf.open(target_03) as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="ignore"))
        for r in reader:
            key = (r["FSU_Serial_No"], r["Sample_SU_No"], r["Second_Stage_Stratum_No"], r["Sample_Household_No"])
            hh_char[key] = {
                "fsu_serial": r["FSU_Serial_No"],
                "hh_type": r.get("Household_Type", "").strip() or "9",
                "dwelling_type": r.get("Type_of_Dwelling_Unit", "").strip() or "1",
                "cooking_fuel": r.get("Energy_Source_Cooking", "").strip() or "02",
                "land_owned": r.get("Land_Ownership", "").strip() or "1",
            }

    # Consolidated extraction
    records = []
    for key, exp in hh_exp.items():
        if exp["hh_size"] <= 0:
            continue
        tot_exp = exp["exp_food"] + exp["exp_consumables"] + exp["exp_durables"]
        if tot_exp <= 0:
            continue
        mpce = tot_exp / exp["hh_size"]

        demo = hh_demo.get(key, {"num_adults": exp["hh_size"], "num_children": 0, "max_education": 0})
        ch = hh_char.get(key, {"hh_type": "9", "dwelling_type": "1", "cooking_fuel": "02", "land_owned": "1", "fsu_serial": key[0]})

        # Map highest education level into 4 clean tiers
        # NSSO codes: 01-03: below primary/illiterate; 04-05: primary/middle; 06-08: secondary/higher secondary/diploma; 10-12: graduate/post-graduate
        edu_code = demo["max_education"]
        if edu_code <= 3:
            edu_tier = "below_primary"
        elif edu_code <= 5:
            edu_tier = "primary_middle"
        elif edu_code <= 8:
            edu_tier = "secondary_higher"
        else:
            edu_tier = "graduate_above"

        # Map livelihood/household type into 4 clean standard tiers
        # Rural: 1,2: self-employed; 3,4: regular wage; 5,6: casual labour; 9: other
        # Urban: 1: self-employed; 2: regular wage; 3: casual labour; 9: other
        ht = ch["hh_type"]
        if ht in ["3", "4"] or (exp["sector"] == 2 and ht == "2"):
            livelihood = "regular_wage"
        elif ht in ["1", "2"] or (exp["sector"] == 2 and ht == "1"):
            livelihood = "self_employed"
        elif ht in ["5", "6"] or (exp["sector"] == 2 and ht == "3"):
            livelihood = "casual_labour"
        else:
            livelihood = "other"

        # Map dwelling type: 1: pucca, 2: semi_pucca, 3: katcha
        dw = ch["dwelling_type"]
        if dw == "1":
            dwelling = "pucca"
        elif dw == "2":
            dwelling = "semi_pucca"
        else:
            dwelling = "katcha"

        # Map cooking fuel: 02: lpg, 03/04: png_electricity, 01: firewood, other
        ck = ch["cooking_fuel"]
        if ck == "02":
            cooking = "lpg"
        elif ck in ["03", "04"]:
            cooking = "png_electric"
        elif ck == "01":
            cooking = "firewood"
        else:
            cooking = "other"

        # Land owned: 1: owned, 2: not owned
        land = "owned" if ch["land_owned"] == "1" else "not_owned"

        records.append({
            "fsu_serial": ch["fsu_serial"],
            "state": exp["state"],
            "sector": "rural" if exp["sector"] == 1 else "urban",
            "hh_size": exp["hh_size"],
            "num_adults": max(1, demo["num_adults"]),
            "num_children": demo["num_children"],
            "highest_education": edu_tier,
            "livelihood": livelihood,
            "dwelling_type": dwelling,
            "cooking_fuel": cooking,
            "land_owned": land,
            "weight": exp["weight"],
            "mpce": mpce,
            "total_exp": tot_exp,
        })

    df = pd.DataFrame(records)
    print(f"Data joined in {time.time() - t0:.2f}s. Total households: {len(df)}")
    return df

def main():
    zip_path = "/home/aditya/Downloads/HCES_Data_2023-24_Csv.zip"
    df = load_and_preprocess_hces(zip_path)

    # Feature definitions
    categorical_features = [
        "state",
        "sector",
        "highest_education",
        "livelihood",
        "dwelling_type",
        "cooking_fuel",
        "land_owned",
    ]
    numeric_features = [
        "hh_size",
        "num_adults",
        "num_children",
    ]
    feature_cols = categorical_features + numeric_features
    target_col = "mpce"
    weight_col = "weight"
    group_col = "fsu_serial"

    X = df[feature_cols]
    y = df[target_col]
    weights = df[weight_col]
    groups = df[group_col]

    # Cluster-aware Group train-test split (80% train, 20% test on FSU cluster)
    print("\nSplitting into Train (80%) and Held-Out Test (20%) using FSU Cluster Groups...")
    gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=RANDOM_SEED)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    w_train, w_test = weights.iloc[train_idx], weights.iloc[test_idx]
    df_test = df.iloc[test_idx]

    print(f"Train size: {len(X_train)} households")
    print(f"Test size:  {len(X_test)} households")

    results = {}

    # 1. Baseline 1: Weighted Mean Regressor
    print("\n--- Model 1: Baseline Weighted Mean Regressor ---")
    weighted_mean_val = np.average(y_train, weights=w_train)
    y_pred_mean = np.full(len(y_test), weighted_mean_val)
    results["baseline_weighted_mean"] = {
        "weighted": weighted_metrics(y_test, y_pred_mean, w_test),
        "unweighted": unweighted_metrics(y_test, y_pred_mean),
    }
    print(f"  Weighted MAE:  ₹{results['baseline_weighted_mean']['weighted']['mae']:.2f}")
    print(f"  Weighted RMSE: ₹{results['baseline_weighted_mean']['weighted']['rmse']:.2f}")
    print(f"  Weighted R²:   {results['baseline_weighted_mean']['weighted']['r2']:.4f}")

    # 2. Baseline 2: Weighted Median Regressor
    print("\n--- Model 2: Baseline Median Regressor ---")
    median_val = np.median(y_train)
    y_pred_med = np.full(len(y_test), median_val)
    results["baseline_median"] = {
        "weighted": weighted_metrics(y_test, y_pred_med, w_test),
        "unweighted": unweighted_metrics(y_test, y_pred_med),
    }
    print(f"  Weighted MAE:  ₹{results['baseline_median']['weighted']['mae']:.2f}")
    print(f"  Weighted RMSE: ₹{results['baseline_median']['weighted']['rmse']:.2f}")

    # 3. Linear Model: Ridge Regression (with OneHotEncoder + StandardScaler)
    print("\n--- Model 3: Regularized Linear Model (Ridge) ---")
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(drop="first", handle_unknown="ignore", sparse_output=False), categorical_features),
            ("num", StandardScaler(), numeric_features),
        ]
    )
    ridge_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", Ridge(alpha=10.0, random_state=RANDOM_SEED)),
    ])
    ridge_pipeline.fit(X_train, y_train, regressor__sample_weight=w_train)
    y_pred_ridge = np.maximum(500.0, ridge_pipeline.predict(X_test)) # non-negative MPCE constraint
    results["ridge_regression"] = {
        "weighted": weighted_metrics(y_test, y_pred_ridge, w_test),
        "unweighted": unweighted_metrics(y_test, y_pred_ridge),
    }
    print(f"  Weighted MAE:  ₹{results['ridge_regression']['weighted']['mae']:.2f}")
    print(f"  Weighted RMSE: ₹{results['ridge_regression']['weighted']['rmse']:.2f}")
    print(f"  Weighted R²:   {results['ridge_regression']['weighted']['r2']:.4f}")

    # 4. Nonlinear Model: HistGradientBoostingRegressor
    print("\n--- Model 4: HistGradientBoostingRegressor (Gradient Boosted Trees) ---")
    # For HistGradientBoosting, encode categoricals with Ordinal/OneHot or ColumnTransformer
    from sklearn.preprocessing import OrdinalEncoder
    ordinal_preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), categorical_features),
            ("num", "passthrough", numeric_features),
        ]
    )
    hgb_model = HistGradientBoostingRegressor(
        categorical_features=list(range(len(categorical_features))),
        max_iter=150,
        learning_rate=0.08,
        max_leaf_nodes=31,
        min_samples_leaf=20,
        random_state=RANDOM_SEED,
        loss="squared_error",
    )
    hgb_pipeline = Pipeline([
        ("preprocessor", ordinal_preprocessor),
        ("regressor", hgb_model),
    ])
    t_train = time.time()
    hgb_pipeline.fit(X_train, y_train, regressor__sample_weight=w_train)
    print(f"  Fitted HistGradientBoosting in {time.time() - t_train:.2f}s")
    y_pred_hgb = np.maximum(500.0, hgb_pipeline.predict(X_test))
    results["hist_gradient_boosting"] = {
        "weighted": weighted_metrics(y_test, y_pred_hgb, w_test),
        "unweighted": unweighted_metrics(y_test, y_pred_hgb),
    }
    print(f"  Weighted MAE:  ₹{results['hist_gradient_boosting']['weighted']['mae']:.2f}")
    print(f"  Weighted RMSE: ₹{results['hist_gradient_boosting']['weighted']['rmse']:.2f}")
    print(f"  Weighted R²:   {results['hist_gradient_boosting']['weighted']['r2']:.4f}")

    # Segment Error Analysis for HistGradientBoosting
    print("\n--- Segment Error Analysis (Held-Out Test Set) ---")
    segments = {}
    for s_val, s_label in [("rural", "Rural"), ("urban", "Urban")]:
        mask = (df_test["sector"] == s_val)
        seg_y = y_test[mask]
        seg_pred = y_pred_hgb[mask]
        seg_w = w_test[mask]
        seg_metrics = weighted_metrics(seg_y, seg_pred, seg_w)
        segments[s_label] = seg_metrics
        print(f"  {s_label} (N={np.sum(mask)}): Weighted MAE = ₹{seg_metrics['mae']:.2f}, RMSE = ₹{seg_metrics['rmse']:.2f}, R² = {seg_metrics['r2']:.4f}")

    # Percentiles of expenditure by state and sector for reference benchmarks
    print("\nComputing state/sector reference benchmarks for context...")
    state_benchmarks = {}
    for (st, sc), grp in df.groupby(["state", "sector"]):
        w = grp["weight"].values
        v = grp["mpce"].values
        order = np.argsort(v)
        v_sorted = v[order]
        w_sorted = w[order]
        cw = np.cumsum(w_sorted)
        total_w = cw[-1]
        p25 = float(v_sorted[np.searchsorted(cw, 0.25 * total_w)])
        p50 = float(v_sorted[np.searchsorted(cw, 0.50 * total_w)])
        p75 = float(v_sorted[np.searchsorted(cw, 0.75 * total_w)])
        mean_val = float(np.average(v, weights=w))
        key = f"{st}_{sc}"
        state_benchmarks[key] = {
            "state": st,
            "sector": sc,
            "weighted_mean_mpce": round(mean_val, 2),
            "median_mpce": round(p50, 2),
            "p25_mpce": round(p25, 2),
            "p75_mpce": round(p75, 2),
            "sample_size": len(grp),
        }

    # Save Best Model Artifact & Metadata
    models_dir = "/home/aditya/Projects/wealthIQ_New/ml/models"
    os.makedirs(models_dir, exist_ok=True)
    artifact_path = os.path.join(models_dir, "hces_spending_benchmark_v1.joblib")
    joblib.dump(hgb_pipeline, artifact_path, compress=3)
    artifact_size_mb = os.path.getsize(artifact_path) / (1024 * 1024)
    print(f"\nSaved model artifact to: {artifact_path} ({artifact_size_mb:.2f} MB)")

    # Save Metadata & Benchmarks
    metadata = {
        "model_name": "hces_spending_benchmark_v1",
        "algorithm": "HistGradientBoostingRegressor",
        "target": "mpce (Monthly Per Capita Consumption Expenditure in INR)",
        "survey": "MoSPI Household Consumption Expenditure Survey (HCES) 2023-24",
        "survey_period": "August 2023 – July 2024",
        "total_households_trained": int(len(X_train)),
        "total_households_tested": int(len(X_test)),
        "total_sample_size": int(len(df)),
        "random_seed": RANDOM_SEED,
        "feature_columns": feature_cols,
        "categorical_features": categorical_features,
        "numeric_features": numeric_features,
        "model_evaluation": results,
        "segment_evaluation": segments,
        "artifact_size_mb": round(artifact_size_mb, 2),
    }

    metadata_path = os.path.join(models_dir, "hces_benchmark_metadata.json")
    with open(metadata_path, "w") as fp:
        json.dump(metadata, fp, indent=2)
    print(f"Saved model metadata to: {metadata_path}")

    benchmarks_path = os.path.join(models_dir, "hces_state_sector_benchmarks.json")
    with open(benchmarks_path, "w") as fp:
        json.dump(state_benchmarks, fp, indent=2)
    print(f"Saved state benchmarks to: {benchmarks_path}")

    print("\nModel Training and Evaluation Complete Successfully!")

if __name__ == "__main__":
    main()
