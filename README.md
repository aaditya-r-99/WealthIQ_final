# WealthIQ — Intelligent Personal Finance & Predictive Financial Intelligence

[![Production Release](https://img.shields.io/badge/Release-v1.0.0--Production-black?style=flat-square)](https://wealthiq-nine.vercel.app)
[![Live Site](https://img.shields.io/badge/Production%20URL-wealthiq--nine.vercel.app-emerald?style=flat-square)](https://wealthiq-nine.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-13.5.1-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Python Microservices](https://img.shields.io/badge/Python-3.12%20FastAPI-blue?style=flat-square&logo=python)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4.1-orange?style=flat-square&logo=scikit-learn)](https://scikit-learn.org/)

WealthIQ is a personal financial platform designed to eliminate financial ambiguity for individuals and households. It bridges personal expense management with empirical macroeconomic data from the Government of India, featuring a calibrated machine learning transaction classifier, a nationwide household spending benchmark, and transparent financial forecasting.

* **Live Production Website:** [https://wealthiq-nine.vercel.app](https://wealthiq-nine.vercel.app)
* **Comprehensive ML & Dataset Documentation:** [`ML_MODELS_AND_DATASETS.md`](ML_MODELS_AND_DATASETS.md)
* **Viva Voce Defense Guide:** [`wealthiq_viva_preparation.md`](wealthiq_viva_preparation.md)

---

## 1. System Architecture & Topology

WealthIQ enforces a strict separation of concerns between client rendering, relational transactional storage, and Python-based machine learning inference:

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

### Verified Vercel Project & Service Mapping

| Component | Vercel Project | Target URL | Runtime | Primary Function |
| :--- | :--- | :--- | :--- | :--- |
| **Main Web App** | `wealthiq` | [https://wealthiq-nine.vercel.app](https://wealthiq-nine.vercel.app) | Next.js 13.5 (Node.js 24) | Primary user interface, authenticated dashboard, state management |
| **Transaction Classifier** | `wealthiq-classifier` | `https://wealthiq-classifier-o7nt9hbk3-adityaprajapati-5528s-projects.vercel.app` | Python 3.12 Serverless | Microservice categorizing Indian bank narrations into 11 classes |
| **Household Benchmark** | `wealthiq-benchmark` | [https://wealthiq-benchmark.vercel.app](https://wealthiq-benchmark.vercel.app) | Python 3.12 Serverless | Microservice estimating household consumption expenditure |
| **Cloud Database & Auth** | Supabase Project `wqbanwxdzarmpqmxfnmw` | Hosted PostgreSQL 15 | GoTrue Auth & PostgreSQL | User identity, session JWTs, Row-Level Security (RLS) data isolation |

---

## 2. Core Modules & Capabilities

1. **Smart Expense Categorization (`/expenses`):**
   * Automatically classifies unstructured Indian UPI, POS, and net-banking narrations (e.g. Swiggy, Zomato, Blinkit, rent, electricity bills) into 11 budget categories.
   * Employs high-precedence regex rules for recognized Indian merchants and falls back to a calibrated Linear Support Vector Classifier (`LinearSVC`).
   * Explicit `needs_review` flag signals when model confidence is $< 0.65$ or description is ambiguous.
   * Income transactions (e.g. salary, dividends, interest) are automatically detected and redirected to the Income module.

2. **Household Spending Benchmark (`/household-benchmark`):**
   * Machine-learning regression model trained on 261,953 official surveyed households from the **MoSPI Household Consumption Expenditure Survey (HCES) 2023–24**.
   * Provides demographic-specific Monthly Per Capita Expenditure (MPCE) and estimated household totals based on state, sector (urban/rural), education, livelihood, dwelling type, cooking fuel, and household size.
   * Renders empirical segment Mean Absolute Error (MAE) uncertainty intervals and official state median benchmarks.

3. **Deterministic Financial Health Score (`/dashboard`):**
   * Transparent 0–100 financial health rubric evaluating 5 key personal finance pillars: Savings Behavior (25%), Expense Burden (20%), Debt Burden (25%), Emergency Runway (15%), and Asset Accumulation (15%).
   * Purely deterministic formula; zero black-box hallucination.

4. **Multi-Horizon Forecasting (`/forecast`):**
   * 36-month net-worth trajectory simulating compound growth across three savings scenarios (conservative, baseline, disciplined).
   * Deterministic next-month expense estimator using 3-month simple moving average (SMA) and 6-month exponentially weighted moving average (EWMA).

5. **Verified Fixed-Deposit Rate Intelligence (`/fd`):**
   * Rates from major Indian domestic retail banks (State Bank of India, HDFC Bank, ICICI Bank, RBL Bank) for retail deposits under ₹3 Crore.
   * Multi-tenure duration schedules (7 days to 10 years), quarterly compounding calculations, senior citizen premiums (+0.50% to +0.60%), and links to active bank circulars.

---

## 3. Machine Learning Models Inventory

For deep technical details, hyperparameter specifications, and mathematical proofs, consult [`ML_MODELS_AND_DATASETS.md`](ML_MODELS_AND_DATASETS.md).

| Attribute | Model 1: Transaction Classifier v2 | Model 2: Household Spending Benchmark |
| :--- | :--- | :--- |
| **Algorithm** | Calibrated LinearSVC (Platt Scaling) + Regex Rules | Histogram-based Gradient Boosting Regressor |
| **Implementation** | scikit-learn `Pipeline` (TF-IDF + `CalibratedClassifierCV`) | scikit-learn `HistGradientBoostingRegressor` |
| **Training Dataset** | Hugging Face `mitulshah/transaction-categorization` + Curated Indian Corpus | MoSPI HCES 2023–24 Microdata (Levels 01, 02, 15) |
| **Effective Samples** | 15,660 deduplicated records (10,962 train / 2,349 val / 2,349 test) | 261,953 surveyed households (209,603 train / 52,350 test) |
| **Target Variable** | 11 Financial Categories (Classification) | `mpce` — Monthly Per Capita Expenditure (Regression) |
| **Evaluation Metrics** | **Accuracy: 98.55%**, **Macro-F1: 0.9826** on locked test set | **Weighted MAE: ₹3,461.22**, **Weighted $R^2$: 0.5606** |
| **Challenge Set** | **97.41% Accuracy** on 116 difficult Indian edge cases | Rural $R^2$: 0.4359, Urban $R^2$: 0.4751 |
| **Model Artifact** | `ml/models/indian_transaction_classifier_v2.joblib` (1.38 MB) | `ml/models/hces_spending_benchmark_v1.joblib` (241 KB) |
| **Training Script** | `ml/classifier/train_improved_model.py` | `ml/train_hces_models.py` |
| **Evaluation Script**| `ml/classifier/evaluate_phase5_offline.py` | `ml/train_hces_models.py` |
| **Inference Service**| `ml/classifier/api_service.py` (`wealthiq-classifier`) | `ml/benchmark_service.py` (`wealthiq-benchmark`) |

---

## 4. Local Development & Setup

### Prerequisites
* **Node.js:** v18.x or v20.x or v22.x
* **Python:** v3.11 or v3.12
* **Package Managers:** `npm` and `pip`

### Step 1: Clone the Repository
```bash
git clone git@github.com-vvijay:vvijay-99/WealthIQ_final.git
cd WealthIQ_final
```

### Step 2: Install Web Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create `.env.local` in the project root:

```ini
# Supabase Configuration (Required for database and authentication)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-anon-key

# Transaction Classifier Microservice (Optional: defaults to local fallback or localhost:8001)
TRANSACTION_CLASSIFIER_URL=https://wealthiq-classifier-o7nt9hbk3-adityaprajapati-5528s-projects.vercel.app
CLASSIFIER_API_SECRET=your-classifier-shared-secret
CLASSIFIER_TIMEOUT_MS=4500

# Household Spending Benchmark Microservice (Optional: defaults to local script or localhost:8002)
BENCHMARK_API_URL=https://wealthiq-benchmark.vercel.app
BENCHMARK_TIMEOUT_MS=4000
```

> [!NOTE]
> Do not commit `.env` or `.env.local` to version control. All `.env*` files are ignored via `.gitignore`.

### Step 4: Run Next.js Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Running the Machine Learning Pipelines Locally

### Setting Up the Python Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install scikit-learn==1.4.1.post1 joblib==1.3.2 numpy==1.26.4 pandas==2.2.1 fastapi==0.110.0 uvicorn==0.28.0 pydantic==2.6.4
```

### 1. Test Transaction Classifier
```bash
# Evaluate model on 2,349 locked test samples and 116 challenge cases
python3 ml/classifier/evaluate_phase5_offline.py

# Run standalone prediction
python3 -c "
import sys; sys.path.insert(0, 'ml/classifier')
from hybrid_classifier_v2 import categorize_v2
print(categorize_v2('Swiggy dinner order 48291'))
"
```

### 2. Test Household Spending Benchmark
```bash
# Run standalone HCES regression prediction
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

---

## 6. Verification & Test Suites

The repository contains regression tests covering frontend compilation, database transactions, API security, and ML inference:

```bash
# 1. ESLint Static Code Analysis (0 errors, 0 warnings)
npm run lint

# 2. Next.js Production Build (compiles all 21 routes)
npm run build

# 3. Phase 11 Forecasting Invariant Test (25 tests)
npx tsx scratch/verify_phase11_forecasting.ts

# 4. Phase 13 Security & JWT Gate Test (16 tests)
npx tsx scratch/verify_phase13_security.ts

# 5. Phase 17 HCES Benchmark ML Integrity (13 tests)
npx tsx scratch/verify_phase17_benchmark.ts

# 6. Classifier Regression Tests (10 tests)
npx tsx scratch/verify_classifier_regressions.ts

# 7. Production Release End-to-End Suite (19 tests covering live domain)
node scratch/verify_production_release.js
```

---

## 7. Known Limitations & Attribution

1. **Academic Project Disclaimer:** WealthIQ is an educational project created for a college Artificial Intelligence course. It does not provide certified financial, tax, or investment advice.
2. **Synthetic Bank Text Limitations:** The transaction classifier was trained on an enriched hybrid dataset combining synthetic templates and curated Indian merchant patterns. Real-world SMS narrations may contain OCR errors or non-standard regional bank abbreviations.
3. **Macro-Statistical Nature of HCES Benchmark:** MoSPI HCES 2023–24 captures population-level consumption trends. Individual household expenses vary due to unobserved factors such as debt obligations, healthcare emergencies, and personal lifestyle choices.

---

## 8. Authors & Academic Context

* **Project:** WealthIQ — Intelligent Personal Finance & Predictive Financial Intelligence
* **Release:** Final Production Release (v1.0.0)
* **Live Deployment:** [https://wealthiq-nine.vercel.app](https://wealthiq-nine.vercel.app)
* **Repository:** [https://github.com/vvijay-99/WealthIQ_final](https://github.com/vvijay-99/WealthIQ_final)
