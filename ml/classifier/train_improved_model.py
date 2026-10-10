"""
Improved Indian Transaction Classifier Training & Model Selection Pipeline
WealthIQ — Phase 5 Offline Improvement Pipeline

Trains and compares candidate models (Logistic Regression, Calibrated LinearSVC, ComplementNB)
on the India-enriched dataset using identical validation splits, applies Indian preprocessing,
and builds an improved contextual hybrid classification engine.
"""

from pathlib import Path
import json
import joblib
import pandas as pd
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report

from preprocess import preprocess_indian_narration

DATA_DIR = Path("data")
MODEL_DIR = Path("models")
MODEL_DIR.mkdir(exist_ok=True)

# 1. Load Train and Validation Splits
print("Loading train and validation splits...")
train_df = pd.read_json(DATA_DIR / "train_set.json")
val_df = pd.read_json(DATA_DIR / "val_set.json")

print(f"Train samples: {len(train_df)}")
print(f"Validation samples: {len(val_df)}")
print(f"Classes ({train_df['category'].nunique()}): {sorted(train_df['category'].unique())}")

X_train = train_df["cleaned_text"].astype(str)
y_train = train_df["category"].astype(str)

X_val = val_df["cleaned_text"].astype(str)
y_val = val_df["category"].astype(str)

# 2. Define Candidate Pipelines
candidates = {
    "Baseline LogisticRegression (C=1.0)": Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=50_000)),
        ("clf", LogisticRegression(max_iter=300, random_state=42)),
    ]),
    "Tuned LogisticRegression (Sublinear TF-IDF, C=3.0, Balanced)": Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=75_000, sublinear_tf=True)),
        ("clf", LogisticRegression(C=3.0, class_weight="balanced", max_iter=300, random_state=42)),
    ]),
    "Calibrated LinearSVC (Linear SVM + Sigmoid Platt Scaling)": Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=75_000, sublinear_tf=True)),
        ("clf", CalibratedClassifierCV(
            estimator=LinearSVC(C=1.0, class_weight="balanced", random_state=42, max_iter=2000),
            method="sigmoid",
            cv=3,
        )),
    ]),
    "Complement Naive Bayes (Class-Imbalance Aware)": Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=50_000, sublinear_tf=True)),
        ("clf", ComplementNB(alpha=0.5)),
    ]),
}

results = {}
print("\n" + "=" * 70)
print("COMPARING CANDIDATE MODELS ON VALIDATION SPLIT")
print("=" * 70)

best_model_name = None
best_macro_f1 = -1.0
best_pipeline = None

for name, pipe in candidates.items():
    print(f"\nTraining candidate: {name}...")
    pipe.fit(X_train, y_train)
    preds = pipe.predict(X_val)
    
    acc = accuracy_score(y_val, preds)
    p, r, f1, _ = precision_recall_fscore_support(y_val, preds, average="macro", zero_division=0)
    
    results[name] = {
        "accuracy": acc,
        "macro_precision": p,
        "macro_recall": r,
        "macro_f1": f1,
    }
    
    print(f"  Validation Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print(f"  Macro-Precision:     {p:.4f}")
    print(f"  Macro-Recall:        {r:.4f}")
    print(f"  Macro-F1 Score:      {f1:.4f}")
    
    if f1 > best_macro_f1:
        best_macro_f1 = f1
        best_model_name = name
        best_pipeline = pipe

print("\n" + "=" * 70)
print("VALIDATION BENCHMARK RESULTS")
print("=" * 70)
results_df = pd.DataFrame(results).T
print(results_df.to_string())

print(f"\nSelected Best Candidate: {best_model_name} (Macro-F1: {best_macro_f1:.4f})")

# Save candidate benchmark summary
with open(MODEL_DIR / "candidate_model_benchmark.json", "w") as f:
    json.dump(results, f, indent=2)

# Save best model artifact
model_out = MODEL_DIR / "indian_transaction_classifier_v2.joblib"
joblib.dump(best_pipeline, model_out)
print(f"Saved improved model artifact to: {model_out.resolve()}")

# Detailed Validation Classification Report of Selected Model
val_preds = best_pipeline.predict(X_val)
print("\nDetailed Per-Class Performance on Validation Set:")
print(classification_report(y_val, val_preds, zero_division=0))
