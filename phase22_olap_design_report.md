# WealthIQ — Phase 22, Task 1: OLAP Database Inspection and Design Report

**Project:** WealthIQ — Educational AI Financial Health & Analytics Platform
**Phase:** 22 — OLAP Analytical Layer & Multi-Dimensional Financial Intelligence
**Task:** 1 — OLAP Database Inspection, Schema Analysis, and Logical Analytical Layer Design
**Date:** November 1, 2026
**Status:** Complete & Awaiting User Review (No Code / Schema Mutations Applied)

---

## 1. Executive Summary

Phase 22 introduces a dedicated **Online Analytical Processing (OLAP)** analytical layer to WealthIQ. While previous phases (Phases 1–21) established robust Online Transaction Processing (OLTP) tables, deterministic financial scoring, next-month expense moving averages, and external machine learning microservices (transaction classification and HCES benchmark regression), analytical queries across multi-period horizons have operated primarily through ad-hoc, in-memory client-side JavaScript filters and iterations.

The objective of Task 1 is to:
1. Perform a comprehensive technical inspection of the existing WealthIQ Supabase database schema, table structures, constraints, indexes, RLS policies, and query patterns across the 7 core financial tables: `income_records`, `expense_records`, `savings_records`, `financial_history`, `debts`, `investments`, and `fixed_deposits`.
2. Address the fundamental dimensional modeling challenge: separating **transaction-level flows** (inflows and outflows occurring on discrete calendar dates) from **monthly financial balance sheet snapshots** (stocks and point-in-time asset/liability values) to strictly prevent duplicate aggregation, inflation, and double-counting errors.
3. Design a logical, multi-dimensional OLAP analytical architecture incorporating standardized dimensions (Time, Activity, Category, Expense Type, Income Type) and additive/derived measures (Total Income, Total Expenses, Net Cash Flow, Transaction Count, Average Transaction Amount).
4. Formulate the concrete operational mechanics for all core OLAP operations: **Roll-up**, **Drill-down**, **Slice**, **Dice**, and **Pivot**.
5. Establish an API and query implementation roadmap compatible with Supabase Row Level Security (RLS) and Next.js server/client architectures, highlighting data limitations caused by missing or sparse historical records.

In strict compliance with instructions:
- **Zero code, schema, trigger, or RLS policy mutations** have been executed during Task 1.
- **Zero dummy data** has been injected into production or user accounts.

---

## 2. Actual Database Fields & Schema Inspection

WealthIQ operates on PostgreSQL via Supabase. All user-specific tables enforce tenant isolation via a foreign key `user_id` referencing `auth.users(id)` with `ON DELETE CASCADE` and strict Row Level Security (`auth.uid() = user_id`).

Below is the verified inventory of actual fields, data types, defaults, constraints, and indexes across the seven target tables:

```
+---------------------------------------------------------------------------------------------------------+
|                                    WEALTHIQ CORE FINANCIAL TABLES INVENTORY                             |
+---------------------------------------------------------------------------------------------------------+
  TABLE: income_records            TABLE: expense_records            TABLE: savings_records
  - id (uuid, PK)                  - id (uuid, PK)                   - id (uuid, PK)
  - user_id (uuid, FK)             - user_id (uuid, FK)              - user_id (uuid, FK)
  - amount (numeric)               - category (text)                 - amount (numeric)
  - income_type (text)             - amount (numeric)                - record_date (date)
  - record_date (date)             - expense_type (text)             - savings_type (text)
  - created_at (timestamptz)       - record_date (date)              - created_at (timestamptz)
                                   - description (text, nullable)
                                   - created_at (timestamptz)

  TABLE: debts                     TABLE: investments                TABLE: fixed_deposits
  - id (uuid, PK)                  - id (uuid, PK)                   - id (uuid, PK)
  - user_id (uuid, FK)             - user_id (uuid, FK)              - user_id (uuid, FK)
  - debt_type (text)               - asset_type (text)               - bank_name (text)
  - original_principal (numeric)   - symbol (text)                   - principal (numeric)
  - remaining_balance (numeric)    - quantity (numeric)              - interest_rate (numeric)
  - interest_rate (numeric)        - purchase_price (numeric)        - tenure_months (integer)
  - monthly_emi (numeric)          - current_value (numeric)         - start_date (date)
  - remaining_months (integer)     - created_at (timestamptz)        - maturity_date (date, null)
  - created_at (timestamptz)       - updated_at (timestamptz)        - senior_citizen (boolean)
  - updated_at (timestamptz)                                         - created_at (timestamptz)

  TABLE: financial_history (Monthly Snapshot Table)
  - id (uuid, PK)                  - month (text: 'YYYY-MM')         - income (numeric)
  - user_id (uuid, FK)             - expenses (numeric)              - savings (numeric)
  - debt (numeric)                 - investments (numeric)           - fd_value (numeric)
  - net_worth (numeric)            - created_at (timestamptz)
```

### Detailed Table Specifications

#### 2.1 `income_records` (Transaction Flow: Inflow)
- **Primary Purpose:** Records discrete or recurring income cash inflows.
- **Physical Fields:**
  - `id` (`uuid`, PRIMARY KEY, `DEFAULT gen_random_uuid()`): Unique record identifier.
  - `user_id` (`uuid`, NOT NULL, `DEFAULT auth.uid()`, FK to `auth.users(id)` ON DELETE CASCADE): Owner ID.
  - `amount` (`numeric`, NOT NULL, `DEFAULT 0`): Gross received monetary amount.
  - `income_type` (`text`, NOT NULL, `DEFAULT 'Salary'`): Classification category (Standard UI values: `'Salary'`, `'Freelance'`, `'Business'`, `'Investments'`, `'Rental'`, `'Bonus'`, `'Pension'`, `'Other'`).
  - `record_date` (`date`, NOT NULL, `DEFAULT CURRENT_DATE`): Calendar date on which income was received or credited.
  - `created_at` (`timestamptz`, `DEFAULT now()`): Audit insert timestamp.
- **Indexes:** `idx_income_records_user_id` on `user_id`, `idx_income_records_record_date` on `record_date`.
- **OLAP Role:** Fact table constituent for Transactional Inflows.

#### 2.2 `expense_records` (Transaction Flow: Outflow)
- **Primary Purpose:** Records discrete expense transactions and spending events.
- **Physical Fields:**
  - `id` (`uuid`, PRIMARY KEY, `DEFAULT gen_random_uuid()`): Unique record identifier.
  - `user_id` (`uuid`, NOT NULL, `DEFAULT auth.uid()`, FK to `auth.users(id)` ON DELETE CASCADE): Owner ID.
  - `category` (`text`, NOT NULL): Functional spending category (Standard UI values: `'Housing'`, `'Food'`, `'Transportation'`, `'Utilities'`, `'Healthcare'`, `'Education'`, `'Entertainment'`, `'Shopping'`, `'Other'`).
  - `amount` (`numeric`, NOT NULL, `DEFAULT 0`): Expended monetary amount.
  - `expense_type` (`text`, NOT NULL, `DEFAULT 'essential'`, CHECK `expense_type IN ('essential', 'discretionary')`): Fundamental economic classification.
  - `record_date` (`date`, NOT NULL, `DEFAULT CURRENT_DATE`): Calendar transaction date.
  - `description` (`text`, NULLABLE): User merchant memo or item note (up to 500 characters).
  - `created_at` (`timestamptz`, `DEFAULT now()`): Audit insert timestamp.
- **Indexes:** `idx_expense_records_user_id` on `user_id`, `idx_expense_records_record_date` on `record_date`.
- **OLAP Role:** Fact table constituent for Transactional Outflows.

#### 2.3 `savings_records` (Dual Nature: Snapshot Balance vs Contribution Flow)
- **Primary Purpose:** Tracks user liquid savings deposits, reserves, and emergency funds.
- **Physical Fields:**
  - `id` (`uuid`, PRIMARY KEY, `DEFAULT gen_random_uuid()`): Unique record identifier.
  - `user_id` (`uuid`, NOT NULL, `DEFAULT auth.uid()`, FK to `auth.users(id)` ON DELETE CASCADE): Owner ID.
  - `amount` (`numeric`, NOT NULL, `DEFAULT 0`): Account balance or deposit amount.
  - `record_date` (`date`, NOT NULL, `DEFAULT CURRENT_DATE`): Date recorded.
  - `savings_type` (`text`, NOT NULL, `DEFAULT 'Total Savings'`): Classification category (`'Total Savings'`, `'Emergency Fund'`, `'Monthly Savings'`, `'Goal Savings'`, `'Retirement Savings'`, `'Other'`).
  - `created_at` (`timestamptz`, `DEFAULT now()`): Audit insert timestamp.
- **Indexes:** `idx_savings_records_user_id` on `user_id`, `idx_savings_records_record_date` on `record_date`.
- **OLAP Role & Critical Nuance:** In the current application (`lib/financial-engine.ts`), `'Total Savings'` is treated as a cumulative balance snapshot (Stock), whereas `'Monthly Savings'` behaves as an incremental monthly allocation (Flow). The OLAP architecture must bifurcate these types to avoid summing account balances into monthly cash flows.

#### 2.4 `financial_history` (Periodic Monthly Snapshot)
- **Primary Purpose:** End-of-month aggregate snapshot of financial health and net worth.
- **Physical Fields:**
  - `id` (`uuid`, PRIMARY KEY, `DEFAULT gen_random_uuid()`): Unique snapshot ID.
  - `user_id` (`uuid`, NOT NULL, `DEFAULT auth.uid()`, FK to `auth.users(id)` ON DELETE CASCADE): Owner ID.
  - `month` (`text`, NOT NULL): Period identifier formatted as `'YYYY-MM'` (e.g., `'2026-10'`).
  - `income` (`numeric`, NOT NULL, `DEFAULT 0`): Monthly total income snapshot.
  - `expenses` (`numeric`, NOT NULL, `DEFAULT 0`): Monthly total expenses snapshot.
  - `savings` (`numeric`, NOT NULL, `DEFAULT 0`): Monthly closing liquid savings balance.
  - `debt` (`numeric`, NOT NULL, `DEFAULT 0`): Monthly total outstanding debt balance.
  - `investments` (`numeric`, NOT NULL, `DEFAULT 0`): Monthly closing investment portfolio value.
  - `fd_value` (`numeric`, NOT NULL, `DEFAULT 0`): Monthly fixed deposit principal + accrued interest.
  - `net_worth` (`numeric`, NOT NULL, `DEFAULT 0`): Net worth snapshot (`savings + investments + fd_value - debt`).
  - `created_at` (`timestamptz`, `DEFAULT now()`): Audit insert timestamp.
- **Indexes:** `idx_financial_history_user_id` on `user_id`, `idx_financial_history_month` on `month`.
- **OLAP Role:** Pre-aggregated Monthly Snapshot Fact Cube (Stock & Periodic Flow Rollup).

#### 2.5 `debts` (State / Liability Snapshot)
- **Primary Purpose:** Tracks active loan liabilities, mortgages, credit lines, and EMIs.
- **Physical Fields:**
  - `id` (`uuid`, PRIMARY KEY, `DEFAULT gen_random_uuid()`): Unique debt record identifier.
  - `user_id` (`uuid`, NOT NULL, `DEFAULT auth.uid()`, FK to `auth.users(id)` ON DELETE CASCADE): Owner ID.
  - `debt_type` (`text`, NOT NULL): Loan type (`'Home Loan'`, `'Car Loan'`, `'Personal Loan'`, `'Education Loan'`, `'Credit Card'`, `'Business Loan'`, `'Other'`).
  - `original_principal` (`numeric`, NOT NULL, `DEFAULT 0`): Sanctioned loan amount.
  - `remaining_balance` (`numeric`, NOT NULL, `DEFAULT 0`): Current outstanding principal liability.
  - `interest_rate` (`numeric`, NOT NULL, `DEFAULT 0`): Annual percentage rate (APR).
  - `monthly_emi` (`numeric`, NOT NULL, `DEFAULT 0`): Monthly scheduled payment obligation.
  - `remaining_months` (`integer`, NOT NULL, `DEFAULT 0`): Remaining amortization duration.
  - `created_at` (`timestamptz`, `DEFAULT now()`): Audit insert timestamp.
  - `updated_at` (`timestamptz`, `DEFAULT now()`): Amortization / balance update timestamp.
- **Indexes:** `idx_debts_user_id` on `user_id`.
- **Triggers:** `trg_debts_updated_at` (executes `update_updated_at_column()` on UPDATE).
- **OLAP Role:** Point-in-Time Liability Snapshot; not a transactional expense ledger.

#### 2.6 `investments` (State / Asset Portfolio Snapshot)
- **Primary Purpose:** Tracks asset holdings across equity, mutual funds, gold, crypto, and real estate.
- **Physical Fields:**
  - `id` (`uuid`, PRIMARY KEY, `DEFAULT gen_random_uuid()`): Unique holding ID.
  - `user_id` (`uuid`, NOT NULL, `DEFAULT auth.uid()`, FK to `auth.users(id)` ON DELETE CASCADE): Owner ID.
  - `asset_type` (`text`, NOT NULL): Asset category (`'Stock'`, `'Mutual Fund'`, `'ETF'`, `'Bond'`, `'Gold'`, `'Crypto'`, `'Real Estate'`, `'Other'`).
  - `symbol` (`text`, NOT NULL): Ticker symbol or asset name (e.g., `'RELIANCE'`, `'NIFTYBEES'`).
  - `quantity` (`numeric`, NOT NULL, `DEFAULT 0`): Held units.
  - `purchase_price` (`numeric`, NOT NULL, `DEFAULT 0`): Weighted average cost per unit.
  - `current_value` (`numeric`, NOT NULL, `DEFAULT 0`): Current market price per unit.
  - `created_at` (`timestamptz`, `DEFAULT now()`): Audit insert timestamp.
  - `updated_at` (`timestamptz`, `DEFAULT now()`): Price/valuation update timestamp.
- **Indexes:** `idx_investments_user_id` on `user_id`.
- **Triggers:** `trg_investments_updated_at` (executes `update_updated_at_column()` on UPDATE).
- **OLAP Role:** Point-in-Time Asset Valuation Snapshot. Total holding value = `quantity * current_value`; invested capital = `quantity * purchase_price`.

#### 2.7 `fixed_deposits` (State / Term Contract Snapshot)
- **Primary Purpose:** Fixed-income deposits with defined maturity dates and interest terms.
- **Physical Fields:**
  - `id` (`uuid`, PRIMARY KEY, `DEFAULT gen_random_uuid()`): Unique deposit ID.
  - `user_id` (`uuid`, NOT NULL, `DEFAULT auth.uid()`, FK to `auth.users(id)` ON DELETE CASCADE): Owner ID.
  - `bank_name` (`text`, NOT NULL): Issuing financial institution.
  - `principal` (`numeric`, NOT NULL, `DEFAULT 0`): Initial deposit principal.
  - `interest_rate` (`numeric`, NOT NULL, `DEFAULT 0`): Contracted annual interest rate.
  - `tenure_months` (`integer`, NOT NULL, `DEFAULT 12`): Contract duration in months.
  - `start_date` (`date`, NOT NULL, `DEFAULT CURRENT_DATE`): Deposit start date.
  - `maturity_date` (`date`, NULLABLE): Scheduled maturity date.
  - `senior_citizen` (`boolean`, NOT NULL, `DEFAULT false`): Preferential rate eligibility.
  - `created_at` (`timestamptz`, `DEFAULT now()`): Audit insert timestamp.
- **Indexes:** `idx_fixed_deposits_user_id` on `user_id`.
- **OLAP Role:** Contractual Asset Snapshot with temporal start/maturity boundaries.

---

## 3. Existing Supabase Queries & Application Architecture Audit

Inspection of `app/dashboard/page.tsx`, `app/expenses/page.tsx`, `app/income/page.tsx`, `app/forecast/page.tsx`, and `lib/financial-engine.ts` reveals key characteristics of the current data retrieval and processing model:

1. **Client-Side Bulk Record Loading:**
   When a user loads the dashboard or forecast page, the frontend issues 6 parallel Supabase requests:
   ```typescript
   const [incomeRes, expenseRes, savingsRes, debtRes, investRes, fdRes] = await Promise.all([
     supabase.from('income_records').select('*').eq('user_id', userId),
     supabase.from('expense_records').select('*').eq('user_id', userId),
     supabase.from('savings_records').select('*').eq('user_id', userId),
     supabase.from('debts').select('*').eq('user_id', userId),
     supabase.from('investments').select('*').eq('user_id', userId),
     supabase.from('fixed_deposits').select('*').eq('user_id', userId),
   ]);
   ```
2. **In-Memory JavaScript Aggregation:**
   Metrics such as `monthlyIncome`, `monthlyExpenses`, `essentialExpenses`, and `current_savings` are calculated via `.reduce()` in client memory (`dashboard/page.tsx:220–280`).
3. **Dynamic Temporal Aggregation in `financial-engine.ts`:**
   In Phase 11, `aggregateMonthlyExpenses` was introduced to group `expense_records` into monthly buckets (`{ month, total, essential, discretionary, recordCount, categories }`) strictly in JavaScript, using regex extraction (`YYYY-MM`) from `record_date`.
4. **Current State of `financial_history`:**
   Although `financial_history` was defined in the base schema (`20260812073658_create_wealthiq_schema.sql:420`), **none of the active application pages currently insert or query rows from this table**. The forecast engine operates by calculating a baseline surplus from the current month's active records and projecting forward 6 to 36 months deterministically.
5. **Architectural Opportunity:**
   Moving analytical workloads to a structured OLAP layer reduces network payload size (aggregations returned instead of raw row sets), enables instantaneous multi-dimensional cross-tabulation (Slice, Dice, Pivot), eliminates duplicate aggregation logic across UI pages, and provides a single source of analytical truth.

---

## 4. Separation of Transaction Flows vs. Balance Sheet Snapshots

A primary requirement of OLAP design is avoiding the **Additivity Trap**. Naive implementations often attempt to combine all financial records into a single unified table, leading to severe double-counting and aggregation errors.

### The Additivity Hierarchy

| Metric Classification | Mathematical Property | Examples in WealthIQ | Safe Aggregations | Dangerous / Invalid Aggregations |
| :--- | :--- | :--- | :--- | :--- |
| **Flows (Transaction-Level)** | **Fully Additive** across all dimensions including Time | `income_records.amount`, `expense_records.amount` | `SUM(amount)` across Days, Months, Quarters, Categories | Treating a single transaction as a recurring monthly balance |
| **Stocks / Balances (Point-in-Time)** | **Semi-Additive** (Additive across entities, but NOT across Time) | `savings_records.amount` (Total Savings), `debts.remaining_balance`, `investments.current_value`, `fixed_deposits.principal` | `SUM()` across categories within a single snapshot date (e.g., Total Debt on Oct 31 = Car Loan + Home Loan) | `SUM()` across Time (Summing Oct savings + Nov savings creates fictitious wealth) |
| **Derived Ratios / Averages** | **Non-Additive** | Average Transaction Amount, Expense Ratio, Savings Rate | Weighted recalculation at the target aggregation grain: `SUM(amount) / COUNT(*)` | Averaging pre-computed averages (`AVG(AVG(x))`) |

### Two-Cube Constellation Architecture

To prevent duplicate aggregation, WealthIQ's OLAP layer is logically partitioned into two distinct analytical cubes:

```
+---------------------------------------------------------------------------------------------------------+
|                                  WEALTHIQ LOGICAL OLAP ARCHITECTURE                                      |
+---------------------------------------------------------------------------------------------------------+
                                                     │
               ┌─────────────────────────────────────┴─────────────────────────────────────┐
               ▼                                                                           ▼
+───────────────────────────────────────────────+           +───────────────────────────────────────────────+
|         CUBE 1: CASHFLOW TRANSACTIONS         |           |       CUBE 2: MONTHLY FINANCIAL SNAPSHOTS     |
|             (Flow / Activity Grain)           |           |            (Stock / Balance Sheet Grain)      |
+───────────────────────────────────────────────+           +───────────────────────────────────────────────+
| Grain: One row per discrete cash movement     |           | Grain: One row per user per calendar month    |
| Source: income_records + expense_records      |           | Source: financial_history (or snapshot engine)|
|                                               |           |                                               |
| Supported Dimensions:                         |           | Supported Dimensions:                         |
| - Dim_Time (Day, Month, Quarter, Year)        |           | - Dim_Time (Month, Quarter, Year)             |
| - Dim_Activity (Income vs Expense)            |           | - Dim_User (Tenant / Profile)                 |
| - Dim_Category (17 normalized categories)     |           |                                               |
| - Dim_Expense_Type (essential/discretionary)  |           | Measures (Semi-Additive across Time):         |
| - Dim_Income_Type (Salary, Freelance, etc.)   |           | - Closing Savings Balance                     |
|                                               |           | - Outstanding Debt Balance                    |
| Measures (Fully Additive across Time):        |           | - Portfolio Investment Value                  |
| - Total Income                                |           | - Fixed Deposit Asset Value                   |
| - Total Expenses                              |           | - Monthly Net Worth                           |
| - Net Cash Flow (Income - Expense)            |           |                                               |
| - Transaction Count                           |           | Reconciled Monthly Flow Totals:               |
| - Average Transaction Amount (Derived)        |           | - Monthly Inflow Total, Monthly Outflow Total |
+───────────────────────────────────────────────+           +───────────────────────────────────────────────+
```

### Protection Against Double-Counting
1. **No Mixed Sums:** A query requesting "Total Cash Flow in Q3" queries **Cube 1** (`CASHFLOW TRANSACTIONS`) exclusively.
2. **No Balance Summation:** A query requesting "Net Worth Trend across 2026" queries **Cube 2** (`MONTHLY FINANCIAL SNAPSHOTS`) using point-in-time closing values (`month = '2026-09'`), strictly prohibiting `SUM(net_worth)` across multiple months.
3. **Reconciliation Bridge:** Cube 2 can validate its monthly flow summary against Cube 1's aggregate roll-up (`Cube 2.income == SUM(Cube 1.amount WHERE Activity = 'INCOME' AND Month = M)`), but raw transactions and monthly history rows are never joined in a multiplicative cartesian product.

---

## 5. Dimension Definitions & Hierarchies

Dimensions provide the structured contexts against which numeric measures are sliced, diced, and pivoted. Each dimension is strictly grounded in the verified database fields:

### 5.1 Dimension 1: `Dim_Time`
- **Supported Fields:** `record_date` (`income_records`, `expense_records`, `savings_records`), `start_date` (`fixed_deposits`), `month` (`financial_history`).
- **Hierarchy Structure:**
  $$\text{Year} \longrightarrow \text{Quarter} \longrightarrow \text{Month} \longrightarrow \text{Day}$$
- **Attribute Mapping:**
  - `day`: Calendar date formatted as `YYYY-MM-DD` (e.g., `'2026-10-15'`), Day of month (`1–31`), Day of week (`Monday–Sunday`).
  - `month`: Year-Month identifier formatted as `YYYY-MM` (e.g., `'2026-10'`), Month name (`'October'`), Month number (`10`).
  - `quarter`: Year-Quarter identifier formatted as `YYYY-Q#` (e.g., `'2026-Q4'`), Quarter name (`'Q4'`).
  - `year`: 4-digit calendar year integer (e.g., `2026`).

### 5.2 Dimension 2: `Dim_Activity`
- **Supported Fields:** Synthesized from record origin table (`income_records` vs `expense_records`).
- **Allowed Values:**
  - `'INCOME'`: Positive cash movement into user liquidity.
  - `'EXPENSE'`: Cash outflow representing consumption or service payment.
- **Hierarchy Structure:** Flat dimension (Activity $\rightarrow$ Transaction).

### 5.3 Dimension 3: `Dim_Category`
- **Supported Fields:** `expense_records.category` and `income_records.income_type`.
- **Allowed Values:**
  - Inflow Categories: `'Salary'`, `'Freelance'`, `'Business'`, `'Investments'`, `'Rental'`, `'Bonus'`, `'Pension'`, `'Other'`.
  - Outflow Categories: `'Housing'`, `'Food'`, `'Transportation'`, `'Utilities'`, `'Healthcare'`, `'Education'`, `'Entertainment'`, `'Shopping'`, `'Other'`.
- **Classification Mapping:** Every transaction maps to exactly one Category within its Activity domain.

### 5.4 Dimension 4: `Dim_Expense_Type`
- **Supported Fields:** `expense_records.expense_type`.
- **Allowed Values:**
  - `'essential'`: Inelastic survival and operational expenses (Housing, Groceries, Utilities, Healthcare, Debt EMI).
  - `'discretionary'`: Elastic lifestyle expenses (Dining out, Entertainment, Luxury Shopping).
  - `'not_applicable'`: Default assigned to all `'INCOME'` transactions to preserve orthogonal dimension filtering without dropping rows.

### 5.5 Dimension 5: `Dim_Income_Type`
- **Supported Fields:** `income_records.income_type`.
- **Allowed Values:**
  - Active Earned Income: `'Salary'`, `'Freelance'`, `'Business'`.
  - Passive / Portfolio Income: `'Investments'`, `'Rental'`, `'Pension'`.
  - Irregular / Lump-Sum Income: `'Bonus'`, `'Other'`.
  - `'not_applicable'`: Assigned to all `'EXPENSE'` transactions.

---

## 6. Measure Definitions & Computational Logic

Measures are the quantitative values computed across dimension coordinates.

### 6.1 Total Income
- **Mathematical Formula:**
  $$\text{Total Income} = \sum_{t \in T} \mathbb{I}(\text{Activity}_t = \text{'INCOME'}) \times \text{amount}_t$$
- **Additivity:** Fully additive across all time periods, users, and income categories.
- **Null Safety:** Evaluates to `0.00` when no income records exist in the filtered cell.

### 6.2 Total Expenses
- **Mathematical Formula:**
  $$\text{Total Expenses} = \sum_{t \in T} \mathbb{I}(\text{Activity}_t = \text{'EXPENSE'}) \times \text{amount}_t$$
- **Additivity:** Fully additive across all time periods, users, expense categories, and expense types.
- **Null Safety:** Evaluates to `0.00` when no expense records exist in the filtered cell.

### 6.3 Net Cash Flow
- **Mathematical Formula:**
  $$\text{Net Cash Flow} = \text{Total Income} - \text{Total Expenses}$$
- **Economic Interpretation:**
  - Positive ($> 0$): Cash surplus available for emergency funding, capital accumulation, or discretionary savings.
  - Negative ($< 0$): Cash deficit indicating reserve depletion or short-term debt financing.
  - Zero ($= 0$): Cash break-even.
- **Additivity:** Fully additive across Time (e.g., Year Cash Flow = Sum of 4 Quarter Cash Flows).

### 6.4 Transaction Count
- **Mathematical Formula:**
  $$\text{Transaction Count} = \text{COUNT}(t)$$
- **Additivity:** Fully additive across all dimensional hierarchies. Tracks transaction frequency and logging velocity.

### 6.5 Average Transaction Amount
- **Mathematical Formula:**
  $$\text{Average Transaction Amount} = \frac{\sum \text{amount}_t}{\text{COUNT}(t)}$$
- **Additivity:** **Strictly Non-Additive.** Must always be derived as $\frac{\text{Additive Sum}}{\text{Additive Count}}$ at the query's group-by grain.

---

## 7. Operational Mechanics of OLAP Operations

The logical OLAP layer provides five core analytical operations for user-driven exploration:

```
               ┌────────────────────────────────────────────────────────┐
               │                     ROLL-UP                            │
               │   Daily -> Monthly -> Quarterly -> Annual              │
               └───────────────────────────▲────────────────────────────┘
                                           │
  ┌───────────────────────┐                │                ┌───────────────────────┐
  │         SLICE         │                │                │         DICE          │
  │ Single-Dimension Cut  │◄───────────────┼───────────────►│ Multi-Dimension Box   │
  │ (e.g., Month='2026-10'│                │                │ (Food/Oct/Essential)  │
  └───────────────────────┘                │                └───────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                   DRILL-DOWN                           │
               │   Annual -> Quarterly -> Monthly -> Daily              │
               └────────────────────────────────────────────────────────┘
                                           ▲
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                      PIVOT                             │
               │   Swap Axes: Rows=Category, Columns=Month              │
               └────────────────────────────────────────────────────────┘
```

### 7.1 Roll-up (Aggregation / Generalization)
- **Concept:** Moving up a dimensional hierarchy or collapsing a dimension to reduce granularity.
- **Financial Scenario:**
  1. User starts at the **Daily** grain: Inspecting daily expenses between `2026-10-01` and `2026-10-31`.
  2. User rolls up along `Dim_Time` to **Monthly**: The analytical engine collapses all 31 days into a single summary row:
     $$\text{Month: '2026-10'} \quad\vert\quad \text{Total Income: ₹85,000} \quad\vert\quad \text{Total Expenses: ₹52,400} \quad\vert\quad \text{Net Cash Flow: +₹32,600}$$
  3. User rolls up further to **Quarterly** (`2026-Q4`): Combines October, November, and December.
- **Query Mechanic:** Change `GROUP BY` from `record_date` to `DATE_TRUNC('month', record_date)` or `DATE_TRUNC('quarter', record_date)`.

### 7.2 Drill-down (De-aggregation / Specialization)
- **Concept:** Moving down a dimensional hierarchy or introducing a new dimension to reveal detailed causes of aggregate figures.
- **Financial Scenario:**
  1. User notices an anomalous increase in expenses in `2026-Q3` (Total Expenses: `₹2,10,000`).
  2. User drills down into **Month**: Discovers that August 2026 accounted for `₹1,25,000` of the quarter's total.
  3. User drills down into **Dim_Category**: Slices August 2026 by Category; discovers `'Healthcare'` spiked from its usual `₹3,000` to `₹75,000`.
  4. User drills down to **Day / Description**: Identifies an emergency hospitalization invoice on `2026-08-14`.
- **Query Mechanic:** Append dimension attributes to the `SELECT` and `GROUP BY` clauses (e.g., add `category` or `record_date`).

### 7.3 Slice (Single-Dimension Cut)
- **Concept:** Fixing exactly one dimension to a single constant value, creating a 2D slice of a multi-dimensional cube.
- **Financial Scenario:**
  - **Slice A (Time Slice):** Filter strictly where `Dim_Time.month = '2026-10'`. Produces a comprehensive breakdown of all categories and expense types for October 2026.
  - **Slice B (Expense Type Slice):** Filter strictly where `Dim_Expense_Type = 'essential'`. Evaluates nondiscretionary baseline living costs across all observed months, isolating core household burn rate from discretionary lifestyle spending.
- **Query Mechanic:** Add a single `WHERE dimension_column = 'constant'` predicate.

### 7.4 Dice (Multi-Dimensional Sub-Cube Bounding Box)
- **Concept:** Filtering simultaneously across two or more dimensions with set or range conditions, extracting a localized sub-cube.
- **Financial Scenario:**
  - **Dimensions Diced:**
    - `Dim_Time`: Range between `2026-07-01` and `2026-10-31` (last 4 months).
    - `Dim_Category`: Set `IN ('Food', 'Entertainment', 'Shopping')`.
    - `Dim_Expense_Type`: Equals `'discretionary'`.
  - **Output:** Isolates lifestyle spending across food, leisure, and shopping over the past 4 months to measure discretionary inflation without interference from fixed rent, loan EMIs, or utility payments.
- **Query Mechanic:** Multi-predicate `WHERE` clause:
  ```sql
  WHERE record_date >= '2026-07-01' AND record_date <= '2026-10-31'
    AND category IN ('Food', 'Entertainment', 'Shopping')
    AND expense_type = 'discretionary'
  ```

### 7.5 Pivot (Cross-Tabular Matrix Rotation)
- **Concept:** Rotating dimensional axes to transform row attributes into column headers, enabling direct matrix comparisons and heatmaps.
- **Financial Scenario:**
  - **Standard Relational Output:**
    - Row 1: `2026-08 | Food | ₹12,000`
    - Row 2: `2026-08 | Housing | ₹25,000`
    - Row 3: `2026-09 | Food | ₹13,500`
    - Row 4: `2026-09 | Housing | ₹25,000`
  - **Pivoted Cross-Tabulation Matrix:**
    | Category (`Rows`) | August 2026 (`Col 1`) | September 2026 (`Col 2`) | October 2026 (`Col 3`) | Row Total |
    | :--- | :--- | :--- | :--- | :--- |
    | **Housing** | ₹25,000 | ₹25,000 | ₹25,000 | ₹75,000 |
    | **Food** | ₹12,000 | ₹13,500 | ₹11,800 | ₹37,300 |
    | **Transportation**| ₹4,500 | ₹6,000 | ₹4,200 | ₹14,700 |
    | **Column Total** | ₹41,500 | ₹44,500 | ₹41,000 | **₹1,27,000** |
- **Application Value:** Users can immediately spot month-over-month category variance, budget creep, and seasonality.

---

## 8. API & Query Implementation Plan (Design Specification)

When implemented in Task 2, the OLAP layer will follow a clean, decoupled design adhering to Supabase security and Next.js server/client paradigms.

```
+─────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    PROPOSED OLAP INTEGRATION FLOW                               |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                 ▼
+───────────────────────────────────+                             +───────────────────────────────────+
|     POSTGRESQL ANALYTICAL VIEW    |                             |      CLIENT-SIDE OLAP ENGINE      |
|    (view_olap_transactions)       |                             |     (lib/olap-engine.ts)          |
| - UNION ALL income + expense      |                             | - Instant Slice/Dice/Pivot        |
| - Standardized dimension keys     |                             | - Zero-latency UI toggles         |
| - WITH (security_invoker = true)  |                             | - Offline / responsive caching    |
+─────────────────┬─────────────────+                             +─────────────────┬─────────────────+
                  │                                                                 │
                  ▼                                                                 │
+───────────────────────────────────+                                               │
|      NEXT.JS ANALYTICS ROUTE      |                                               │
|      /api/analytics/olap          |                                               │
| - Validates Bearer JWT via Supa   |                                               │
| - Applies dynamic group-bys       |                                               │
| - Returns structured cube matrix  |                                               │
+─────────────────┬─────────────────+                                               │
                  │                                                                 │
                  └───────────────────────────────┬─────────────────────────────────┘
                                                  │
                                                  ▼
                                +───────────────────────────────────+
                                |      OLAP ANALYTICS UI PAGE       |
                                |       /analytics (Dashboard)      |
                                | - Multi-dimensional drill-downs   |
                                | - Cross-tab monthly pivot matrix  |
                                | - Category vs Essential sliders   |
                                +───────────────────────────────────+
```

### 8.1 Database Layer: Unified Transaction Analytical View
A PostgreSQL view unifying `income_records` and `expense_records` into a single canonical transaction schema:

```sql
-- Design Specification for Task 2 (Not executed yet)
CREATE OR REPLACE VIEW view_olap_transactions
WITH (security_invoker = true) AS
SELECT
  id AS transaction_id,
  user_id,
  'INCOME' AS activity,
  income_type AS category,
  'not_applicable' AS expense_type,
  income_type AS income_type,
  amount,
  record_date,
  EXTRACT(YEAR FROM record_date)::integer AS year,
  (EXTRACT(YEAR FROM record_date)::text || '-Q' || EXTRACT(QUARTER FROM record_date)::text) AS quarter,
  TO_CHAR(record_date, 'YYYY-MM') AS month,
  record_date::text AS day,
  NULL::text AS description,
  created_at
FROM income_records

UNION ALL

SELECT
  id AS transaction_id,
  user_id,
  'EXPENSE' AS activity,
  category AS category,
  expense_type,
  'not_applicable' AS income_type,
  amount,
  record_date,
  EXTRACT(YEAR FROM record_date)::integer AS year,
  (EXTRACT(YEAR FROM record_date)::text || '-Q' || EXTRACT(QUARTER FROM record_date)::text) AS quarter,
  TO_CHAR(record_date, 'YYYY-MM') AS month,
  record_date::text AS day,
  description,
  created_at
FROM expense_records;
```

**Security & RLS Guarantee:**
By specifying `WITH (security_invoker = true)`, PostgreSQL executes view queries using the caller's identity rather than the view creator's identity. Thus, the underlying Row Level Security policies of `income_records` and `expense_records` (`auth.uid() = user_id`) are automatically and strictly enforced without requiring redundant policy redefinitions.

### 8.2 API Endpoint: `/api/analytics/olap`
A Next.js server route handling structured OLAP query requests:
- **Request Payload (`POST /api/analytics/olap`):**
  ```json
  {
    "cube": "transactions",
    "grain": "month",
    "dimensions": ["month", "category"],
    "measures": ["total_income", "total_expenses", "net_cash_flow", "transaction_count", "avg_amount"],
    "filters": {
      "time_range": {
        "start": "2026-01-01",
        "end": "2026-12-31"
      },
      "activity": ["EXPENSE"],
      "expense_type": ["essential", "discretionary"]
    },
    "pivot": {
      "row_dimension": "category",
      "column_dimension": "month"
    }
  }
  ```
- **Response Structure:**
  ```json
  {
    "meta": {
      "cube": "transactions",
      "grain": "month",
      "query_timestamp": "2026-11-01T21:14:42.000Z",
      "record_count": 84
    },
    "measures": ["total_income", "total_expenses", "net_cash_flow", "transaction_count", "avg_amount"],
    "data": [
      {
        "month": "2026-10",
        "category": "Housing",
        "total_income": 0,
        "total_expenses": 25000,
        "net_cash_flow": -25000,
        "transaction_count": 1,
        "avg_amount": 25000
      }
    ],
    "pivot_table": {
      "rows": ["Housing", "Food", "Transportation"],
      "columns": ["2026-08", "2026-09", "2026-10"],
      "matrix": {
        "Housing": { "2026-08": 25000, "2026-09": 25000, "2026-10": 25000 },
        "Food": { "2026-08": 12000, "2026-09": 13500, "2026-10": 11800 }
      }
    }
  }
  ```

### 8.3 Client Query Utility (`lib/olap-engine.ts`)
To maintain the app's instant responsiveness and provide offline-capable exploration, a client-side TypeScript OLAP utility will be provided in Task 2. When a user switches between category views, toggles essential filters, or pivots dimensions, the client engine can execute the transformation directly over cached user records without redundant network round-trips.

---

## 9. Historical Data Limitations & Architectural Mitigation Strategies

A rigorous OLAP system must openly document data limitations and enforce defensive engineering safeguards against sparse or missing user records:

### 9.1 Unpopulated `financial_history` Table
- **Observed Reality:** The schema includes `financial_history`, but application pages have not historically populated it during CRUD operations.
- **Architectural Impact:** A query targeting historical net worth snapshots for months prior to the user's active session will return zero rows.
- **Mitigation Strategy:**
  1. For Task 2, provide an on-demand snapshot synthesis engine that reconstructs monthly closing positions from recorded transaction logs where feasible.
  2. Implement an automated monthly snapshot trigger/function that records `financial_history` snapshots upon score recalculation.

### 9.2 Lack of Transactional Ledgers for Debts and Investments
- **Observed Reality:** `debts`, `investments`, and `fixed_deposits` represent point-in-time state tables. They do not maintain an immutable ledger of every individual EMI payment, interest accrual, or stock dividend.
- **Architectural Impact:** Users cannot execute a daily drill-down on debt amortization unless they logged the EMI as a discrete outflow in `expense_records`.
- **Mitigation Strategy:**
  - Strict separation of concerns: The transaction cube handles discrete payment events; the snapshot cube tracks balance amortization.
  - The UI will explicitly label debt and investment histories as "End-of-Month Valuation Baselines" rather than discrete trade ledgers.

### 9.3 Irregular Logging and Calendar Gaps
- **Observed Reality:** Personal finance users frequently skip logging for weeks or months. A user may log 20 expenses in October, 0 in September, and 5 in August.
- **Architectural Impact:** Naive SQL `GROUP BY record_date` skips September entirely, distorting moving averages and producing ragged pivot matrices.
- **Mitigation Strategy:**
  - Date Scaffold (Calendar Master): Analytical queries generate continuous monthly buckets between `min(date)` and `max(date)`.
  - Distinguish between a confirmed zero expenditure (`₹0.00`) and an unlogged calendar gap (`null` / `"No Data Logged"`).
  - This directly aligns with the data integrity safeguards implemented in Phase 11 (`lib/financial-engine.ts:787–800`).

### 9.4 Dual Role of `savings_records`
- **Observed Reality:** Users may insert both cumulative balances (`'Total Savings'`) and periodic allocations (`'Monthly Savings'`).
- **Architectural Impact:** Summing all rows in `savings_records` results in catastrophic double-counting (e.g., adding a ₹5,00,000 balance to a ₹20,000 monthly contribution yields ₹5,20,000, and doing so every month creates exponential balance inflation).
- **Mitigation Strategy:**
  - Slicing Rule: In the transaction cube, only records where `savings_type != 'Total Savings'` are considered for flow analysis. Cumulative balance analysis strictly isolates `'Total Savings'` rows as closing snapshot anchors.

---

## 10. Summary Matrix: Dimensions, Measures & Table Mappings

| Dimension / Measure | Data Type | Physical Source Column | Table Origin | Additivity |
| :--- | :--- | :--- | :--- | :--- |
| **Dim_Time (Day)** | `date` / `text` | `record_date` | `income_records`, `expense_records` | N/A (Dimension) |
| **Dim_Time (Month)** | `text` (`YYYY-MM`)| Derived / `month` | Derived from `record_date` / `financial_history.month` | N/A (Dimension) |
| **Dim_Time (Quarter)**| `text` (`YYYY-Q#`)| Derived | Computed from `record_date` / `month` | N/A (Dimension) |
| **Dim_Time (Year)** | `integer` (`YYYY`)| Derived | Computed from `record_date` / `month` | N/A (Dimension) |
| **Dim_Activity** | `text` | Synthetic | `'INCOME'` (income_records), `'EXPENSE'` (expense_records) | N/A (Dimension) |
| **Dim_Category** | `text` | `income_type` / `category` | `income_records.income_type`, `expense_records.category` | N/A (Dimension) |
| **Dim_Expense_Type** | `text` | `expense_type` | `expense_records.expense_type` (`'essential'`, `'discretionary'`, `'n/a'`) | N/A (Dimension) |
| **Dim_Income_Type** | `text` | `income_type` | `income_records.income_type` | N/A (Dimension) |
| **Measure: Total Income** | `numeric` | `amount` | `income_records.amount` | Fully Additive |
| **Measure: Total Expenses**| `numeric` | `amount` | `expense_records.amount` | Fully Additive |
| **Measure: Net Cash Flow** | `numeric` | Derived | `Total Income - Total Expenses` | Fully Additive across Time |
| **Measure: Transaction Count**| `integer` | `COUNT(*)` | `income_records.id`, `expense_records.id` | Fully Additive |
| **Measure: Avg Transaction Amount**| `numeric` | Derived | `SUM(amount) / COUNT(*)` | Strictly Non-Additive |
| **Snapshot: Closing Savings**| `numeric` | `amount` | `savings_records.amount` (`savings_type = 'Total Savings'`) | Semi-Additive (Point-in-Time) |
| **Snapshot: Total Debt** | `numeric` | `remaining_balance`| `debts.remaining_balance` | Semi-Additive (Point-in-Time) |
| **Snapshot: Investment Value**| `numeric`| `current_value * qty`| `investments.current_value * quantity` | Semi-Additive (Point-in-Time) |
| **Snapshot: Net Worth** | `numeric` | `net_worth` / Derived| `financial_history.net_worth` or Asset - Debt sum | Semi-Additive (Point-in-Time) |

---

## 11. Review Gate & Next Steps

Task 1 is complete. All findings, schema audits, dimensional modeling designs, and OLAP mechanics are fully documented in this report.

### Strict Governance Checklist
- [x] Inspected existing WealthIQ database schema, financial records, Supabase queries, and application architecture.
- [x] Identified actual fields available in all 7 tables (`income_records`, `expense_records`, `savings_records`, `financial_history`, `debts`, `investments`, `fixed_deposits`).
- [x] Designed a logical OLAP analytical layer using existing user data.
- [x] Defined all dimensions (Time, Activity, Category, Expense Type, Income Type) grounded in real fields.
- [x] Defined all measures (Total Income, Total Expenses, Net Cash Flow, Transaction Count, Average Transaction Amount).
- [x] Strictly separated transaction-level analysis from monthly financial snapshots to prevent duplicate aggregation.
- [x] Formulated detailed mechanics for Roll-up, Drill-down, Slice, Dice, and Pivot.
- [x] Outlined API and query implementation plan with Supabase RLS security.
- [x] Documented limitations caused by missing or sparse historical data.
- [x] **No code, database schema, or RLS policies were modified during Task 1.**
- [x] **No dummy data was used or injected as actual financial data.**
- [x] Saved findings to `phase22_olap_design_report.md`.

**Awaiting user review and approval before proceeding with Phase 22, Task 2.**
