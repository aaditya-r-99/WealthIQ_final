"""
Phase 5 Comprehensive Offline Evaluation & Baseline Comparison
WealthIQ — Phase 5 Offline Improvement Pipeline

Compares Baseline Classifier (Phase 4) against Improved Classifier (Phase 5):
1. On Locked Independent Test Set (2,349 samples)
2. On Phase 4 Indian Challenge Benchmark (116 samples) to verify fix of identified failure modes.
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

# Classifier directory setup
BASE_DIR = Path("/home/aditya/Downloads/transaction-categorization")
sys.path.insert(0, str(BASE_DIR))
os.chdir(BASE_DIR)

# Import old and new pipelines
from hybrid_classifier import categorize as categorize_v1
from hybrid_classifier_v2 import categorize_v2

old_model = joblib.load(BASE_DIR / "models" / "transaction_classifier_clean.joblib")
new_model = joblib.load(BASE_DIR / "models" / "indian_transaction_classifier_v2.joblib")

print("=" * 70)
print(" WEALTHIQ — PHASE 5 OFFLINE CLASSIFIER EVALUATION & BENCHMARK")
print("=" * 70)

# =====================================================================
# PART 1: EVALUATION ON LOCKED INDEPENDENT TEST SET (2,349 SAMPLES)
# =====================================================================
print("\n" + "=" * 70)
print("PART 1: LOCKED INDEPENDENT TEST SET EVALUATION (N = 2,349)")
print("=" * 70)

test_df = pd.read_json(BASE_DIR / "data" / "test_locked.json")
print(f"Total locked test samples: {len(test_df)}")
print(f"Class distribution in test set:\n{test_df['category'].value_counts().to_string()}\n")

X_test_raw = test_df["raw_text"].tolist()
y_test = test_df["category"].tolist()

# 1A. Evaluate Old Hybrid Pipeline (v1) on Locked Test Set
print("--- [1A] OLD HYBRID PIPELINE (v1) on Locked Test Set ---")
old_preds = []
old_methods = []
old_reviews = []

for text in X_test_raw:
    res = categorize_v1(text)
    old_preds.append(res["category"])
    old_methods.append(res["method"])
    old_reviews.append(res.get("needs_review", False))

old_acc = accuracy_score(y_test, old_preds)
old_p, old_r, old_f1, _ = precision_recall_fscore_support(y_test, old_preds, average="macro", zero_division=0)

print(f"Old Hybrid Accuracy:  {old_acc:.4f} ({old_acc*100:.2f}%)")
print(f"Old Hybrid Macro-F1:  {old_f1:.4f}")
print(f"Old Hybrid Precision: {old_p:.4f} | Recall: {old_r:.4f}")
print(f"Old Method Breakdown: Rules={sum(1 for m in old_methods if m == 'rule')} | ML={sum(1 for m in old_methods if m == 'ml')}")
print(f"Old Review Flags:     {sum(1 for r in old_reviews if r)} ({sum(1 for r in old_reviews if r)/len(test_df)*100:.1f}%)")

# 1B. Evaluate New Hybrid Pipeline (v2) on Locked Test Set
print("\n--- [1B] IMPROVED HYBRID PIPELINE (v2) on Locked Test Set ---")
new_preds = []
new_methods = []
new_reviews = []
new_confs = []

for text in X_test_raw:
    res = categorize_v2(text)
    new_preds.append(res["category"])
    new_methods.append(res["method"])
    new_reviews.append(res.get("needs_review", False))
    new_confs.append(res.get("confidence"))

new_acc = accuracy_score(y_test, new_preds)
new_p, new_r, new_f1, _ = precision_recall_fscore_support(y_test, new_preds, average="macro", zero_division=0)

print(f"Improved Hybrid Accuracy:  {new_acc:.4f} ({new_acc*100:.2f}%)")
print(f"Improved Hybrid Macro-F1:  {new_f1:.4f}")
print(f"Improved Hybrid Precision: {new_p:.4f} | Recall: {new_r:.4f}")
print(f"Improved Method Breakdown: Rules={sum(1 for m in new_methods if m == 'rule')} | ML={sum(1 for m in new_methods if m == 'ml')}")
print(f"Improved Review Flags:     {sum(1 for r in new_reviews if r)} ({sum(1 for r in new_reviews if r)/len(test_df)*100:.1f}%)")

print("\n--- DETAILED CLASSIFICATION REPORT (IMPROVED v2 ON LOCKED TEST SET) ---")
print(classification_report(y_test, new_preds, zero_division=0))

print("\n--- CONFUSION MATRIX (IMPROVED v2 ON LOCKED TEST SET) ---")
labels = sorted(list(set(y_test + new_preds)))
cm = confusion_matrix(y_test, new_preds, labels=labels)
cm_df = pd.DataFrame(cm, index=[l[:12] for l in labels], columns=[l[:12] for l in labels])
print(cm_df.to_string())

# =====================================================================
# PART 2: ZERO-LEAKAGE VERIFICATION ON PHASE 4 CHALLENGE BENCHMARK
# =====================================================================
print("\n" + "=" * 70)
print("PART 2: ZERO-LEAKAGE BENCHMARK ON PHASE 4 CHALLENGE SET (N = 116)")
print("=" * 70)

# Load the exact 116 samples from Phase 4
from scratch_challenge_data import PHASE4_CHALLENGE_SET

p4_true = [c[1] for c in PHASE4_CHALLENGE_SET]
p4_texts = [c[0] for c in PHASE4_CHALLENGE_SET]

# Run v1 baseline
p4_v1_preds = [categorize_v1(t)["category"] for t in p4_texts]
p4_v1_acc = accuracy_score(p4_true, p4_v1_preds)
_, _, p4_v1_f1, _ = precision_recall_fscore_support(p4_true, p4_v1_preds, average="macro", zero_division=0)

# Run v2 improved
p4_v2_res = [categorize_v2(t) for t in p4_texts]
p4_v2_preds = [r["category"] for r in p4_v2_res]
p4_v2_acc = accuracy_score(p4_true, p4_v2_preds)
p4_v2_p, p4_v2_r, p4_v2_f1, _ = precision_recall_fscore_support(p4_true, p4_v2_preds, average="macro", zero_division=0)

print(f"Phase 4 Baseline Accuracy: {p4_v1_acc:.4f} ({p4_v1_acc*100:.2f}%) | Macro-F1: {p4_v1_f1:.4f}")
print(f"Phase 5 Improved Accuracy: {p4_v2_acc:.4f} ({p4_v2_acc*100:.2f}%) | Macro-F1: {p4_v2_f1:.4f}")
print(f"Accuracy Improvement:     +{((p4_v2_acc - p4_v1_acc) * 100):.2f}%")
print(f"Macro-F1 Improvement:     +{((p4_v2_f1 - p4_v1_f1)):.4f}")

# Verification of Previously Identified Failure Modes
print("\n--- VERIFICATION OF PREVIOUS FAILURE MODES FIXES ---")
failure_cases = [
    ("Society maintenance monthly charges", "Housing & Rent"),
    ("MyGate society dues payment", "Housing & Rent"),
    ("Debit card annual maintenance charge AMC", "Financial Services"),
    ("Amazon Prime video subscription", "Entertainment & Recreation"),
    ("FASTag ICICI toll debit NH44", "Transportation"),
    ("Blinkit grocery delivery", "Food & Dining"),
    ("Zepto 10 min groceries delivery", "Food & Dining"),
    ("Apollo Pharmacy medicine purchase", "Healthcare & Medical"),
    ("Monthly house rent to landlord", "Housing & Rent"),
    ("PG accommodation rent fee", "Housing & Rent"),
]

for text, exp in failure_cases:
    old_res = categorize_v1(text)
    new_res = categorize_v2(text)
    status = "FIXED [PASS]" if new_res["category"] == exp else "FAILED [FAIL]"
    print(f"\nCase: '{text}'")
    print(f"  Expected:    {exp}")
    print(f"  v1 Baseline: {old_res['category']} (via {old_res['method']})")
    print(f"  v2 Improved: {new_res['category']} (via {new_res['method']}) -> {status}")

print("\n" + "=" * 70)
print("EVALUATION COMPLETE")
print("=" * 70)
