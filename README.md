# Carez Concrete OS — v0.3

Private, mobile-first operating system designed specifically for Carez Concrete.

## Current modules

- Private owner login and company-scoped row-level security
- Lead / Bid Pipeline
- Estimates and frozen project budgets
- Projects, profitability and cost-to-complete forecasting
- Crew, timecards, daily logs and payroll funding
- Change Orders
- Billing, A/R, payments and retainage releases
- Pour Control and cash authorization
- Procurement, vendor quotes, purchase orders and vendor bills
- Accounts Payable and vendor payments
- Job Costs and actual company overhead
- Cashflow and safe-operating-cash controls
- Plaid-connected Banking with live balances and transaction sync
- Bank Reconciliation with confidence scoring, learned merchant rules and duplicate-posting safeguards
- Responsive PWA shell

## Required environment variables

Add these in the hosting provider:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

Optional:

- `PLAID_ENV` — defaults to `production`
- `PLAID_TOKEN_ENCRYPTION_KEY` — optional separate encryption material for stored Plaid access tokens; if omitted, the server derives encryption material from `PLAID_SECRET`

Never commit a Supabase service-role key, database password, Plaid secret or Plaid access token.

## Financial data-flow principle

Carez OS is designed around entering or measuring information once and reusing it downstream:

`Takeoff → Estimate → RFQ / Quote → PO → Job Cost → Billing → A/R → Collections → A/P → Expenses → Banking → Reconciliation → Cash Position`

Bank reconciliation may automatically link an imported transaction to an existing Carez financial record when the match is exact and unambiguous. Creating a new accounting event requires review unless the user has explicitly created an auto-apply merchant rule. Project-specific job-cost rules never auto-select a project.

## Build sequence

1. v0.1 — Shell and core domain ✅
2. v0.2 — Supabase database + private authentication ✅
3. v0.3 — Real lead entry + bid pipeline ✅
4. Projects + timecards + daily logs ✅
5. Job costing + profitability + forecasting ✅
6. Estimating + frozen budgets ✅
7. Change orders + billing + collections ✅
8. Pour cash control + procurement + A/P ✅
9. Actual overhead + payroll cash requirements ✅
10. Connected banking + bank reconciliation ✅
11. Takeoff / RFQ integration and deeper workflow automation — planned
