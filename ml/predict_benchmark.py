#!/usr/bin/env python3
"""
WealthIQ — Phase 17: HCES 2023-24 Household Spending Benchmark Inference Engine
Loads the trained HistGradientBoostingRegressor model pipeline and returns
deterministic, cross-sectional consumption expenditure benchmarks.
"""

import sys
import os
import json
import joblib
import pandas as pd
import numpy as np

# Base directory for ML artifacts
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "hces_spending_benchmark_v1.joblib")
BENCHMARKS_PATH = os.path.join(MODELS_DIR, "hces_state_sector_benchmarks.json")
METADATA_PATH = os.path.join(MODELS_DIR, "hces_benchmark_metadata.json")

# State Code to Name mapping (Census 2011 / NSSO 36 States and UTs)
STATE_NAMES = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman & Diu and Dadra & Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Ladakh"
}

_CACHED_PIPELINE = None
_CACHED_BENCHMARKS = None
_CACHED_METADATA = None

def get_pipeline():
    global _CACHED_PIPELINE
    if _CACHED_PIPELINE is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model artifact not found at: {MODEL_PATH}")
        _CACHED_PIPELINE = joblib.load(MODEL_PATH)
    return _CACHED_PIPELINE

def get_benchmarks():
    global _CACHED_BENCHMARKS
    if _CACHED_BENCHMARKS is None:
        if not os.path.exists(BENCHMARKS_PATH):
            raise FileNotFoundError(f"Benchmarks artifact not found at: {BENCHMARKS_PATH}")
        with open(BENCHMARKS_PATH, "r") as fp:
            _CACHED_BENCHMARKS = json.load(fp)
    return _CACHED_BENCHMARKS

def get_metadata():
    global _CACHED_METADATA
    if _CACHED_METADATA is None:
        if not os.path.exists(METADATA_PATH):
            raise FileNotFoundError(f"Metadata artifact not found at: {METADATA_PATH}")
        with open(METADATA_PATH, "r") as fp:
            _CACHED_METADATA = json.load(fp)
    return _CACHED_METADATA

def predict_household_benchmark(data: dict) -> dict:
    # 1. Validation
    state = str(data.get("state", "")).zfill(2)
    if state not in STATE_NAMES:
        raise ValueError(f"Invalid state code: '{state}'. Must be one of: {list(STATE_NAMES.keys())}")

    sector = str(data.get("sector", "")).lower().strip()
    if sector not in ["rural", "urban"]:
        raise ValueError(f"Invalid sector: '{sector}'. Must be 'rural' or 'urban'.")

    highest_education = str(data.get("highest_education", "")).lower().strip()
    valid_edu = ["below_primary", "primary_middle", "secondary_higher", "graduate_above"]
    if highest_education not in valid_edu:
        raise ValueError(f"Invalid highest_education: '{highest_education}'. Must be one of: {valid_edu}")

    livelihood = str(data.get("livelihood", "")).lower().strip()
    valid_live = ["regular_wage", "self_employed", "casual_labour", "other"]
    if livelihood not in valid_live:
        raise ValueError(f"Invalid livelihood: '{livelihood}'. Must be one of: {valid_live}")

    dwelling_type = str(data.get("dwelling_type", "")).lower().strip()
    valid_dwell = ["pucca", "semi_pucca", "katcha"]
    if dwelling_type not in valid_dwell:
        raise ValueError(f"Invalid dwelling_type: '{dwelling_type}'. Must be one of: {valid_dwell}")

    cooking_fuel = str(data.get("cooking_fuel", "")).lower().strip()
    valid_cook = ["lpg", "png_electric", "firewood", "other"]
    if cooking_fuel not in valid_cook:
        raise ValueError(f"Invalid cooking_fuel: '{cooking_fuel}'. Must be one of: {valid_cook}")

    land_owned = str(data.get("land_owned", "")).lower().strip()
    valid_land = ["owned", "not_owned"]
    if land_owned not in valid_land:
        raise ValueError(f"Invalid land_owned: '{land_owned}'. Must be one of: {valid_land}")

    try:
        hh_size = int(data.get("hh_size", 1))
    except (TypeError, ValueError):
        raise ValueError("hh_size must be a valid integer.")
    if hh_size < 1 or hh_size > 25:
        raise ValueError("hh_size must be between 1 and 25.")

    try:
        num_adults = int(data.get("num_adults", hh_size))
    except (TypeError, ValueError):
        raise ValueError("num_adults must be a valid integer.")
    if num_adults < 1 or num_adults > hh_size:
        raise ValueError("num_adults must be between 1 and hh_size.")

    try:
        num_children = int(data.get("num_children", hh_size - num_adults))
    except (TypeError, ValueError):
        raise ValueError("num_children must be a valid integer.")
    if num_children < 0 or (num_adults + num_children != hh_size):
        # Auto-reconcile composition if slight discrepancy
        num_children = max(0, hh_size - num_adults)

    # 2. Prepare DataFrame row
    pipeline = get_pipeline()
    benchmarks = get_benchmarks()
    metadata = get_metadata()

    input_df = pd.DataFrame([{
        "state": state,
        "sector": sector,
        "highest_education": highest_education,
        "livelihood": livelihood,
        "dwelling_type": dwelling_type,
        "cooking_fuel": cooking_fuel,
        "land_owned": land_owned,
        "hh_size": hh_size,
        "num_adults": num_adults,
        "num_children": num_children,
    }])

    # 3. Model Inference
    raw_pred = float(pipeline.predict(input_df)[0])
    # Minimum plausible monthly consumption floor in India (e.g. ₹500)
    estimated_mpce = round(max(500.0, raw_pred), 2)
    estimated_household_total = round(estimated_mpce * hh_size, 2)

    # 4. Context Reference Benchmarks
    ref_key = f"{state}_{sector}"
    ref = benchmarks.get(ref_key, {})

    # 5. Sector-specific empirical MAE uncertainty from held-out evaluation
    segment_eval = metadata.get("segment_evaluation", {})
    sec_key = "Rural" if sector == "rural" else "Urban"
    seg_info = segment_eval.get(sec_key, {"mae": 3461.22, "rmse": 5834.94, "r2": 0.5606})
    seg_mae = round(float(seg_info.get("mae", 3461.22)), 2)
    seg_rmse = round(float(seg_info.get("rmse", 5834.94)), 2)
    seg_r2 = round(float(seg_info.get("r2", 0.5606)), 2)

    lower_mpce = round(max(500.0, estimated_mpce - seg_mae), 2)
    upper_mpce = round(estimated_mpce + seg_mae, 2)

    return {
        "success": True,
        "estimated_mpce": estimated_mpce,
        "estimated_household_total": estimated_household_total,
        "state_code": state,
        "state_name": STATE_NAMES[state],
        "sector": sector,
        "household_size": hh_size,
        "num_adults": num_adults,
        "num_children": num_children,
        "reference_benchmarks": {
            "state_sector_median_mpce": ref.get("median_mpce"),
            "state_sector_mean_mpce": ref.get("weighted_mean_mpce"),
            "state_sector_p25_mpce": ref.get("p25_mpce"),
            "state_sector_p75_mpce": ref.get("p75_mpce"),
            "sample_size": ref.get("sample_size"),
        },
        "uncertainty": {
            "segment_mae": seg_mae,
            "segment_rmse": seg_rmse,
            "segment_r2": seg_r2,
            "typical_range_mpce": [lower_mpce, upper_mpce],
            "typical_range_household": [round(lower_mpce * hh_size, 2), round(upper_mpce * hh_size, 2)],
            "note": f"Evaluated on held-out test data ({sec_key} sector). Actual household spending varies by personal preferences and unobserved assets.",
        },
        "model_metadata": {
            "model_name": metadata.get("model_name", "hces_spending_benchmark_v1"),
            "algorithm": metadata.get("algorithm", "HistGradientBoostingRegressor"),
            "version": "1.0.0",
            "survey": metadata.get("survey", "MoSPI Household Consumption Expenditure Survey (HCES) 2023-24"),
            "survey_period": metadata.get("survey_period", "August 2023 – July 2024"),
            "total_survey_households": metadata.get("total_sample_size", 261953),
        }
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--metadata":
        print(json.dumps({
            "states": STATE_NAMES,
            "metadata": get_metadata(),
            "benchmarks_count": len(get_benchmarks()),
        }))
        return

    # Read from stdin or arg
    try:
        if len(sys.argv) > 1 and sys.argv[1].startswith("{"):
            raw_input = sys.argv[1]
        else:
            raw_input = sys.stdin.read()

        if not raw_input.strip():
            print(json.dumps({"error": "Empty input provided to prediction engine."}), file=sys.stderr)
            sys.exit(1)

        payload = json.loads(raw_input)
        result = predict_household_benchmark(payload)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
