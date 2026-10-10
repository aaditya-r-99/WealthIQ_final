# WealthIQ — Machine Learning Models, Datasets & Research Artifacts Specification

**Document Version:** 1.0.0 (Production Release)  
**Date:** October 10, 2026  
**Application Production URL:** [https://wealthiq-nine.vercel.app](https://wealthiq-nine.vercel.app)  
**Target Audience:** Academic Examiners, Course Evaluators, Faculty Viva Panels, and Peer Researchers  

---

## 1. Executive Overview & Architecture Topology

WealthIQ couples deterministic financial health analysis with two empirically grounded Machine Learning microservices deployed in decoupled serverless environments. To ensure auditability and prevent algorithmic hallucination, the system enforces a strict architectural boundary between **machine learning inference** (probabilistic models with measured error intervals) and **deterministic financial intelligence** (transparent arithmetic ratios and moving-average forecasts).

```
+----------------------------------------------------------------------------------------------------+
|                                    WEALTHIQ PRODUCTION ARCHITECTURE                                |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
                        +--------------------------------------------------+
                        |        WealthIQ Web Application (Next.js 13.5)   |
                        |          https://wealthiq-nine.vercel.app        |
                        +─────────────────────────┬────────────────────────+
                                                  │
                 ┌────────────────────────────────┴───────────────────────────────┐
                 │                                                                │
                 ▼                                                                ▼
+---------------------------------+                             +---------------------------------+
|  /api/classify-transaction      |                             |    /api/household-benchmark     |
|  - Bearer JWT Auth Gate         |                             |    - Client Parameter Sanitizer |
|  - Upstream Header Injection    |                             |    - Input Boundary Validation  |
|  - Resilient Local Fallback     |                             |    - Secure Upstream Proxy      |
+────────────────┬────────────────+                             +────────────────┬────────────────+
                 │ (HTTPS + x-api-key)                                           │ (HTTPS)
                 ▼                                                               ▼
+---------------------------------+                             +---------------------------------+
|  Transaction Classifier Service |                             |  HCES Benchmark Microservice    |
|  wealthiq-classifier (Vercel)   |                             |  wealthiq-benchmark (Vercel)    |
|  - Python 3.12 Serverless       |                             |  - Python 3.12 Serverless       |
|  - Calibrated LinearSVC v2      |                             |  - HistGradientBoostingRegressor|
|  - 11 Categories + Indian Rules |                             |  - 261,953 MoSPI Survey Samples |
+---------------------------------+                             +---------------------------------+
```

### Verified Live Service Topology

| Service Component | Canonical Deployment URL | Vercel Project Name | Runtime Environment | Model Algorithm | Primary Dataset |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Main Web Application** | `https://wealthiq-nine.vercel.app` | `wealthiq` | Next.js 13.5 / Node.js 24 | Next.js App Router | User financial records (Supabase PostgreSQL) |
| **Transaction Classifier** | `https://wealthiq-classifier-o7nt9hbk3-adityaprajapati-5528s-projects.vercel.app` | `wealthiq-classifier` | Python 3.12 / FastAPI | Calibrated LinearSVC (Platt Scaling) + Rules | Hugging Face `mitulshah/transaction-categorization` + Curated Indian Corpus |
| **Household Benchmark** | `https://wealthiq-benchmark.vercel.app` | `wealthiq-benchmark` | Python 3.12 / FastAPI | `HistGradientBoostingRegressor` | MoSPI Household Consumption Expenditure Survey (HCES) 2023–24 |

---

## 2. Model 1: Indian Transaction Categorization

### 2.1 Dataset Provenance & Scale
* **Primary Source:** `mitulshah/transaction-categorization` on Hugging Face ([https://huggingface.co/datasets/mitulshah/transaction-categorization](https://huggingface.co/datasets/mitulshah/transaction-categorization)).
* **Source Scale:** Approximately 4.5 million synthetic transaction descriptions across banking categories.
* **Effective Sample Extracted & Cleaned:**
  * Clean baseline sampled from `0000.parquet`: ~1,100 deduplicated records per category.
  * Curated Indian banking and UPI corpus: Over 5,000 synthesized bank narrations spanning major Indian UPI handles (`@icici`, `@okhdfcbank`, `@paytm`, `@sbi`, `@axisbank`, `@ybl`), merchant slugs, POS terminal descriptions, and NEFT/IMPS payroll lines.
  * Dedicated Indian Housing & Rent corpus: Curated covering digital rent portals (NoBroker, CRED, Magicbricks, Housing.com), society maintenance dues (MyGate, NoBrokerHood, RWA), and urban co-living/PG accommodations across major tech hubs.
  * **Total Clean, Unique Dataset:** **15,660 records** after cross-source collision removal and text normalization.
  * **Dataset Splits (Stratified, Zero Leakage):**
    * **Training Set (70%):** 10,962 samples (`data/train_set.json`).
    * **Validation Set (15%):** 2,349 samples (`data/val_set.json`).
    * **Locked Independent Test Set (15%):** 2,349 samples (`data/test_locked.json`).

### 2.2 Preprocessing & Feature Engineering
* **Text Preprocessing Pipeline (`ml/classifier/preprocess.py`):**
  * Case folding to lowercase.
  * Regex stripping of variable transaction noise: 12-digit UPI reference numbers (RRN), date/time stamps, masked card numbers (`XXXX-XXXX-XXXX-1234`), and alphanumeric invoice codes.
  * UPI VPA handle extraction and token isolation (`@okhdfcbank` -> `hdfc bank`).
  * Preservation of critical financial keywords (`AMC`, `Society`, `Prime Video`, `FASTag`, `Salary`).
* **Feature Representation:**
  * Sublinear TF-IDF Vectorizer with word n-gram range $(1, 2)$.
  * Minimum document frequency $\text{min\_df} = 2$.
  * Feature capacity: Up to 75,000 unigrams and bigrams.
  * Sublinear term frequency scaling ($1 + \log(\text{tf})$) to dampen repetitive tokens.

### 2.3 Category Taxonomy & UI Mapping
The classifier operates over **11 native classes** mapped directly to WealthIQ budget buckets:

| Classifier Native Class | WealthIQ Application Category | Expense Nature | Common Indian Trigger Keywords |
| :--- | :--- | :--- | :--- |
| **Food & Dining** | `Food` | Essential / Discretionary | Swiggy, Zomato, Blinkit, Zepto, BigBasket, DMart, Haldirams |
| **Transportation** | `Transportation` | Essential | Uber, Ola, Rapido, BluSmart, Metro, IRCTC, FASTag, Fuel, Petrol |
| **Housing & Rent** | `Housing` | Essential | Rent, Landlord, NoBroker, MyGate society maintenance, Flat deposit |
| **Utilities & Services** | `Utilities` | Essential | BESCOM, BSES, Adani Gas, Airtel broadband, Jio recharge, Water bill |
| **Healthcare & Medical** | `Healthcare` | Essential | Apollo Pharmacy, 1mg, Practo, Dr Lal Pathlabs, Max Hospital |
| **Entertainment & Recreation** | `Entertainment` | Discretionary | BookMyShow, PVR, Netflix, Amazon Prime Video, Spotify, Hotstar |
| **Shopping & Retail** | `Shopping` | Discretionary | Flipkart, Amazon, Myntra, Nykaa, Zara, Tata CLiQ, Croma |
| **Financial Services** | `Financial` | Essential | Card AMC fee, Demat charges, Zerodha, Groww, Loan EMI, Mutual Fund SIP |
| **Government & Legal** | `Government` | Essential | Income tax challan, Property tax, Municipal fee, Passport seva, E-challan |
| **Charity & Donations** | `Charity` | Discretionary | PM CARES, Akshaya Patra, CRY, Goonj, Temple trust, UNICEF |
| **Income** | *Redirects to Income* | Non-expense | Salary credited, Payroll, Dividend credited, Bank interest payout |

### 2.4 Model Candidates & Comparative Validation
Four candidate architectures were trained and compared on identical validation splits (`ml/classifier/train_improved_model.py`):

| Candidate Architecture | Validation Accuracy | Macro-Precision | Macro-Recall | Macro-F1 Score | Selection Outcome |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Baseline Logistic Regression** ($C=1.0$) | 97.96% | 0.9809 | 0.9745 | 0.9775 | Strong baseline |
| **Tuned Logistic Regression** (Sublinear TF-IDF, $C=3.0$, Balanced) | 98.38% | 0.9806 | 0.9798 | 0.9801 | Competitive |
| **Complement Naive Bayes** ($\alpha=0.5$, Class-Imbalance Aware) | 98.30% | 0.9797 | 0.9790 | 0.9793 | Fast, slightly lower recall |
| **Calibrated LinearSVC** (SVM + Sigmoid Platt Scaling, $C=1.0$) | **98.55%** | **0.9833** | **0.9820** | **0.9826** | **Selected Winner** |

### 2.5 Evaluation Metrics on Locked Independent Test Set ($N = 2,349$)
* **Accuracy:** **98.55%**
* **Macro-Precision:** **0.9833**
* **Macro-Recall:** **0.9820**
* **Macro-F1 Score:** **0.9826**

### 2.6 Zero-Leakage Challenge Benchmark ($N = 116$)
Evaluated on curated challenging Indian transaction descriptions that caused failure modes in early versions (disambiguation of `AMC` fees vs movie theatres, `Society` maintenance vs charitable societies, `Prime Video` vs `Amazon Shopping`):
* **Phase 4 Baseline Accuracy:** 84.48% (Macro-F1: 0.8312)
* **Phase 5 Improved Classifier Accuracy:** **97.41%** (Macro-F1: 0.9698)
* **Net Improvement:** **+12.93% Accuracy**, **+0.1386 Macro-F1**

### 2.7 Hybrid Inference Architecture & Review Thresholding
1. **Rule Engine Precedence:** High-confidence regex rules execute first for recognized merchants and disambiguated compound phrases. If matched, response returns `method: "rule"`, `confidence: 1.0`, `needs_review: false`.
2. **Machine Learning Pipeline:** Unmatched narrations pass to the Calibrated LinearSVC pipeline. Platt scaling produces calibrated posterior probability distributions.
3. **Review Flagging (`needs_review`):** If model confidence $< 0.65$ or the narration contains ambiguous out-of-vocabulary tokens, the response flags `needs_review: true` with a user-facing explanation in the UI.
4. **User Override Guarantee:** Suggested categories are never auto-committed; the user must confirm or manually change the category dropdown before saving.

### 2.8 Statistical Limitations of Synthetic Bank Narrations
> [!WARNING]
> While the locked test set achieves 98.55% accuracy on synthetic and templated banking texts, real-world bank SMS strings exhibit OCR artifacts, regional bank syntax variations, and unstandardized merchant acronyms. Academic reviewers should note that synthetic held-out accuracy represents upper-bound performance on structured templates, not in-the-wild generalization across every regional Indian bank.

---

## 3. Model 2: Household Consumption Expenditure Benchmark (HCES 2023–24)

### 3.1 Dataset Provenance & Official Citation
* **Dataset:** Household Consumption Expenditure Survey (HCES) 2023–24.
* **Survey Agency:** Ministry of Statistics and Programme Implementation (MoSPI), National Sample Survey Office (NSSO), Government of India.
* **Survey Period:** August 2023 – July 2024 (comprehensive 12-month nationwide survey).
* **Official Citation:**
  > Ministry of Statistics and Programme Implementation (MoSPI), Government of India. *Household Consumption Expenditure Survey (HCES) 2023–24: Microdata and Survey Documentation*. Computer Centre, MoSPI, New Delhi. Official Portal: [https://microdata.gov.in](https://microdata.gov.in).

### 3.2 Survey Scale & Sampling Methodology
* **Total Households Interviewed:** **261,953 households** nationwide across all 36 States and Union Territories.
* **Survey Strata:** Stratified multi-stage design covering both Rural (Sector 1) and Urban (Sector 2) sectors.
* **Train / Held-Out Test Split:**
  * **Training Split (80%):** 209,603 households.
  * **Held-Out Test Split (20%):** 52,350 households.
  * **Leakage Prevention:** Split executed via `GroupShuffleSplit` on First Stage Unit (`FSU_Serial_No`). Households in the same sample village or urban frame block are never split across train and test sets, strictly preventing spatial autocorrelation leakage.

### 3.3 Survey Levels & Join Keys
The training pipeline (`ml/train_hces_models.py`) processes three official survey microdata levels:
1. **Level 15 (Section 1_1, A2, B2, C2):** Target Monthly Consumption Expenditure (`MONTHLY_CONSUMPTION_EXP`), sampling multiplier weights (`MULTIPLIER`), State code (`State`), Sector (`Sector`), Household size (`HOUSEHOLD_SIZE`).
2. **Level 02 (Section 3):** Household member demographics (`Age`, `Education_Level`). Aggregated to compute `num_adults` (age $\ge 18$), `num_children` (age $< 18$), and `highest_education`.
3. **Level 01 (Section 1_2):** Household characteristics (principal livelihood/occupation, dwelling unit structure, cooking fuel source, land ownership status).
* **Join Keys:** Composite primary key `(FSU_Serial_No, Sample_SU_No, Second_Stage_Stratum_No, Sample_Household_No)`.

### 3.4 Feature Definitions & Target Specification

| Feature Name | Type | Categories / Domain | Description |
| :--- | :--- | :--- | :--- |
| `state` | Categorical | 36 Indian States & UTs (`01` to `36`) | Geographic state of residence |
| `sector` | Categorical | `rural`, `urban` | Rural vs. Urban classification |
| `highest_education` | Categorical | `below_primary`, `primary_middle`, `secondary_higher`, `graduate_above` | Highest educational attainment in household |
| `livelihood` | Categorical | `regular_wage`, `self_employed`, `casual_labour`, `other` | Principal household livelihood source |
| `dwelling_type` | Categorical | `pucca`, `semi_pucca`, `katcha` | Structural quality of residence |
| `cooking_fuel` | Categorical | `lpg`, `png_electric`, `firewood`, `other` | Primary household cooking energy source |
| `land_owned` | Categorical | `owned`, `not_owned` | Ownership of homestead or agricultural land |
| `hh_size` | Numeric | $1 \le \text{hh\_size} \le 25$ | Total household members |
| `num_adults` | Numeric | $\ge 1$ | Adults residing in household |
| `num_children` | Numeric | $\ge 0$ | Children residing in household |
| **Target: `mpce`** | Continuous | $\text{INR} > 0$ | **Monthly Per Capita Consumption Expenditure** |

### 3.5 Model Architecture & Verified Evaluation Metrics
* **Selected Algorithm:** `HistGradientBoostingRegressor` (scikit-learn).
* **Model Artifact:** `ml/models/hces_spending_benchmark_v1.joblib` (Compact: **241 KB**).
* **Metadata Artifact:** `ml/models/hces_benchmark_metadata.json` (2.4 KB).
* **Precomputed Segment Benchmarks:** `ml/models/hces_state_sector_benchmarks.json` (14 KB, empirical P25, median, mean, P75 for all 72 State $\times$ Sector combinations).

#### Comparative Held-Out Evaluation ($N = 52,350$ Households)

| Model Candidate | Weighted MAE (₹/person/mo) | Weighted RMSE (₹/person/mo) | Weighted $R^2$ Variance Explained |
| :--- | :---: | :---: | :---: |
| **Baseline Weighted Mean** | ₹5,593.17 | ₹8,810.93 | -0.0019 |
| **Baseline Median** | ₹5,270.22 | ₹9,081.62 | -0.0644 |
| **Ridge Regression** | ₹4,019.84 | ₹6,630.93 | 0.4325 |
| **HistGradientBoostingRegressor (Selected)** | **₹3,461.22** | **₹5,834.94** | **0.5606** |

#### Segment-Specific Test Performance

| Segment | Sample Size in Test Set | MAE (₹/person/mo) | RMSE (₹/person/mo) | Segment $R^2$ |
| :--- | :---: | :---: | :---: | :---: |
| **Rural Sector** | 33,656 households | ₹2,354.67 | ₹3,742.41 | 0.4359 |
| **Urban Sector** | 18,694 households | ₹5,532.15 | ₹8,458.94 | 0.4751 |

### 3.6 Uncertainty Representation in UI
The Household Benchmark interface (`/household-benchmark`) does not present point estimates as deterministic truths. Instead, it provides:
1. **Point Estimate:** `Estimated Household Total = estimated_mpce * hh_size`.
2. **Per Capita Estimate:** `Estimated MPCE (₹/person/month)`.
3. **Empirical Uncertainty Interval:** `[Estimated Total - Segment MAE * hh_size, Estimated Total + Segment MAE * hh_size]`.
4. **State Empirical Reference:** Median MPCE, 25th percentile, and 75th percentile from the official survey for the user's State and Sector.
5. **Academic Disclaimers:** Explicit held-out $R^2$ disclosure (48% for urban, 44% for rural) and notices explaining that individual lifestyle choices and unobserved assets create natural variance around population survey baselines.

---

## 4. Other Financial Data Classification

To maintain scientific integrity during academic review, all non-model data assets in WealthIQ are categorized:

| Data Asset | Exact Classification | Storage / Access Mechanism | Is ML Training Data? |
| :--- | :--- | :--- | :---: |
| **User Incomes, Expenses, Debts, Savings, Assets** | User-Entered Application Records | Supabase PostgreSQL (`user_id` isolated via RLS) | **NO** |
| **Verified October 2026 FD Rate Schedules** | Static Curated Reference Data | `lib/fd-rates-data.ts` (Official bank circulars) | **NO** |
| **Live NSE Market Indices** | External Runtime API Data | Real-time upstream fetch (`/api/market-insights`) | **NO** |
| **Mock Records for Unauthenticated Demo** | Synthetic Demonstration Fixtures | `lib/mock-data.ts` | **NO** |
| **Findex 2025 Exploratory Microdata** | Exploratory Research Microdata | `ml/data/raw/` (Strictly gitignored per DDI terms) | **NO** (Exploratory) |
| **HCES 2023–24 Microdata (Levels 01, 02, 15)** | Official National Survey Microdata | Local download (microdata.gov.in, gitignored) | **YES** (HCES Benchmark) |
| **Transaction Narrations Corpus** | Enriched Text Corpus | Hugging Face + Curated bank patterns (`ml/classifier/`) | **YES** (Classifier v2) |

---

## 5. Dataset-to-Feature Mapping Matrix

| Model or Feature | Underlying Data Source | Mathematical Methodology | Application Use & Integration Path |
| :--- | :--- | :--- | :--- |
| **Smart Expense Categorization** | Hugging Face + Curated Indian Corpus (15,660 samples) | Calibrated LinearSVC (Platt Scaling) + Regex Rules | `/expenses` page $\rightarrow$ `/api/classify-transaction` proxy $\rightarrow$ Python microservice |
| **Household Spending Benchmark** | MoSPI HCES 2023–24 (261,953 households) | `HistGradientBoostingRegressor` | `/household-benchmark` page $\rightarrow$ `/api/household-benchmark` proxy $\rightarrow$ Python microservice |
| **Deterministic Next-Month Expense Forecast** | User's own transaction ledger (last 1–6 months) | 3-Month SMA / 6-Month EWMA moving average heuristic | `/forecast` page; deterministic statistical estimator in `lib/financial-engine.ts` |
| **36-Month Net-Worth Projection** | Current assets, debts, and projected savings rate | Compound interest formula $A = P(1 + r/n)^{nt} + \text{PMT}$ | `/forecast` page; deterministic simulation in `lib/financial-engine.ts` |
| **Financial Health Score** | Current financial ratios across 5 pillars | 100-point transparent rubric (Debt-to-Income, Savings Rate, Runway) | `/dashboard` page; deterministic formula in `lib/financial-engine.ts` |
| **Verified Fixed Deposit Tracker** | Official October 2026 bank rate cards (SBI, HDFC, ICICI, RBL) | Compound interest with quarterly compounding frequency ($n = 4$) | `/fd` page; lookup helper in `lib/fd-rates-data.ts` |

---

## 6. Reproducibility and Research Artifacts Guide

This section allows college faculty, thesis supervisors, and evaluators to reproduce all training, evaluation, and inference pipelines.

### 6.1 Repository File Inventory

```
ml/
├── train_hces_models.py               # Complete HCES 2023-24 model training pipeline
├── predict_benchmark.py               # Local standalone HCES inference runner
├── benchmark_service.py               # HCES FastAPI microservice handler
├── explore_hces.py                    # Exploratory data analysis for HCES microdata
├── models/
│   ├── hces_spending_benchmark_v1.joblib        # Trained HCES model artifact (241 KB)
│   ├── hces_benchmark_metadata.json             # HCES metadata & evaluation metrics
│   ├── hces_state_sector_benchmarks.json        # 72 State x Sector empirical benchmarks
│   ├── indian_transaction_classifier_v2.joblib  # Trained Classifier artifact (1.38 MB)
│   └── candidate_model_benchmark.json           # Classifier candidate models benchmark
└── classifier/
    ├── build_india_dataset.py         # Dataset construction & balancing script
    ├── preprocess.py                  # Text normalization & UPI cleaner
    ├── train_improved_model.py        # Classifier model training & comparison
    ├── evaluate_phase5_offline.py     # Independent locked test set evaluation
    ├── scratch_challenge_data.py      # 116 curated challenging test cases
    ├── hybrid_classifier_v2.py        # Contextual rule engine + LinearSVC v2 inference
    ├── api_service.py                 # Classifier FastAPI microservice
    ├── test_classifier.py             # HTTP test suite for classifier microservice
    └── data/
        └── sample_transactions.json   # 22-sample test fixture covering all categories
```

### 6.2 Python Environment Setup
Both ML models operate on Python 3.11 / 3.12 with standard scientific libraries:

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install exact validated dependencies
pip install --upgrade pip
pip install \
  scikit-learn==1.4.1.post1 \
  joblib==1.3.2 \
  numpy==1.26.4 \
  pandas==2.2.1 \
  fastapi==0.110.0 \
  uvicorn==0.28.0 \
  pydantic==2.6.4 \
  pyarrow==15.0.0
```

### 6.3 Reproducing the Transaction Categorization Model

#### Step 1: Preprocessing & Offline Evaluation on Held-Out Test Set
```bash
# Run comprehensive evaluation on the locked test set (2,349 samples)
# and the zero-leakage challenge set (116 samples)
python3 ml/classifier/evaluate_phase5_offline.py
```
*Expected Output:*
* Improved Hybrid Accuracy: **98.55%** (Macro-F1: **0.9826**)
* Challenge Set Accuracy: **97.41%** (Macro-F1: **0.9698**)

#### Step 2: Running Standalone Hybrid Inference
```bash
python3 -c "
import sys
sys.path.insert(0, 'ml/classifier')
from hybrid_classifier_v2 import categorize_v2

# Test known rule merchant
print(categorize_v2('Swiggy dinner order 48291'))

# Test ML inference with ambiguous UPI memo
print(categorize_v2('Payment to Ramesh Kumar'))
"
```
*Expected Output:*
* Swiggy: `category: 'Food & Dining'`, `method: 'rule'`, `confidence: 1.0`
* Ramesh Kumar: `category: 'Housing & Rent'`, `method: 'ml'`, `confidence: ~0.97`

#### Step 3: Reproducing Dataset Building & Training
```bash
# 1. Download raw 0000.parquet from Hugging Face:
# curl -L -o 0000.parquet "https://huggingface.co/datasets/mitulshah/transaction-categorization/resolve/main/0000.parquet"

# 2. Build the balanced India-enriched dataset splits:
python3 ml/classifier/build_india_dataset.py

# 3. Train all candidate pipelines and export the winning Calibrated LinearSVC:
python3 ml/classifier/train_improved_model.py
```

### 6.4 Reproducing the HCES Household Spending Benchmark Model

#### Step 1: Running Standalone Inference
```bash
python3 ml/predict_benchmark.py '{
  "state": "27",
  "sector": "urban",
  "hh_size": 4,
  "highest_education": "graduate_above",
  "livelihood": "regular_wage",
  "dwelling_type": "pucca",
  "cooking_fuel": "lpg",
  "land_owned": "not_owned",
  "num_adults": 2,
  "num_children": 2
}'
```
*Expected Output:*
* `estimated_mpce`: **₹15,689.74 / person / month**
* `estimated_household_total`: **₹62,758.96 / month**
* `state_sector_median_mpce`: **₹13,600.00**
* `segment_mae`: **₹5,532.15**

#### Step 2: Lawful Acquisition & Retraining from MoSPI Microdata
1. **Acquire Microdata:** Register an authorized researcher account at MoSPI's official data portal: [https://microdata.gov.in](https://microdata.gov.in).
2. Download the official survey archive: `HCES_Data_2023-24_Csv.zip`.
3. Verify that the zip archive contains:
   * `LEVEL - 15 (Section 1_1, A2,B2  C2).csv`
   * `LEVEL - 02 (Section 3).csv`
   * `LEVEL - 01 (Section 1_2).csv`
4. Execute training and evaluation:
```bash
python3 ml/train_hces_models.py --zip-path /path/to/HCES_Data_2023-24_Csv.zip
```
*Pipeline Execution Details:*
* Merges 261,953 households across Level 15, Level 02, and Level 01 using composite household keys.
* Executes `GroupShuffleSplit` on First Stage Unit (`FSU_Serial_No`).
* Trains Dummy Regressor, Ridge Regression, and `HistGradientBoostingRegressor`.
* Evaluates weighted and unweighted MAE, RMSE, and $R^2$ on held-out test split.
* Exports `ml/models/hces_spending_benchmark_v1.joblib` and metadata summary.

### 6.5 Data Redistribution & Privacy Safeguards
* **No Raw Microdata in Version Control:** Raw MoSPI HCES microdata files exceed 200 MB and are subject to Government of India data terms. They are strictly excluded via `.gitignore`.
* **Zero Credentials in Repository:** All database access keys, Vercel tokens, and API secrets are strictly managed via environment variables (`.env*` excluded from Git).
* **Open-Source Model Weights:** The trained model artifacts (`hces_spending_benchmark_v1.joblib` [241 KB] and `indian_transaction_classifier_v2.joblib` [1.38 MB]) contain only mathematical parameters (tree split thresholds and SVM hyperplanes). They contain zero microdata records or personally identifiable financial data, permitting direct academic distribution.
