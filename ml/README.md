# WealthIQ Machine Learning Research: Financial Resilience in India

This module houses the machine-learning research component of WealthIQ, focused on modeling emergency financial resilience among adult respondents in India using the World Bank Global Findex 2025 microdata.

---

## 1. Dataset Overview & Local Paths

- **Raw Microdata**: `ml/data/raw/IND_2024_FINDEX_v02_M_CSV/Findex_Microdata_2025_updateIndia.csv`
- **Official Documentation**: `ml/data/documentation/ddi-documentation-english_microdata-7916.pdf`
- **Survey Details**:
  - **Source**: World Bank Global Findex Database 2025 (*Connectivity and Financial Inclusion in the Digital Economy*)
  - **Survey ID**: `IND_2024_FINDEX_v01_M` / `IND_2024_FINDEX_v02_M_CSV`
  - **Data Collection Agency**: Gallup, Inc. (in association with Gallup World Poll)
  - **Collection Window**: May 1, 2024 – December 31, 2024
  - **Sample Size**: 3,000 nationally representative adult respondents (ages 15+) across India
  - **Dimensions**: 3,000 rows × 199 columns (183 variables documented in DDI metadata + 16 trailing survey fields)

---

## 2. Research Objective & Proposed Target

### Research Question
> *"Can financial-inclusion, socioeconomic and digital-finance indicators help classify the reported difficulty of obtaining emergency funds within 30 days among surveyed Indian respondents?"*

### Target Indicator: `fin24a`
- **Question**: *"How difficult would it be for you to come up with [1/20th of local GNI per capita in INR] within the next 30 days? Would it be very difficult, somewhat difficult, or not difficult at all?"*
- **Observed Categories**:
  - `1` = Very difficult (1,915 respondents, 63.83% of total sample; 66.59% of non-missing)
  - `2` = Somewhat difficult (719 respondents, 23.97% of total sample; 25.00% of non-missing)
  - `3` = Not difficult at all (241 respondents, 8.03% of total sample; 8.38% of non-missing)
  - `4` = Don't know (1 respondent, 0.03%)
  - `""` (Sysmiss) = 124 respondents (4.13%)
- **Critical Survey Skip Pattern**:
  `fin24a` was **only** asked to respondents who identified a potential emergency source in question `fin24` (categories 1–6). Respondents answering `fin24 = 7` (*"I could not come up with the money"*, N = 114), `fin24 = 8` (*"Don't know"*, N = 6), and `fin24 = 9` (*"Refused"*, N = 4) were routed around `fin24a` (114 + 6 + 4 = 124).
  - *Modeling Implication*: Naively dropping missing values drops the 114 respondents in the most severe emergency liquidity distress. Preprocessing must explicitly handle this design logic (e.g., classifying `fin24=7` as severe financial emergency distress or scoping the model to respondents with potential emergency liquidity).

---

## 3. Data Governance & Licensing Restrictions

1. **Source Attribution & Citation**:
   Any publication or research derived from this dataset must cite:
   > *Development Research Group, Finance and Private Sector Development Unit (World Bank). India - The Global Findex Database 2025: Connectivity and Financial Inclusion in the Digital Economy (FINDEX 2025). Ref: IND_2024_FINDEX_v01_M.*
2. **Confidentiality & Non-Identification**:
   The data is anonymized microdata released for research purposes. Users must strictly refrain from any attempt to re-identify individuals or households.
3. **Strict Local Storage & Git Exclusion**:
   Raw microdata (`ml/data/raw/`), processed data (`ml/data/processed/`), and proprietary documentation (`ml/data/documentation/`) are **strictly excluded from Git** via `.gitignore`.
   - Never commit microdata to public or private version control.
   - Never place microdata into Next.js public assets (`public/`).
   - Never expose individual respondent records to client applications.

---

## 4. Directory Structure

```
ml/
├── README.md                      # Workspace documentation and governance rules
├── data/
│   ├── raw/                       # [GITIGNORED] Downloaded raw World Bank Findex microdata CSV
│   ├── processed/                 # [GITIGNORED] Cleaned feature matrices and splits
│   └── documentation/             # [GITIGNORED] Official DDI PDF codebooks and survey metadata
├── reports/                       # Version-controlled research, audit, and benchmark reports
│   └── india_dataset_audit_report.md
└── src/                           # Reproducible inspection, preprocessing, and modeling code
    ├── inspect_dataset.py         # Python read-only dataset verification script
    └── inspect_dataset.js         # Node.js read-only dataset verification script
```

---

## 5. Safe Local Workflow

### Running Read-Only Inspection
Verify file integrity and display summary distributions:
```bash
# Using Node.js
node ml/src/inspect_dataset.js

# Or using Python
python3 ml/src/inspect_dataset.py
```

### Preprocessing Guidelines
1. **Never Impute Unknowns as Valid Responses**: Do not map `Don't know` or `Refused` codes into standard response scales.
2. **Prevent Target Leakage**:
   - Exclude `fin24` (*Main source of emergency money*) from the feature set.
   - Exclude `fin24b` (*Runway duration after loss of primary income*) from emergency fund difficulty classification.
   - Exclude disaster-impact conditional questions (`fin24d1-d3`) and arbitrary identifiers (`wpid_random`).
   - Exclude unvarying geographic constants (`year`, `economy`, `economycode`, `regionwb`, `pop_adult`).
3. **Incorporate Survey Weights (`wgt`)**:
   Use `wgt` for weighted evaluations, summary statistics, and sample re-balancing to ensure estimates represent India's adult population.
