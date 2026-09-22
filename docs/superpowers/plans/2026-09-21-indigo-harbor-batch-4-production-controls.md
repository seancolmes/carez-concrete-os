# Batch 4 — Production Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Indigo Harbor controls presentation to authoritative production, scope-drift, reconciliation, pour, and forecast records without creating control calculations.

**Architecture:** Historical `/production/control` and `/production/intelligence` both map to `/production`; `/production/scope-drift` maps to `/scope-drift`; `/production/reconcile` maps to `/banking/reconcile`; and `/production/pour-control` maps to `/pour-control`. Each route exposes its present query state only: if a requested control lacks current authority, omit it and report it unsupported.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, existing Carez component system

**Spec:** `docs/superpowers/specs/2026-09-21-indigo-harbor-product-rollout-design.md`

## Global Constraints

- Preserve Work Package quantities, earned production, CY/SF/LF evidence, Direct Cost/Sell separation, labor learning, scope-drift classification, reconciliation, pour funding locks, EAC/FTC, and forecast formulas.
- Use existing semantic tokens, shelves, ledgers, status lines, focus-visible treatment, reduced-motion-safe pulses, narrow stacking, and table overflow.
- Do not create production, learning, reconciliation, scope, funding, or forecasting engines; do not change data, schema, RLS, APIs, or routes.
- Keep authoritative inputs, forms, action buttons, table semantics, and unsupported conventions intact.
- Each batch receives exactly one local commit only after targeted validation, browser QA, and Nik acceptance. Do not push or deploy.

## Review Focus

- `needs_attention` and `labor_risk` remain the only labor-warning authority.
- Scope-drift status remains sourced from current classification fields.
- Pour holds remain sourced from funding/review/authorization state.
- Reconciliation remains sourced from bank candidates and transaction state.
- Forecast retains existing EAC, FTC, margin, and variance fields without client formulas.

### Task 1: Work Packages and Production Control/Intelligence

**Files:**
- Modify: `app/production/work-packages/page.tsx`
- Modify: `app/production/page.tsx`
- Modify: `app/production/work-packages/actions.ts`
- Modify: `app/production/actions.ts`

**Interfaces:**
- Consumes: work package progress, `needs_attention`, `labor_risk`, `budget_hours_used_percent`, `planned_quantity`, `earnedHistory`, `learning`, `saveProductionQuantity`, and `verifyProductionReport`.
- Produces: authoritative production ledgers and flat labor-risk status lines.

- [ ] Step 1: Read Work Packages operations and Production Control sections before changing presentation.
- [ ] Step 2: Flatten metric blocks and decorative cards into ledger strips and section shelves; retain operation forms, package links, CY/SF/LF evidence, tables, and manual-exception controls.
- [ ] Step 3: Use only `needs_attention`, `labor_risk`, `schedule_risk`, `budget_hours_used_percent`, and `over_budget_man_hours` for warning lines; omit any unsupported variance request.
- [ ] Step 4: Browser-check `/production/work-packages` and authoritative `/production` paths including package actions, exception verification, table overflow, focus, and reduced motion.

### Task 2: Scope drift and reconciliation remaps

**Files:**
- Modify: `app/scope-drift/page.tsx`
- Modify: `app/scope-drift/actions.ts`
- Modify: `app/banking/reconcile/page.tsx`
- Modify: `app/banking/actions.ts`

**Interfaces:**
- Consumes: scope-drift signals/classification actions, `candidateMap`, sorted bank transaction candidates, `analyzeBankFeed`, acceptance/rejection, and reconciliation actions.
- Produces: shelf-led scope and reconciliation queues with no new classification or matching logic.

- [ ] Step 1: Read scope-drift and reconciliation status predicates plus action forms.
- [ ] Step 2: Convert decorative metrics/cards to ruled registers; keep capture/classify/draft-change-order and bank-candidate action boundaries unchanged.
- [ ] Step 3: Show scope-drift and reconciliation status only from current records; do not claim automatic matching or create a matching formula.
- [ ] Step 4: Browser-check `/scope-drift` and `/banking/reconcile`, including forms, keyboard focus, semantic warnings, light/dark/system, and narrow tables.

### Task 3: Pour Control and Forecast

**Files:**
- Modify: `app/pour-control/page.tsx`
- Modify: `app/pour-control/actions.ts`
- Modify: `app/forecast/page.tsx`
- Modify: `app/forecast/actions.ts`

**Interfaces:**
- Consumes: `funding`, `latestReview`, `totalRisk`, authorization records, `projectForecasts`, `forecast_margin_at_completion`, `forecast_variance_to_budget`, `forecast_labor_hours_variance`, and `saveScopeProgress`.
- Produces: funding/authorization and forecast ledgers sourced from current authority.

- [ ] Step 1: Read Project Cash Position, Pour Plans, and Forecast sections and current action forms.
- [ ] Step 2: Flatten metric cards into ledger strips and status cards into ruled funding, authorization, and forecast lines; retain cost/labor item inputs and every action.
- [ ] Step 3: Use only existing funding balance, cash-at-risk, review/authorization, forecast status, margin, variance, and scope progress fields; do not calculate an exposure, hold, EAC, FTC, or margin.
- [ ] Step 4: Browser-check `/pour-control` and `/forecast`, including authorization paths, scope-progress forms, focus, reduced motion, and narrow layouts.

### Task 4: Batch validation and acceptance stop

**Files:**
- Modify: `app/production/work-packages/page.tsx`
- Modify: `app/production/page.tsx`
- Modify: `app/scope-drift/page.tsx`
- Modify: `app/banking/reconcile/page.tsx`
- Modify: `app/pour-control/page.tsx`
- Modify: `app/forecast/page.tsx`

**Interfaces:**
- Consumes: all Batch 4 authority and presentation contracts.
- Produces: validation evidence for Nik review.

- [ ] Step 1: Report that no targeted test file exists for these production-control presentation routes; do not add a visual-only test framework.
- [ ] Step 2: Run `pnpm typecheck`.
- [ ] Step 3: Inspect `git status --short` and `git diff --stat`.
- [ ] Step 4: Perform local browser QA for `/production/work-packages`, `/production`, `/scope-drift`, `/banking/reconcile`, `/pour-control`, and `/forecast` in light, dark, system, desktop, and narrow modes; check focus, reduced motion, actions, and unsupported metrics.
- [ ] Step 5: Verify the five Review Focus conditions through the route behavior in Tasks 1–3.
- [ ] Step 6: STOP. Nik reviews the Codex report and browser result first. Only after explicit acceptance should this batch receive its ONE local commit: `feat: apply Indigo Harbor production controls`.
