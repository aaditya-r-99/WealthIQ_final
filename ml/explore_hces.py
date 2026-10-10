import zipfile
import io
import csv
import time
import numpy as np
import pandas as pd

print("Starting HCES 2023-24 dataset exploration and join...")
t0 = time.time()
zip_path = "/home/aditya/Downloads/HCES_Data_2023-24_Csv.zip"
zf = zipfile.ZipFile(zip_path)

# 1. Parse Level 15 for Household Expenditure & Weights
print("1. Parsing Level 15 (Expenditure & Weights)...")
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
                "sector": int(r["Sector"]),
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

print(f"   Level 15 loaded: {len(hh_exp)} households in {time.time() - t0:.2f}s")

# 2. Parse Level 02 for Demographics (Adults, Children, Max Education)
print("2. Parsing Level 02 (Demographics)...")
t1 = time.time()
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

print(f"   Level 02 loaded: {len(hh_demo)} households in {time.time() - t1:.2f}s")

# 3. Parse Level 03 for Socioeconomic Characteristics
print("3. Parsing Level 03 (Household Characteristics)...")
t2 = time.time()
target_03 = "HCES_Data_2023-24_Csv/HCES_Data_2023-24_Csv/LEVEL - 03.csv"
hh_char = {}
with zf.open(target_03) as f:
    reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="ignore"))
    for r in reader:
        key = (r["FSU_Serial_No"], r["Sample_SU_No"], r["Second_Stage_Stratum_No"], r["Sample_Household_No"])
        hh_char[key] = {
            "hh_type": r.get("Household_Type", "").strip(),
            "dwelling_type": r.get("Type_of_Dwelling_Unit", "").strip(),
            "cooking_fuel": r.get("Energy_Source_Cooking", "").strip(),
            "land_owned": r.get("Land_Ownership", "").strip(),
            "fsu_serial": r["FSU_Serial_No"],
        }

print(f"   Level 03 loaded: {len(hh_char)} households in {time.time() - t2:.2f}s")

# 4. Assemble consolidated DataFrame
print("4. Consolidating into DataFrame...")
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

    records.append({
        "fsu_serial": ch["fsu_serial"],
        "state": exp["state"],
        "sector": exp["sector"], # 1: Rural, 2: Urban
        "hh_size": exp["hh_size"],
        "num_adults": demo["num_adults"],
        "num_children": demo["num_children"],
        "max_education": demo["max_education"],
        "hh_type": ch["hh_type"],
        "dwelling_type": ch["dwelling_type"],
        "cooking_fuel": ch["cooking_fuel"],
        "land_owned": ch["land_owned"],
        "weight": exp["weight"],
        "exp_food": exp["exp_food"],
        "exp_consumables": exp["exp_consumables"],
        "exp_durables": exp["exp_durables"],
        "total_exp": tot_exp,
        "mpce": mpce,
    })

df = pd.DataFrame(records)
print(f"Consolidated DataFrame shape: {df.shape}")
print(df.head(5))
print("\nSummary Statistics of Target (MPCE):")
print(df["mpce"].describe(percentiles=[0.05, 0.25, 0.5, 0.75, 0.95, 0.99]))

# Sector breakdown
for s, s_name in [(1, "Rural"), (2, "Urban")]:
    sub = df[df["sector"] == s]
    weighted_mean = np.average(sub["mpce"], weights=sub["weight"])
    print(f"\n{s_name} Sector (N={len(sub)}):")
    print(f"  Weighted Mean MPCE: ₹{weighted_mean:.2f}")
    print(f"  Unweighted Mean:   ₹{sub['mpce'].mean():.2f}")
    print(f"  Median:            ₹{sub['mpce'].median():.2f}")
    print(f"  P5 - P95:          ₹{sub['mpce'].quantile(0.05):.1f} - ₹{sub['mpce'].quantile(0.95):.1f}")
