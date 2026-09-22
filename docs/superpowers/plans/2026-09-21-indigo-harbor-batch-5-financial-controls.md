# Batch 5 — Financial Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Indigo Harbor presentation to cash, payables, billing, purchasing, banking, payroll, job cost, overhead, and settings while retaining every financial authority.

**Architecture:** `/cashflow` is a gap audit of its accepted seed; retain its source query and current cashflow composition. Historical `/job-costs` maps to `/costs` and `/finance/overhead` maps to `/overhead`; each other requested path exists as named. Presentation may clarify existing AP, AR, retainage, banking, payroll, burden, commitment, and job-cost fields but cannot add accounting behavior.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, existing Carez component system

**Spec:** `docs/superpowers/specs/2026-09-21-indigo-harbor-product-rollout-design.md`

## Global Constraints

- Preserve AP liability/payment semantics, AR/progress billing/retainage, bank reconciliation, payroll, employer tax/L&I/workers compensation, company hourly burden, job cost posting, procurement commitments, and overhead allocation.
- Use semantic Carez tokens, ledger strips, shelves, rails, status lines, tabular money, focus-visible treatment, reduced-motion-safe pulses, narrow stacking, and supported table overflow.
- Do not invent accounting copy, formulas, posting, matching, liability, retainage, burden, commitment, or cost behavior; display only current authority or an unavailable convention.
- Do not change schema, RLS, APIs, accounting engines, bank integration architecture, routes, pushes, or deployments. Preserve functional inputs, dialogs, actions, labels, and accessibility.
- Each batch receives exactly one local commit only after targeted validation, browser QA, and Nik acceptance. Do not push or deploy.

## Review Focus

- Accepted Cashflow rendering and cash authority remain intact.
- Payables and Billing retain established AP, AR, and retainage semantics.
- Banking and Banking Rules retain connection, review, and rule state behavior.
- Payroll, job costs, and overhead retain authoritative burden/posting/allocation values.
- Procurement retains commitment and purchase-paper-trail behavior without an inventory calculation.

### Task 1: Accepted Cashflow gap audit

**Files:**
- Modify: `app/cashflow/page.tsx`
- Modify: `app/cashflow/actions.ts`

**Interfaces:**
- Consumes: accepted seed change in `app/cashflow/page.tsx`, its existing cashflow queries, linked AP/AR/bank/procurement routes, and current cash-state variables.
- Produces: only missing Indigo Harbor shelves, ledgers, action rails, and semantic state treatment.

- [ ] Step 1: Compare `app/cashflow/page.tsx` against accepted commit `bc45e01b` before editing and classify its source requirements as preserved or genuine visual gaps.
- [ ] Step 2: Preserve every accepted metric source, route link, accounting copy, and state condition; flatten only decorative wrapper structure into the current page's metric ledger and shelves.
- [ ] Step 3: Retain existing Cashflow actions and navigation; do not add 7-day net cash, AP, AR, retainage, or banking calculations.
- [ ] Step 4: Browser-check `/cashflow` in light/dark/system, desktop/narrow, keyboard focus, and reduced-motion modes.

### Task 2: Payables, Billing, and Procurement

**Files:**
- Modify: `app/payables/page.tsx`
- Modify: `app/payables/actions.ts`
- Modify: `app/billing/page.tsx`
- Modify: `app/procurement/page.tsx`
- Modify: `app/procurement/actions.ts`

**Interfaces:**
- Consumes: vendor bill/payment rows, `recordVendorPayment`, `voidVendorPayment`, billing AR/retainage rows, procurement workflow links, and purchase document state.
- Produces: AP, AR, retainage, and purchasing registers retaining their action semantics.

- [ ] Step 1: Read Bills Waiting for Payment, Payments We Made, billing sections, and procurement workflow markup.
- [ ] Step 2: Convert summary cards to ledger strips and payment/billing/procurement wrappers to shelf-led tables or workflow rails; preserve forms, vendor bill links, table overflow, and current action boundaries.
- [ ] Step 3: Use the current bill, payment, billing, retainage, and procurement fields only; retain present truthful copy when behavior is not proven by the route.
- [ ] Step 4: Browser-check `/payables`, `/billing`, and `/procurement`, including payment actions, retained table focus, links, narrow layout, and semantic warning states.

### Task 3: Banking and Banking Rules

**Files:**
- Modify: `app/banking/page.tsx`
- Modify: `components/PlaidBankControls.tsx`
- Modify: `app/banking/rules/page.tsx`
- Modify: `app/banking/actions.ts`
- Modify: `app/banking/rules/actions.ts`

**Interfaces:**
- Consumes: `PlaidConnectButton`, `RefreshBankButton`, `plaidConfigured`, bank accounts, transaction review state, bank rule state, `setBankAccountCashUse`, `setBankTransactionReview`, `setBankRuleState`, and `updateBankRule`.
- Produces: flat banking and rule registers with preserved connection and review controls.

- [ ] Step 1: Read connection controls, bank tables, review state, rules tables, and action forms.
- [ ] Step 2: Flatten decorative cards into account ledgers, transaction shelves, and rule rows; retain `PlaidConnectButton`, `RefreshBankButton`, native control boundaries, actions, and unsupported-state behavior from `plaidConfigured`.
- [ ] Step 3: Show connection, cash-use, review, and rule status solely from current state; do not claim transactions automatically match or reconcile.
- [ ] Step 4: Browser-check `/banking` and `/banking/rules` with keyboard focus, disabled connection state, action forms, narrow table overflow, and light/dark/system modes.

### Task 4: Payroll, Job Costs, Overhead, and Settings

**Files:**
- Modify: `app/payroll/page.tsx`
- Modify: `app/payroll/actions.ts`
- Modify: `app/costs/page.tsx`
- Modify: `app/costs/actions.ts`
- Modify: `app/overhead/page.tsx`
- Modify: `app/overhead/actions.ts`
- Modify: `app/settings/page.tsx`
- Modify: `components/settings/AppearanceSettings.tsx`
- Modify: `components/settings/CompanyBrandingSettings.tsx`
- Modify: `app/settings/actions.ts`

**Interfaces:**
- Consumes: payroll run state and actions, project-cost rows, overhead plan/item values and actions, `AppearanceSettings`, `CompanyBrandingSettings`, company settings, and `signOut`.
- Produces: ledger-based financial administration screens without changing burden, allocation, cost, identity, or appearance authority.

- [ ] Step 1: Read payroll, cost, overhead, and settings section headings, metrics, form controls, and action boundaries.
- [ ] Step 2: Flatten decorative metric/grouping cards into ledger strips and shelves; preserve payroll run controls, job-cost forms, overhead plan/item inputs, appearance controls, branding controls, and sign-out action.
- [ ] Step 3: Render L&I/regulatory burden, payroll, job-cost, and overhead values only from current fields and helpers; do not calculate an hourly burden, cost posting, or overhead allocation in the client.
- [ ] Step 4: Browser-check `/payroll`, `/costs`, `/overhead`, and `/settings`, including action forms, theme selection, focus, reduced motion, light/dark/system, and narrow layouts.

### Task 5: Batch validation and acceptance stop

**Files:**
- Modify: `app/cashflow/page.tsx`
- Modify: `app/payables/page.tsx`
- Modify: `app/billing/page.tsx`
- Modify: `app/procurement/page.tsx`
- Modify: `app/banking/page.tsx`
- Modify: `app/banking/rules/page.tsx`
- Modify: `app/payroll/page.tsx`
- Modify: `app/costs/page.tsx`
- Modify: `app/overhead/page.tsx`
- Modify: `app/settings/page.tsx`

**Interfaces:**
- Consumes: all Batch 5 authority and presentation contracts.
- Produces: validation evidence for Nik review.

- [ ] Step 1: Report that no targeted test file exists for these finance presentation routes; do not add a visual-only test framework.
- [ ] Step 2: Run `pnpm typecheck`.
- [ ] Step 3: Inspect `git status --short` and `git diff --stat`.
- [ ] Step 4: Perform local browser QA for `/cashflow`, `/payables`, `/billing`, `/procurement`, `/banking`, `/banking/rules`, `/payroll`, `/costs`, `/overhead`, and `/settings` in light, dark, system, desktop, and narrow modes; check focus, reduced motion, actions, and unsupported metrics.
- [ ] Step 5: Verify the five Review Focus conditions through the route behavior in Tasks 1–4.
- [ ] Step 6: STOP. Nik reviews the Codex report and browser result first. Only after explicit acceptance should this batch receive its ONE local commit: `feat: apply Indigo Harbor financial controls`.

### Task 6: Final rollout validation after all accepted batch commits

**Files:**
- Modify: `docs/superpowers/plans/2026-09-21-indigo-harbor-batch-1-command-surfaces.md`
- Modify: `docs/superpowers/plans/2026-09-21-indigo-harbor-batch-2-preconstruction-commercial.md`
- Modify: `docs/superpowers/plans/2026-09-21-indigo-harbor-batch-3-field-operations.md`
- Modify: `docs/superpowers/plans/2026-09-21-indigo-harbor-batch-4-production-controls.md`
- Modify: `docs/superpowers/plans/2026-09-21-indigo-harbor-batch-5-financial-controls.md`

**Interfaces:**
- Consumes: all five accepted local batch commits on `carez/indigo-harbor-product-rollout`.
- Produces: final local validation evidence; it does not integrate into staging.

- [ ] Step 1: Execute this task only after all five accepted batch commits exist; run `pnpm typecheck`.
- [ ] Step 2: Run `pnpm check`. `package.json` defines it as `pnpm typecheck && pnpm test && pnpm build`, so do not run `pnpm build` again.
- [ ] Step 3: Run `git status --short --branch`, `git log --oneline staging..carez/indigo-harbor-product-rollout`, `git diff --name-status staging...carez/indigo-harbor-product-rollout`, and `git diff --stat staging...carez/indigo-harbor-product-rollout`.
- [ ] Step 4: Perform local browser regression in this order: Today → Opportunity → Takeoff → Estimate → Proposal → Project / Job Setup → Schedule → Field / Readiness → Production → Forecast → Cashflow / Payables / Billing; then Documents, Crew, Banking, Procurement, Inventory classification, and Settings.
- [ ] Step 5: Check light/dark/system, desktop/narrow, keyboard focus, reduced motion, existing navigation/actions, and no fake or unsupported metrics across the regression.
- [ ] Step 6: STOP before staging integration. Staging merge and push require separate Nik authorization after this validation.
