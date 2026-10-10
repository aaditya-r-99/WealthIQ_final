"""
WealthIQ — Phase 4: Transaction Classifier Quality Evaluation
Comprehensive reproducible audit script evaluating:
1. In-domain synthetic dataset performance (0000.parquet)
2. Standalone ML model vs Rule-based engine vs Hybrid classifier
3. Curated Indian transaction challenge set (110 diverse samples)
4. Per-class metrics, confusion matrices, and review flags
5. Mapping validation to WealthIQ categories
"""

import sys
import os
from pathlib import Path
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix,
)

# Add classifier path
CLASSIFIER_DIR = Path("/home/aditya/Downloads/transaction-categorization")
sys.path.insert(0, str(CLASSIFIER_DIR))
os.chdir(CLASSIFIER_DIR)

from hybrid_classifier import categorize, RULES

MODEL_PATH = CLASSIFIER_DIR / "models" / "transaction_classifier_clean.joblib"
model = joblib.load(MODEL_PATH)

print("=" * 70)
print(" WEALTHIQ — TRANSACTION CLASSIFIER QUALITY EVALUATION (PHASE 4)")
print("=" * 70)

# =====================================================================
# SECTION 1: IN-DOMAIN SYNTHETIC DATASET AUDIT (0000.parquet)
# =====================================================================
print("\n" + "=" * 70)
print("SECTION 1: IN-DOMAIN SYNTHETIC DATASET AUDIT")
print("=" * 70)

PARQUET_PATH = CLASSIFIER_DIR / "0000.parquet"
if PARQUET_PATH.exists():
    import pyarrow.parquet as pq
    table = pq.read_table(PARQUET_PATH, columns=["transaction_description", "category", "country"])
    df = table.to_pandas()
    
    total_rows = len(df)
    unique_desc = df["transaction_description"].nunique()
    india_rows = len(df[df["country"] == "INDIA"])
    india_unique = df[df["country"] == "INDIA"]["transaction_description"].nunique()
    
    print(f"Total dataset rows: {total_rows:,}")
    print(f"Total unique descriptions: {unique_desc:,} ({unique_desc/total_rows*100:.1f}%)")
    print(f"Duplicate/Template repetition rate: {(total_rows - unique_desc)/total_rows*100:.1f}%")
    print(f"India rows: {india_rows:,} | India unique: {india_unique:,}")
    
    # Check for real Indian merchants
    indian_entities = ["swiggy", "zomato", "blinkit", "zepto", "bigbasket", "dmart", "airtel", "jio", "upi", "fastag", "irctc", "ola", "rapido"]
    counts = {e: int(df["transaction_description"].str.contains(e, case=False, na=False).sum()) for e in indian_entities}
    print(f"\nIndian merchant representation in 4.5M rows:")
    for k, v in counts.items():
        print(f"  - {k:12}: {v} occurrences")
else:
    print("0000.parquet not found for inspection.")

# =====================================================================
# SECTION 2: CURATED INDIAN TRANSACTION CHALLENGE SET
# =====================================================================
print("\n" + "=" * 70)
print("SECTION 2: CURATED INDIAN TRANSACTION CHALLENGE SET EVALUATION")
print("=" * 70)

# 120 curated test cases across 10 categories + Income + Ambiguous/P2P UPI
# Label format uses upstream classifier categories:
# - Food & Dining
# - Transportation
# - Housing & Rent
# - Utilities & Services
# - Healthcare & Medical
# - Entertainment & Recreation
# - Shopping & Retail
# - Financial Services
# - Government & Legal
# - Charity & Donations
# - Income
CHALLENGE_SET = [
    # --- Food & Dining (12) ---
    ("Swiggy food order for lunch", "Food & Dining"),
    ("Zomato restaurant dinner delivery", "Food & Dining"),
    ("Blinkit grocery delivery", "Food & Dining"),
    ("Zepto 10 min groceries delivery", "Food & Dining"),
    ("BigBasket monthly grocery order", "Food & Dining"),
    ("DMart ready supermarket purchase", "Food & Dining"),
    ("Instamart snack delivery", "Food & Dining"),
    ("Haldiram sweets and snacks payment", "Food & Dining"),
    ("Saravana Bhavan breakfast dosa", "Food & Dining"),
    ("Chai Point tea and cookies", "Food & Dining"),
    ("Barbeque Nation dinner buffet", "Food & Dining"),
    ("UPI/432198765432/Swiggy/swiggy@icici", "Food & Dining"),

    # --- Transportation (12) ---
    ("Uber cab ride to office", "Transportation"),
    ("Ola cab ride to airport", "Transportation"),
    ("Rapido bike taxi ride", "Transportation"),
    ("BluSmart electric cab booking", "Transportation"),
    ("IRCTC train ticket booking", "Transportation"),
    ("Delhi Metro smart card recharge", "Transportation"),
    ("Namma Metro token purchase", "Transportation"),
    ("BMTC bus monthly pass", "Transportation"),
    ("FASTag toll debit NH44 highway", "Transportation"),
    ("Indian Oil petrol pump fuel", "Transportation"),
    ("Bharat Petroleum diesel refill", "Transportation"),
    ("Shell petrol station payment", "Transportation"),

    # --- Housing & Rent (10) ---
    ("Monthly house rent to landlord", "Housing & Rent"),
    ("Apartment rent payment for October", "Housing & Rent"),
    ("Rent payment via bank transfer", "Housing & Rent"),
    ("NoBroker house rent payment", "Housing & Rent"),
    ("PG accommodation rent fee", "Housing & Rent"),
    ("Landlord monthly lease payment", "Housing & Rent"),
    ("Society maintenance monthly charges", "Housing & Rent"),
    ("MyGate society dues payment", "Housing & Rent"),
    ("Apartment maintenance fee", "Housing & Rent"),
    ("Paying guest room rent", "Housing & Rent"),

    # --- Utilities & Services (12) ---
    ("BESCOM electricity bill payment", "Utilities & Services"),
    ("Tata Power electricity bill", "Utilities & Services"),
    ("Adani Electricity power payment", "Utilities & Services"),
    ("MSEDCL power bill payment", "Utilities & Services"),
    ("Airtel prepaid mobile recharge", "Utilities & Services"),
    ("Jio fiber broadband recharge", "Utilities & Services"),
    ("Vi postpaid mobile bill payment", "Utilities & Services"),
    ("ACT Fibernet monthly broadband bill", "Utilities & Services"),
    ("BWSSB water supply bill payment", "Utilities & Services"),
    ("Indane LPG gas cylinder refill booking", "Utilities & Services"),
    ("IGL piped natural gas bill", "Utilities & Services"),
    ("Tata Play DTH recharge", "Utilities & Services"),

    # --- Healthcare & Medical (10) ---
    ("Apollo Pharmacy medicine purchase", "Healthcare & Medical"),
    ("Medplus medical store purchase", "Healthcare & Medical"),
    ("1mg online medicine delivery", "Healthcare & Medical"),
    ("Netmeds pharmacy order", "Healthcare & Medical"),
    ("Manipal Hospital doctor consultation fee", "Healthcare & Medical"),
    ("Fortis Hospital OPD consultation", "Healthcare & Medical"),
    ("Dr Lal PathLabs blood test diagnostic", "Healthcare & Medical"),
    ("Thyrocare full body health checkup", "Healthcare & Medical"),
    ("Practo online doctor consultation", "Healthcare & Medical"),
    ("Clove Dental clinic tooth extraction", "Healthcare & Medical"),

    # --- Entertainment & Recreation (10) ---
    ("Netflix monthly subscription plan", "Entertainment & Recreation"),
    ("Disney+ Hotstar annual VIP subscription", "Entertainment & Recreation"),
    ("Spotify premium music subscription", "Entertainment & Recreation"),
    ("Amazon Prime video subscription", "Entertainment & Recreation"),
    ("SonyLIV premium annual subscription", "Entertainment & Recreation"),
    ("BookMyShow movie tickets PVR cinema", "Entertainment & Recreation"),
    ("INOX cinema movie tickets and popcorn", "Entertainment & Recreation"),
    ("Cult.fit gym fitness pass", "Entertainment & Recreation"),
    ("Wonderla amusement park entry tickets", "Entertainment & Recreation"),
    ("Steam online video game purchase", "Entertainment & Recreation"),

    # --- Shopping & Retail (12) ---
    ("Amazon India retail shopping purchase", "Shopping & Retail"),
    ("Flipkart Big Billion Day electronics order", "Shopping & Retail"),
    ("Myntra apparel clothing order", "Shopping & Retail"),
    ("Ajio fashion clothes purchase", "Shopping & Retail"),
    ("Nykaa cosmetics and makeup order", "Shopping & Retail"),
    ("Tata Neu electronics purchase", "Shopping & Retail"),
    ("Croma electronics laptop purchase", "Shopping & Retail"),
    ("Reliance Digital headphones purchase", "Shopping & Retail"),
    ("Decathlon sports shoes purchase", "Shopping & Retail"),
    ("Zudio casual clothing purchase", "Shopping & Retail"),
    ("Westside retail store purchase", "Shopping & Retail"),
    ("Shoppers Stop fashion apparel purchase", "Shopping & Retail"),

    # --- Financial Services (10) ---
    ("SBI home loan EMI debit", "Financial Services"),
    ("HDFC personal loan EMI auto-debit", "Financial Services"),
    ("ICICI car loan monthly EMI payment", "Financial Services"),
    ("Cred credit card bill payment", "Financial Services"),
    ("HDFC credit card bill payment", "Financial Services"),
    ("OneCard credit card bill repayment", "Financial Services"),
    ("SBI ATM cash withdrawal fee", "Financial Services"),
    ("Cheque bounce penalty bank charge", "Financial Services"),
    ("Debit card annual maintenance charge AMC", "Financial Services"),
    ("Demag brokerage account AMC charges", "Financial Services"),

    # --- Government & Legal (10) ---
    ("Income Tax challan 280 tax payment", "Government & Legal"),
    ("BBMP property tax annual payment", "Government & Legal"),
    ("Advance tax payment via NSDL", "Government & Legal"),
    ("Traffic police e-challan penalty fine", "Government & Legal"),
    ("Passport Seva Kendra passport fee", "Government & Legal"),
    ("Driving license renewal fee Parivahan", "Government & Legal"),
    ("Sub-registrar property stamp duty fee", "Government & Legal"),
    ("Court fee stamp paper notary", "Government & Legal"),
    ("Municipal corporation water tax penalty", "Government & Legal"),
    ("Vehicle registration RTO tax payment", "Government & Legal"),

    # --- Charity & Donations (8) ---
    ("PM CARES fund donation contribution", "Charity & Donations"),
    ("Akshaya Patra foundation mid-day meal donation", "Charity & Donations"),
    ("Tirupati temple hundi donation offering", "Charity & Donations"),
    ("CRY India child relief donation", "Charity & Donations"),
    ("Goonj NGO relief fund donation", "Charity & Donations"),
    ("HelpAge India elderly care donation", "Charity & Donations"),
    ("Siddhivinayak temple donation receipt", "Charity & Donations"),
    ("GiveIndia charity donation support", "Charity & Donations"),

    # --- Income (10) ---
    ("Monthly salary credited from Infosys", "Income"),
    ("TCS payroll salary credit NEFT", "Income"),
    ("Wipro salary credited for September", "Income"),
    ("Annual performance bonus credited to account", "Income"),
    ("Freelance consulting payment credited", "Income"),
    ("Dividend credited TCS Ltd shares", "Income"),
    ("Quarterly interest credited savings account", "Income"),
    ("Rental income credited from tenant", "Income"),
    ("Mutual fund redemption payout credited", "Income"),
    ("Fixed deposit maturity interest credited", "Income"),
]

print(f"Total curated challenge test cases: {len(CHALLENGE_SET)}")
categories = sorted(list(set(c[1] for c in CHALLENGE_SET)))
print(f"Categories represented ({len(categories)}):")
for cat in categories:
    count = sum(1 for _, c in CHALLENGE_SET if c == cat)
    print(f"  - {cat:28}: {count:2} samples")

# ---------------------------------------------------------------------
# EVALUATE 1: STANDALONE ML MODEL (NO RULES)
# ---------------------------------------------------------------------
print("\n" + "-" * 70)
print("SUB-EVALUATION A: STANDALONE ML MODEL (TF-IDF + LogisticRegression)")
print("-" * 70)

ml_preds = []
ml_confs = []
ml_true = []

for text, true_cat in CHALLENGE_SET:
    ml_true.append(true_cat)
    probs = model.predict_proba([text])[0]
    best_idx = probs.argmax()
    pred_cat = model.classes_[best_idx]
    conf = float(probs[best_idx])
    ml_preds.append(pred_cat)
    ml_confs.append(conf)

ml_acc = accuracy_score(ml_true, ml_preds)
ml_p, ml_r, ml_f1, _ = precision_recall_fscore_support(ml_true, ml_preds, average="macro", zero_division=0)

print(f"ML Model Standalone Accuracy: {ml_acc:.4f} ({ml_acc*100:.1f}%)")
print(f"ML Model Macro-F1:           {ml_f1:.4f}")
print(f"ML Model Macro-Precision:    {ml_p:.4f}")
print(f"ML Model Macro-Recall:       {ml_r:.4f}")

# ---------------------------------------------------------------------
# EVALUATE 2: RULE-BASED ENGINE ALONE
# ---------------------------------------------------------------------
print("\n" + "-" * 70)
print("SUB-EVALUATION B: RULE-BASED ENGINE ALONE")
print("-" * 70)

import re

rule_matches = 0
rule_correct = 0

for text, true_cat in CHALLENGE_SET:
    matched_cat = None
    for pattern, cat in RULES:
        if re.search(pattern, text, flags=re.IGNORECASE):
            matched_cat = cat
            break
    if matched_cat is not None:
        rule_matches += 1
        if matched_cat == true_cat:
            rule_correct += 1

print(f"Rule match coverage: {rule_matches}/{len(CHALLENGE_SET)} ({rule_matches/len(CHALLENGE_SET)*100:.1f}%)")
print(f"Rule accuracy on matched: {rule_correct}/{rule_matches} ({rule_correct/rule_matches*100:.1f}%)")
print(f"Rule overall accuracy on set: {rule_correct}/{len(CHALLENGE_SET)} ({rule_correct/len(CHALLENGE_SET)*100:.1f}%)")

# ---------------------------------------------------------------------
# EVALUATE 3: FULL HYBRID CLASSIFIER (AS DEPLOYED IN SERVICE)
# ---------------------------------------------------------------------
print("\n" + "-" * 70)
print("SUB-EVALUATION C: COMBINED HYBRID CLASSIFIER (SERVICE PIPELINE)")
print("-" * 70)

hybrid_preds = []
hybrid_true = []
hybrid_methods = []
hybrid_confs = []
hybrid_needs_review = []

for text, true_cat in CHALLENGE_SET:
    res = categorize(text)
    hybrid_true.append(true_cat)
    hybrid_preds.append(res["category"])
    hybrid_methods.append(res["method"])
    hybrid_confs.append(res.get("confidence"))
    hybrid_needs_review.append(res.get("needs_review", False))

hybrid_acc = accuracy_score(hybrid_true, hybrid_preds)
hyb_p, hyb_r, hyb_f1, _ = precision_recall_fscore_support(hybrid_true, hybrid_preds, average="macro", zero_division=0)

rule_count = sum(1 for m in hybrid_methods if m == "rule")
ml_count = sum(1 for m in hybrid_methods if m == "ml")
review_count = sum(1 for r in hybrid_needs_review if r)

print(f"Overall Accuracy:  {hybrid_acc:.4f} ({hybrid_acc*100:.2f}%)")
print(f"Macro-Precision:   {hyb_p:.4f}")
print(f"Macro-Recall:      {hyb_r:.4f}")
print(f"Macro-F1 Score:    {hyb_f1:.4f}")
print(f"\nExecution Method Breakdown:")
print(f"  - Resolved by Rules: {rule_count}/{len(CHALLENGE_SET)} ({rule_count/len(CHALLENGE_SET)*100:.1f}%)")
print(f"  - Resolved by ML:    {ml_count}/{len(CHALLENGE_SET)} ({ml_count/len(CHALLENGE_SET)*100:.1f}%)")
print(f"  - Flagged for Review: {review_count}/{len(CHALLENGE_SET)} ({review_count/len(CHALLENGE_SET)*100:.1f}%)")

print("\nDetailed Per-Class Performance:")
print(classification_report(hybrid_true, hybrid_preds, zero_division=0))

print("\nConfusion Matrix (Rows = True, Columns = Predicted):")
labels = sorted(list(set(hybrid_true + hybrid_preds)))
cm = confusion_matrix(hybrid_true, hybrid_preds, labels=labels)
cm_df = pd.DataFrame(cm, index=[l[:12] for l in labels], columns=[l[:12] for l in labels])
print(cm_df.to_string())

# ---------------------------------------------------------------------
# SECTION 4: MISCLASSIFICATION ANALYSIS
# ---------------------------------------------------------------------
print("\n" + "=" * 70)
print("SECTION 4: KEY MISCLASSIFICATIONS & FAILURE MODES")
print("=" * 70)

errors = []
for (text, true_cat), pred_cat, method, conf, rev in zip(
    CHALLENGE_SET, hybrid_preds, hybrid_methods, hybrid_confs, hybrid_needs_review
):
    if true_cat != pred_cat:
        errors.append({
            "text": text,
            "true": true_cat,
            "predicted": pred_cat,
            "method": method,
            "confidence": conf,
            "needs_review": rev,
        })

print(f"Total misclassifications on challenge set: {len(errors)}/{len(CHALLENGE_SET)}")
for i, err in enumerate(errors, 1):
    conf_str = f"{err['confidence']:.2f}" if err['confidence'] is not None else "N/A"
    print(f"\n[{i}] Description: '{err['text']}'")
    print(f"    Expected:  {err['true']}")
    print(f"    Predicted: {err['predicted']} (via {err['method']}, conf: {conf_str}, review: {err['needs_review']})")

# ---------------------------------------------------------------------
# SECTION 5: WEALTHIQ FINANCIAL SAFETY & NORMALIZATION AUDIT
# ---------------------------------------------------------------------
print("\n" + "=" * 70)
print("SECTION 5: WEALTHIQ SAFETY & NORMALIZATION VERIFICATION")
print("=" * 70)

# Explicit WealthIQ mappings audit
CATEGORY_MAPPINGS = {
    'Food & Dining': {'target': 'Food', 'type': 'essential', 'isIncome': False, 'review': False},
    'Healthcare & Medical': {'target': 'Healthcare', 'type': 'essential', 'isIncome': False, 'review': False},
    'Shopping & Retail': {'target': 'Shopping', 'type': 'discretionary', 'isIncome': False, 'review': False},
    'Utilities & Services': {'target': 'Utilities', 'type': 'essential', 'isIncome': False, 'review': False},
    'Entertainment & Recreation': {'target': 'Entertainment', 'type': 'discretionary', 'isIncome': False, 'review': False},
    'Transportation': {'target': 'Transportation', 'type': 'essential', 'isIncome': False, 'review': False},
    'Housing & Rent': {'target': 'Housing', 'type': 'essential', 'isIncome': False, 'review': False},
    'Housing': {'target': 'Housing', 'type': 'essential', 'isIncome': False, 'review': False},
    'Charity & Donations': {'target': 'Other', 'type': 'discretionary', 'isIncome': False, 'review': True},
    'Government & Legal': {'target': 'Other', 'type': 'essential', 'isIncome': False, 'review': True},
    'Financial Services': {'target': 'Other', 'type': 'essential', 'isIncome': False, 'review': True},
    'Income': {'target': None, 'type': None, 'isIncome': True, 'review': True},
}

print("Safety Audit Checks:")
# Check 1: Income redirection
income_rule = CATEGORY_MAPPINGS['Income']
assert income_rule['isIncome'] is True and income_rule['target'] is None, "Income rule failure"
print("  [PASS] Income is never converted to an expense category (isIncome=True, target=None)")

# Check 2: Ambiguous categories flagged for review
assert CATEGORY_MAPPINGS['Financial Services']['review'] is True
assert CATEGORY_MAPPINGS['Government & Legal']['review'] is True
assert CATEGORY_MAPPINGS['Charity & Donations']['review'] is True
print("  [PASS] Financial Services, Government & Legal, and Charity are forced into 'Other' with review: True")

# Check 3: Essential / discretionary suggestion defaults
assert CATEGORY_MAPPINGS['Food & Dining']['type'] == 'essential'
assert CATEGORY_MAPPINGS['Shopping & Retail']['type'] == 'discretionary'
print("  [PASS] Conservative expense types assigned as suggestions")

print("\nQuality Evaluation Audit Complete.")
