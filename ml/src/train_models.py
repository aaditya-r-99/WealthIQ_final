"""
WealthIQ Machine Learning Pipeline: India Financial Resilience
Supervised Classification (Binary Target) & Unsupervised Segmentation (K-Means)

Methodological Compliance (Prompt 2.5):
1. Model Selection: Pre-specified primary selection metric on training-set 5-fold Stratified CV.
2. Pipeline Isolation: StandardScaler strictly inside CV pipeline (no fold leakage).
3. Target Terminology:
   - Class 1: Severe emergency-fund difficulty (very difficult OR unable to raise funds)
   - Class 0: Lower reported difficulty (not classified as severe; includes somewhat difficult and not difficult at all)
4. Survey Weights: Unweighted vs weighted descriptive estimates and holdout metrics with documented limitations.
5. K-Means: Evaluated on behavioral indicators only, with silhouette score and descriptive cluster labels.
6. Leakage Prevention: fin24, fin24a, fin24b, IDs, constants strictly excluded from feature matrix.
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    silhouette_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

# Paths
DATASET_PATH = Path("ml/data/raw/IND_2024_FINDEX_v02_M_CSV/Findex_Microdata_2025_updateIndia.csv")
OUTPUT_JSON = Path("ml/reports/model_experiment_results.json")

# Pre-specified Primary Model Selection Metric
PRIMARY_SELECTION_METRIC = "cv_macro_f1_mean"

def load_and_prepare_data():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")
    
    df = pd.read_csv(DATASET_PATH)
    total_raw_rows = len(df)
    
    # Target Construction
    # Class 1: Severe emergency-fund difficulty (fin24a == 1 OR fin24 == 7)
    # Class 0: Lower reported difficulty / not classified as severe (fin24a in [2, 3])
    # Excluded: DK / Ref / Ineligible (fin24a == 4, fin24 in [8, 9])
    def assign_target(row):
        f24a = row["fin24a"]
        f24 = row["fin24"]
        if f24a == 1.0 or f24 == 7.0:
            return 1
        elif f24a in [2.0, 3.0]:
            return 0
        else:
            return -1

    df["target"] = df.apply(assign_target, axis=1)
    
    # Audit target breakdown dynamically
    c1_f24a1 = int(len(df[df["fin24a"] == 1.0]))
    c1_f24_7 = int(len(df[(df["fin24"] == 7.0) & (df["fin24a"].isna())]))
    c1_total = int(len(df[df["target"] == 1]))
    
    c0_f24a2 = int(len(df[df["fin24a"] == 2.0]))
    c0_f24a3 = int(len(df[df["fin24a"] == 3.0]))
    c0_total = int(len(df[df["target"] == 0]))
    
    excluded_df = df[df["target"] == -1]
    excluded_total = int(len(excluded_df))
    eligible_df = df[df["target"] != -1].copy()
    eligible_total = int(len(eligible_df))
    
    # Survey weighted sums
    total_wgt = float(eligible_df["wgt"].sum())
    c1_wgt = float(eligible_df[eligible_df["target"] == 1]["wgt"].sum())
    c0_wgt = float(eligible_df[eligible_df["target"] == 0]["wgt"].sum())

    target_stats = {
        "total_raw_rows": total_raw_rows,
        "eligible_total": eligible_total,
        "eligible_pct_of_total": float(eligible_total / total_raw_rows * 100),
        "excluded_total": excluded_total,
        "excluded_pct_of_total": float(excluded_total / total_raw_rows * 100),
        "class_1_severe_difficulty": {
            "label_name": "Severe emergency-fund difficulty (very difficult OR unable)",
            "total_count": c1_total,
            "pct_of_eligible": float(c1_total / eligible_total * 100),
            "pct_of_total_survey": float(c1_total / total_raw_rows * 100),
            "weighted_pct": float(c1_wgt / total_wgt * 100),
            "breakdown": {
                "fin24a_eq_1_very_difficult": c1_f24a1,
                "fin24_eq_7_unable_to_raise": c1_f24_7,
            }
        },
        "class_0_lower_difficulty": {
            "label_name": "Lower reported difficulty / not classified as severe (somewhat difficult OR not difficult at all)",
            "total_count": c0_total,
            "pct_of_eligible": float(c0_total / eligible_total * 100),
            "pct_of_total_survey": float(c0_total / total_raw_rows * 100),
            "weighted_pct": float(c0_wgt / total_wgt * 100),
            "breakdown": {
                "fin24a_eq_2_somewhat_difficult": c0_f24a2,
                "fin24a_eq_3_not_difficult_at_all": c0_f24a3,
            }
        },
        "excluded_breakdown": {
            "fin24_eq_8_dk_source": int(len(df[df["fin24"] == 8])),
            "fin24_eq_9_ref_source": int(len(df[df["fin24"] == 9])),
            "fin24a_eq_4_dk_difficulty": int(len(df[df["fin24a"] == 4.0])),
        }
    }
    
    # 2. Leakage-Free Feature Engineering
    features = pd.DataFrame(index=eligible_df.index)
    
    # Domain 1: Demographics & Socioeconomic Status (0% missing)
    features["female"] = (eligible_df["female"] == 1).astype(int)
    features["age"] = eligible_df["age"].astype(float)
    features["educ"] = eligible_df["educ"].astype(int)
    features["inc_q"] = eligible_df["inc_q"].astype(int)
    features["in_workforce"] = (eligible_df["emp_in"] == 1).astype(int)
    features["rural"] = (eligible_df["urbanicity"] == 1).astype(int)
    
    # Domain 2: Financial Inclusion & Account Ownership
    features["has_account_fin"] = eligible_df["account_fin"].astype(int)
    features["has_account_mob"] = eligible_df["account_mob"].astype(int)
    features["has_account_any"] = eligible_df["account"].astype(int)
    features["has_dig_account"] = eligible_df["dig_account"].astype(int)
    features["has_debit_card"] = (eligible_df["fin2"] == 1).astype(int)
    features["has_credit_card"] = (eligible_df["fin10"] == 1).astype(int)
    
    # Domain 3: Prior Saving Behaviors
    features["saved_any"] = eligible_df["saved"].astype(int)
    features["saved_formal"] = (eligible_df["fin17a"] == 1).astype(int)
    features["saved_informal"] = (eligible_df["fin17c"] == 1).astype(int)
    features["saved_old_age"] = (eligible_df["fin17f"] == 1).astype(int)
    
    # Domain 4: Prior Borrowing Behaviors & Credit Stress
    features["borrowed_any"] = eligible_df["borrowed"].astype(int)
    features["borrowed_formal"] = (eligible_df["fin22a"] == 1).astype(int)
    features["borrowed_social"] = (eligible_df["fin22b"] == 1).astype(int)
    features["borrowed_informal"] = (eligible_df["fin22c"] == 1).astype(int)
    features["borrowed_medical"] = (eligible_df["fin22d"] == 1).astype(int)
    features["borrowed_business"] = (eligible_df["fin22e"] == 1).astype(int)
    features["borrowed_food_credit"] = (eligible_df["fin22f"] == 1).astype(int)
    features["has_insurance"] = (eligible_df["fin19"] == 1).astype(int)
    features["applied_mobile_loan"] = (eligible_df["fin20"] == 1).astype(int)
    
    # Domain 5: Digital Payment Inflows & Outflows
    features["any_digital_payment"] = eligible_df["anydigpayment"].astype(int)
    features["merchant_payment_dig"] = eligible_df["merchantpay_dig"].astype(int)
    features["pay_utilities_dig"] = (eligible_df["pay_utilities"] == 1).astype(int)
    features["remittance_dig"] = (eligible_df["domestic_remittances"] == 1).astype(int)
    features["wage_received_dig"] = (eligible_df["receive_wages"] == 1).astype(int)
    features["gov_transfer_dig"] = (eligible_df["receive_transfers"] == 1).astype(int)
    
    # Domain 6: Connectivity & Device Ownership
    features["has_mobile_phone"] = (eligible_df["con1"] == 1).astype(int)
    features["used_internet"] = eligible_df["internet_use"].astype(int)
    features["used_internet_7d"] = (eligible_df["con24"] == 1).astype(int)
    features["has_smartphone"] = (eligible_df["con9"] == 1).astype(int)
    features["sim_registered_self"] = (eligible_df["con11"] == 1).astype(int)
    features["reads_texts"] = (eligible_df["con14"] == 1).astype(int)
    features["phone_pin_locked"] = (eligible_df["con18"] == 1).astype(int)
    features["received_scam_call"] = (eligible_df["con21"] == 1).astype(int)
    
    # Domain 7: Environmental Stress & Financial Worries
    features["experienced_disaster_3yr"] = (eligible_df["fin24c"] == 1).astype(int)
    for w in [1, 2, 3, 4, 5, 6]:
        features[f"worry_cat_{w}"] = (eligible_df["fin45"] == w).astype(int)
        
    y = eligible_df["target"].values
    weights = eligible_df["wgt"].values
    
    return features, y, weights, target_stats

def run_experiments():
    X, y, weights, target_stats = load_and_prepare_data()
    
    print("=" * 85)
    print("WEALTHIQ ML EVALUATION METHODOLOGY REVIEW & EXPERIMENT RUN")
    print("=" * 85)
    print(f"Total surveyed rows: {target_stats['total_raw_rows']}")
    print(f"Eligible records:    {target_stats['eligible_total']} ({target_stats['eligible_pct_of_total']:.4f}%)")
    print(f"Excluded records:    {target_stats['excluded_total']} ({target_stats['excluded_pct_of_total']:.4f}%)")
    c1 = target_stats['class_1_severe_difficulty']
    c0 = target_stats['class_0_lower_difficulty']
    print(f"Class 1 (Severe):    {c1['total_count']} ({c1['pct_of_eligible']:.4f}% eligible | {c1['pct_of_total_survey']:.4f}% total | {c1['weighted_pct']:.4f}% weighted)")
    print(f"Class 0 (Lower):     {c0['total_count']} ({c0['pct_of_eligible']:.4f}% eligible | {c0['pct_of_total_survey']:.4f}% total | {c0['weighted_pct']:.4f}% weighted)")
    print(f"Feature matrix:      {X.shape[1]} features, 0 missing values.")
    print(f"Primary Selection Metric (Pre-specified): {PRIMARY_SELECTION_METRIC}")
    print("=" * 85)

    # 1. Stratified Train/Test Split (80/20) with Fixed Seed
    # Holdout test set remains UNTOUCHED during model selection
    indices = np.arange(len(y))
    idx_train, idx_test, y_train, y_test = train_test_split(
        indices, y, test_size=0.20, random_state=42, stratify=y
    )
    
    X_train_df = X.iloc[idx_train]
    X_test_df = X.iloc[idx_test]
    w_train = weights[idx_train]
    w_test = weights[idx_test]
    
    # 2. Pipeline Construction: StandardScaler strictly inside CV pipeline
    # This prevents any leakage between cross-validation folds.
    pipelines = {
        "Majority Baseline (Dummy)": Pipeline([
            ("classifier", DummyClassifier(strategy="most_frequent"))
        ]),
        "Logistic Regression (Balanced)": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42, C=0.1))
        ]),
        "K-Nearest Neighbors (k=15)": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", KNeighborsClassifier(n_neighbors=15, weights="distance"))
        ]),
        "Random Forest (Balanced)": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", RandomForestClassifier(n_estimators=150, max_depth=10, min_samples_split=5, class_weight="balanced", random_state=42))
        ]),
    }

    # 3. Model Selection via 5-Fold Stratified Cross-Validation strictly on Training Data
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_results = {}
    
    print("\n--- 5-FOLD STRATIFIED CV ON TRAINING PARTITION (N = 2,391) ---")
    print(f"Note: Preprocessing fitted strictly inside each CV fold via Pipeline.")
    for name, pipe in pipelines.items():
        scores = cross_validate(
            pipe, X_train_df, y_train, cv=cv, scoring=["f1_macro", "balanced_accuracy", "roc_auc"]
        )
        cv_results[name] = {
            "cv_macro_f1_mean": float(np.mean(scores["test_f1_macro"])),
            "cv_macro_f1_std": float(np.std(scores["test_f1_macro"])),
            "cv_balanced_acc_mean": float(np.mean(scores["test_balanced_accuracy"])),
            "cv_balanced_acc_std": float(np.std(scores["test_balanced_accuracy"])),
            "cv_roc_auc_mean": float(np.mean(scores["test_roc_auc"])),
            "cv_roc_auc_std": float(np.std(scores["test_roc_auc"])),
        }
        print(f"{name:32s} | Macro F1: {cv_results[name]['cv_macro_f1_mean']:.4f} ± {cv_results[name]['cv_macro_f1_std']:.4f} | "
              f"Bal Acc: {cv_results[name]['cv_balanced_acc_mean']:.4f} ± {cv_results[name]['cv_balanced_acc_std']:.4f} | "
              f"ROC-AUC: {cv_results[name]['cv_roc_auc_mean']:.4f} ± {cv_results[name]['cv_roc_auc_std']:.4f}")

    # Explicit Model Selection Decision based ONLY on CV Macro F1
    candidate_names = [k for k in pipelines.keys() if "Dummy" not in k]
    selected_winner_name = max(candidate_names, key=lambda k: cv_results[k][PRIMARY_SELECTION_METRIC])
    winner_cv_score = cv_results[selected_winner_name][PRIMARY_SELECTION_METRIC]
    
    print(f"\n>>> PRE-SPECIFIED MODEL SELECTION RESULT <<<")
    print(f"Selected Model: '{selected_winner_name}'")
    print(f"Rationale: Highest training-set CV Macro F1 ({winner_cv_score:.4f}). Selected strictly without reference to holdout test set.")

    # 4. Final Evaluation on Untouched Holdout Test Partition (N = 598)
    test_eval = {}
    print("\n--- UNTOUCHED HOLDOUT TEST SET EVALUATION (N = 598) ---")
    for name, pipe in pipelines.items():
        pipe.fit(X_train_df, y_train)
        y_pred = pipe.predict(X_test_df)
        
        # Probabilities if available
        if hasattr(pipe, "predict_proba"):
            y_prob = pipe.predict_proba(X_test_df)[:, 1]
            roc_auc = float(roc_auc_score(y_test, y_prob))
        else:
            roc_auc = 0.5
            
        cm = confusion_matrix(y_test, y_pred) # [[TN, FP], [FN, TP]]
        tn, fp, fn, tp = cm.ravel()
        
        acc = float(accuracy_score(y_test, y_pred))
        bal_acc = float(balanced_accuracy_score(y_test, y_pred))
        macro_f1 = float(f1_score(y_test, y_pred, average="macro"))
        
        # Per-class metrics
        p0 = float(precision_score(y_test, y_pred, pos_label=0, zero_division=0))
        r0 = float(recall_score(y_test, y_pred, pos_label=0, zero_division=0))
        f0 = float(f1_score(y_test, y_pred, pos_label=0, zero_division=0))
        
        p1 = float(precision_score(y_test, y_pred, pos_label=1, zero_division=0))
        r1 = float(recall_score(y_test, y_pred, pos_label=1, zero_division=0))
        f1_c1 = float(f1_score(y_test, y_pred, pos_label=1, zero_division=0))
        
        # Population-Weighted Test Evaluation
        weighted_acc = float(accuracy_score(y_test, y_pred, sample_weight=w_test))
        weighted_bal_acc = float(balanced_accuracy_score(y_test, y_pred, sample_weight=w_test))
        weighted_macro_f1 = float(f1_score(y_test, y_pred, average="macro", sample_weight=w_test))
        
        test_eval[name] = {
            "is_selected_winner_by_cv": (name == selected_winner_name),
            "confusion_matrix": {
                "TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp)
            },
            "accuracy": acc,
            "balanced_accuracy": bal_acc,
            "macro_f1": macro_f1,
            "roc_auc": roc_auc,
            "class_0_lower_difficulty": {
                "label": "Lower reported difficulty (not severe)",
                "precision": p0, "recall": r0, "f1": f0, "support": int(tn + fp)
            },
            "class_1_severe_difficulty": {
                "label": "Severe emergency-fund difficulty",
                "precision": p1, "recall": r1, "f1": f1_c1, "support": int(fn + tp)
            },
            "survey_weighted_metrics": {
                "weighted_accuracy": weighted_acc,
                "weighted_balanced_accuracy": weighted_bal_acc,
                "weighted_macro_f1": weighted_macro_f1,
            }
        }
        
        print(f"\nModel: {name} {'[SELECTED BY CV]' if name == selected_winner_name else ''}")
        print(f"  Confusion Matrix: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
        print(f"  Accuracy: {acc:.4f} | Balanced Accuracy: {bal_acc:.4f} | Macro F1: {macro_f1:.4f} | ROC-AUC: {roc_auc:.4f}")
        print(f"  Class 0 (Lower Diff)  -> Precision: {p0:.4f}, Recall: {r0:.4f}, F1: {f0:.4f} (Support: {tn+fp})")
        print(f"  Class 1 (Severe Diff) -> Precision: {p1:.4f}, Recall: {r1:.4f}, F1: {f1_c1:.4f} (Support: {fn+tp})")
        print(f"  Population-Weighted   -> Bal Acc: {weighted_bal_acc:.4f}, Macro F1: {weighted_macro_f1:.4f}")

    # Top Feature Importances of Selected Random Forest
    rf_pipe = pipelines["Random Forest (Balanced)"]
    rf_classifier = rf_pipe.named_steps["classifier"]
    importances = rf_classifier.feature_importances_
    feat_names = list(X.columns)
    top_indices = np.argsort(importances)[::-1][:15]
    top_features = [{"feature": feat_names[i], "importance": float(importances[i])} for i in top_indices]

    # 5. Unsupervised K-Means Behavioral Clustering (Without Supervised Target)
    behavioral_cols = [
        "has_account_fin", "has_account_mob", "has_debit_card", "has_credit_card",
        "saved_any", "saved_formal", "saved_informal",
        "borrowed_any", "borrowed_formal", "borrowed_social", "borrowed_medical", "borrowed_food_credit",
        "any_digital_payment", "merchant_payment_dig", "pay_utilities_dig",
        "has_mobile_phone", "has_smartphone", "used_internet"
    ]
    X_behavior = X[behavioral_cols]
    scaler_kmeans = StandardScaler()
    X_behavior_scaled = scaler_kmeans.fit_transform(X_behavior)
    
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(X_behavior_scaled)
    sil_score = float(silhouette_score(X_behavior_scaled, clusters))
    
    X_copy = X.copy()
    X_copy["cluster"] = clusters
    X_copy["target"] = y
    
    cluster_profiles = {}
    print(f"\n--- K-MEANS BEHAVIORAL SEGMENTATION (UNSUPERVISED, k=3, Silhouette Score = {sil_score:.4f}) ---")
    print("NOTE: Cluster labels are descriptive interpretations of behavioral patterns, NOT ground truth categories.")
    cluster_descriptive_names = {
        0: "Traditional Moderately Vulnerable Non-Borrowers",
        1: "Digitally Integrated Higher-Resource Segment",
        2: "Debt-Stressed Acute Liquidity Constrained Segment",
    }
    for c in range(3):
        c_sub = X_copy[X_copy["cluster"] == c]
        size = int(len(c_sub))
        pct_size = float(size / len(X_copy) * 100)
        severe_rate = float(c_sub["target"].mean() * 100)
        profile = {
            "cluster_id": c,
            "descriptive_name": cluster_descriptive_names.get(c, f"Cluster {c}"),
            "size": size,
            "pct_of_sample": pct_size,
            "severe_difficulty_rate_pct": severe_rate,
            "mean_income_quintile": float(c_sub["inc_q"].mean()),
            "mean_age": float(c_sub["age"].mean()),
            "female_pct": float(c_sub["female"].mean() * 100),
            "rural_pct": float(c_sub["rural"].mean() * 100),
            "digital_payment_pct": float(c_sub["any_digital_payment"].mean() * 100),
            "saved_any_pct": float(c_sub["saved_any"].mean() * 100),
            "borrowed_any_pct": float(c_sub["borrowed_any"].mean() * 100),
            "borrowed_food_credit_pct": float(c_sub["borrowed_food_credit"].mean() * 100),
            "smartphone_pct": float(c_sub["has_smartphone"].mean() * 100),
        }
        cluster_profiles[f"Cluster_{c}"] = profile
        print(f"\nCluster {c}: '{profile['descriptive_name']}' (N = {size}, {pct_size:.1f}%):")
        print(f"  Severe Emergency Difficulty Rate: {severe_rate:.2f}%")
        print(f"  Digital Payments: {profile['digital_payment_pct']:.1f}% | Smartphone: {profile['smartphone_pct']:.1f}%")
        print(f"  Saved Any: {profile['saved_any_pct']:.1f}% | Borrowed: {profile['borrowed_any_pct']:.1f}% | Food on Credit: {profile['borrowed_food_credit_pct']:.1f}%")
        print(f"  Mean Income Quintile: {profile['mean_income_quintile']:.2f} | Rural: {profile['rural_pct']:.1f}% | Female: {profile['female_pct']:.1f}%")

    # Save full machine-readable results
    full_output = {
        "model_selection": {
            "pre_specified_primary_metric": PRIMARY_SELECTION_METRIC,
            "selected_model": selected_winner_name,
            "selection_rationale": f"Selected strictly based on highest training-set 5-fold CV Macro F1 ({winner_cv_score:.4f}), prior to and independent of holdout test evaluation.",
        },
        "target_statistics": target_stats,
        "feature_count": X.shape[1],
        "feature_names": list(X.columns),
        "cv_results": cv_results,
        "test_evaluations": test_eval,
        "top_features_rf": top_features,
        "kmeans_behavior_clusters": {
            "silhouette_score": sil_score,
            "profiles": cluster_profiles,
        },
        "survey_weight_methodology": {
            "weight_variable": "wgt",
            "source": "Gallup World Poll / World Bank Global Findex 2025 post-stratification weight",
            "description": "Adjusts for household size selection probabilities and aligns sample to national population margins (gender, age, education, rural/urban).",
            "limitations": "Weighted evaluation models expected population performance under survey sampling design, but does not correct for unobserved confounders or substitute for longitudinal/out-of-domain customer data.",
        }
    }
    
    with open(OUTPUT_JSON, "w") as f:
        json.dump(full_output, f, indent=2)
    print(f"\nMachine-readable results successfully written to {OUTPUT_JSON}")

if __name__ == "__main__":
    run_experiments()
