# WealthIQ — India Financial Resilience ML Evaluation & Methodology Review

**Date**: October 9, 2026  
**Dataset Reference**: World Bank Global Findex Database 2025 (`IND_2024_FINDEX_v01_M` / `IND_2024_FINDEX_v02_M_CSV`)  
**Microdata Path**: `ml/data/raw/IND_2024_FINDEX_v02_M_CSV/Findex_Microdata_2025_updateIndia.csv`  
**Official Codebook**: `ml/data/documentation/ddi-documentation-english_microdata-7916.pdf`  
**Pipeline Code**: `ml/src/train_models.py`  
**Machine-Readable Results**: `ml/reports/model_experiment_results.json`  

---

## 1. Verified Target Construction & Exact Population Math

The supervised target is formulated as a binary classification problem evaluating emergency liquidity distress:

- **Class 1 — Severe emergency-fund difficulty**:
  - `fin24a == 1` (*Very difficult to raise 1/20th GNI per capita in 30 days*): 1,915 respondents
  - `fin24 == 7` (*Could not come up with the money at all*): 114 respondents
  - **Total Class 1**: **2,029 respondents**
- **Class 0 — Lower reported difficulty (not classified as severe)**:
  - `fin24a == 2` (*Somewhat difficult*): 719 respondents
  - `fin24a == 3` (*Not difficult at all*): 241 respondents
  - **Total Class 0**: **960 respondents**
- **Ineligible / Excluded Responses**:
  - `fin24 == 8` (*Don't know main emergency source*): 6 respondents
  - `fin24 == 9` (*Refused main emergency source*): 4 respondents
  - `fin24 == 1` & `fin24a == 4` (*Main source is savings, but Don't know difficulty*): 1 respondent
  - **Total Excluded**: **11 respondents**

### Exact Verified Target Distribution

| Target Class | Count | % of Eligible Sample ($N = 2,989$) | % of Total Survey ($N = 3,000$) | Population-Weighted % (`wgt`) |
| :--- | :---: | :---: | :---: | :---: |
| **Class 1 (Severe Difficulty / Unable)** | **2,029** | **67.8822%** | **67.6333%** | **69.7636%** |
| **Class 0 (Lower Reported Difficulty)** | **960** | **32.1178%** | **32.0000%** | **30.2364%** |
| **Excluded (DK / Refused)** | **11** | — | **0.3667%** | — |
| **Total Sample** | **2,989** | **100.0000%** | **99.6333%** | **100.0000%** |

> [!IMPORTANT]
> **Terminology & Substantive Meaning of Class 0**:  
> Class 0 is explicitly defined as **"Lower reported difficulty (not classified as severe)"**, **not** "financially resilient". Within Class 0, **74.90% of respondents (719 / 960)** reported that obtaining emergency funds would still be *"somewhat difficult"*, while only **25.10% (241 / 960)** reported *"not difficult at all"*. Grouping them separates acute distress/inability from manageable or non-severe difficulty, but does not indicate complete financial security.

> **Mathematical Reconciliation**:  
> In initial exploratory notes, figures of ~70.6% and ~29.4% arose from dividing `2,029` by `2,876` (valid `fin24a` before adding back the 114 respondents skipped under `fin24 == 7`). Correcting both the numerator and the denominator ($2,876 - 1 \text{ [DK]} + 114 = 2,989$) yields the exact verified percentages: **67.8822% (Class 1)** and **32.1178% (Class 0)**.

---

## 2. Model Selection Procedure & Preprocessing Isolation

### Pre-specified Selection Protocol
To prevent data snooping and test-set contamination:
1. **Primary Selection Criterion**: Defined a priori as **Mean 5-Fold Stratified Cross-Validation Macro F1 on the Training Partition** ($N = 2,391$). Balanced Accuracy and ROC-AUC serve as secondary diagnostic metrics.
2. **Strict Pipeline Isolation**: Every classifier is encapsulated inside a scikit-learn `Pipeline([('scaler', StandardScaler()), ('classifier', model)])`. The scaler is fitted exclusively on the training folds of each cross-validation split, ensuring zero leakage across folds.
3. **Selection Without Holdout Test Reference**: The winning model family and hyperparameters are selected strictly by training cross-validation before evaluating on the holdout test set.
4. **Single-Pass Untouched Test Evaluation**: The holdout test set ($N = 598$) was held strictly untouched until selection was fixed.

---

## 3. Empirical Results & Cross-Validation Comparison

### 5-Fold Stratified Cross-Validation on Training Partition ($N = 2,391$)

| Model Pipeline | CV Macro F1 (Mean ± Std) | CV Balanced Accuracy (Mean ± Std) | CV ROC-AUC (Mean ± Std) | Selection Status |
| :--- | :---: | :---: | :---: | :---: |
| **Majority Baseline (Dummy)** | 0.4043 ± 0.0003 | 0.5000 ± 0.0000 | 0.5000 ± 0.0000 | Baseline |
| **Logistic Regression (Balanced)** | 0.6747 ± 0.0266 | 0.6901 ± 0.0282 | 0.7590 ± 0.0307 | Candidate |
| **K-Nearest Neighbors ($k=15$)** | 0.6457 ± 0.0085 | 0.6373 ± 0.0073 | 0.7314 ± 0.0246 | Candidate |
| **Random Forest (Balanced, 150 trees)** | **0.6949 ± 0.0262** | **0.7011 ± 0.0262** | **0.7603 ± 0.0297** | **WINNER (Selected by CV)** |

**Model Selection Decision**:  
Under the pre-specified criterion, **Random Forest (Balanced)** was selected as the primary winning model, having demonstrated superior cross-validation discriminative capability across all training folds (Mean CV Macro F1 = **0.6949** vs. 0.6747 for Logistic Regression; Mean CV Balanced Accuracy = **0.7011** vs. 0.6901).

---

### Untouched Holdout Test Partition Evaluation ($N = 598$)

*Ground Truth: Class 1 = 406 (67.89%), Class 0 = 192 (32.11%)*

| Model Pipeline | Accuracy | Balanced Accuracy | Macro F1 | ROC-AUC | Population-Weighted Bal. Acc. | Population-Weighted Macro F1 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Random Forest (Balanced)** `[Selected Winner]` | **0.7007** | **0.6766** | **0.6690** | **0.7405** | **0.6664** | **0.6673** |
| **Logistic Regression (Balanced)** `[Linear Reference]` | 0.7107 | 0.7087 | 0.6899 | 0.7644 | 0.7104 | 0.7005 |
| **K-Nearest Neighbors ($k=15$)** | 0.7124 | 0.6193 | 0.6255 | 0.7092 | 0.5995 | 0.6022 |
| **Majority Baseline (Dummy)** | 0.6789 | 0.5000 | 0.4044 | 0.5000 | 0.5000 | 0.4069 |

#### Methodological Review of Test Performance
- While Random Forest was selected via training CV (CV Macro F1 = 0.6949), Logistic Regression achieved slightly stronger generalization on this specific 598-sample test partition (Test Macro F1 = 0.6899 vs. 0.6690).
- This divergence demonstrates the critical importance of a pre-specified selection protocol: **we do not change the winning model post-hoc based on test set scores**, because doing so would treat the test partition as a validation set.
- Both models significantly outperform the Majority Baseline (Macro F1 = 0.4044, Balanced Acc = 0.5000), confirming that financial-inclusion, borrowing, saving, and digital-payment indicators provide genuine classification signal for emergency resilience.

#### Detailed Classification Reports (Untouched Test Set)

```
===================================================================================================
1. SELECTED MODEL: RANDOM FOREST (BALANCED) — [WINNER BY TRAINING CV]
Confusion Matrix: TN = 117, FP = 75, FN = 104, TP = 302
---------------------------------------------------------------------------------------------------
Class                                   Precision    Recall    F1-Score    Support
Class 0 (Lower Reported Difficulty)        0.5294    0.6094      0.5666        192
Class 1 (Severe Emergency Difficulty)      0.8011    0.7438      0.7714        406
---------------------------------------------------------------------------------------------------
Macro Average                              0.6652    0.6766      0.6690        598
Weighted Average                           0.7139    0.7007      0.7057        598
===================================================================================================

2. LINEAR BENCHMARK: LOGISTIC REGRESSION (BALANCED)
Confusion Matrix: TN = 135, FP = 57, FN = 116, TP = 290
---------------------------------------------------------------------------------------------------
Class                                   Precision    Recall    F1-Score    Support
Class 0 (Lower Reported Difficulty)        0.5378    0.7031      0.6095        192
Class 1 (Severe Emergency Difficulty)      0.8357    0.7143      0.7703        406
---------------------------------------------------------------------------------------------------
Macro Average                              0.6868    0.7087      0.6899        598
Weighted Average                           0.7401    0.7107      0.7187        598
===================================================================================================

3. NON-PARAMETRIC BENCHMARK: K-NEAREST NEIGHBORS (k=15)
Confusion Matrix: TN = 69, FP = 123, FN = 49, TP = 357
---------------------------------------------------------------------------------------------------
Class                                   Precision    Recall    F1-Score    Support
Class 0 (Lower Reported Difficulty)        0.5847    0.3594      0.4452        192
Class 1 (Severe Emergency Difficulty)      0.7438    0.8793      0.8059        406
---------------------------------------------------------------------------------------------------
Macro Average                              0.6643    0.6193      0.6255        598
===================================================================================================
```

---

## 4. Survey Weighting Methodology & Limitations

### Nature & Application of Survey Weights (`wgt`)
- `wgt` is a post-stratification sampling weight supplied by Gallup and the World Bank. It adjusts for unequal household selection probabilities and aligns sample margins to national census distributions (age, gender, education, rural/urban).
- **Descriptive Impact**:
  - Unweighted Class 1 proportion: **67.88%**
  - Population-weighted Class 1 proportion: **69.76%**
  - The ~1.88% upward shift reflects that lower-income, rural, and less-educated individuals (who report higher emergency distress) carry higher post-stratification weights to reflect their national demographic share.
- **Evaluation Impact**:
  - Random Forest population-weighted balanced accuracy: **0.6664** (vs. 0.6766 unweighted).
  - Logistic Regression population-weighted balanced accuracy: **0.7104** (vs. 0.7087 unweighted).

> [!WARNING]
> **Methodological Limitations of Survey Weights**:  
> A population-weighted holdout metric models expected performance under the survey's sampling assumptions, but **it does not constitute definitive proof of robust population generalization**:
> 1. Sampling weights correct only for observed marginal distributions; they do not remove unobserved confounding or response biases.
> 2. Primary sampling unit (PSU) and cluster IDs are anonymized in public microdata, preventing full design-based Taylor-linearized variance estimation.
> 3. The data is cross-sectional (single-shot 2024 survey); weights cannot account for macroeconomic shocks or temporal shifts that occur after data collection.

---

## 5. Unsupervised K-Means Behavioral Segmentation

K-Means ($k=3$) was fitted on 18 standardized financial inclusion behaviors, **strictly excluding the supervised target, `fin24`, `fin24a`, and `fin24b`**.

- **Overall Clustering Quality**: **Silhouette Score = 0.1645**.  
  This score indicates overlapping clusters typical of survey data on human economic behaviors, rather than discrete, cleanly separated physical clusters.
- **Descriptive Interpretations of Aggregate Patterns** *(Not Ground-Truth Categories)*:
  - **Cluster 0: "Traditional Moderately Vulnerable Non-Borrowers" ($N = 898$, 30.0%)**:
    - Severe emergency difficulty rate: **69.60%**.
    - Low borrowing (3.0%), zero food credit (0.0%), modest digital payments (26.4%), smartphone ownership (36.6%). High female representation (61.1%), mean income quintile 3.02.
  - **Cluster 1: "Digitally Integrated Higher-Resource Segment" ($N = 824$, 27.6%)**:
    - Severe emergency difficulty rate: **45.02%** *(Lowest distress)*.
    - Near-universal digital payments (99.2%) and smartphones (95.0%). High savings rate (77.9%), highest income quintile (mean 3.95), male-dominated (67.7%).
  - **Cluster 2: "Debt-Stressed Acute Liquidity Constrained Segment" ($N = 1,267$, 42.4%)**:
    - Severe emergency difficulty rate: **81.53%** *(Highest distress)*.
    - 100% borrowed in past year, 70.1% bought food on credit. Low smartphone ownership (26.2%), rural-dominated (75.2%), lowest income quintile (mean 2.71).

---

## 6. Leakage & Reproducibility Audit

| Audit Check | Status | Verification Detail |
| :--- | :---: | :--- |
| `fin24` & `fin24a` Target Exclusion | **Verified** | Used exclusively to define $y$. Index check confirms 0 target variables in $X$. |
| `fin24b` & Proxy Exclusions | **Verified** | `fin24b`, `fin24d1–d3`, `wpid_random`, and constants omitted. |
| Preprocessing Fold Isolation | **Verified** | `StandardScaler` placed strictly inside `Pipeline` objects. |
| Train/Test Split Reproducibility | **Verified** | Stratified split with fixed `random_state=42`. |
| Script Re-execution | **Verified** | `python3 ml/src/train_models.py` executes in ~9 seconds with 0 errors. |
| Data Governance | **Verified** | All microdata gitignored in `/ml/data/`; zero files in Next.js `public/`. |
| Existing Application Integrity | **Verified** | Production app untouched; `npm run typecheck` passes with 0 errors. |
