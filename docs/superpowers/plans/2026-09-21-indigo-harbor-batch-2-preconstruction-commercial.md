# Batch 2 — Preconstruction & Commercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Indigo Harbor presentation to Takeoff, estimating, proposal, award, and change-order work while preserving commercial and quantity authority.

**Architecture:** `/takeoff/[setId]` is a gap audit against the accepted seeded workstation, not a rewrite. Route-owned presentation changes may consume current estimate, proposal, award, and change-order records, but geometry, Conditions, price, margin, revision, and award lineage remain unchanged.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, existing Carez component system

**Spec:** `docs/superpowers/specs/2026-09-21-indigo-harbor-product-rollout-design.md`

## Global Constraints

- Preserve page-coordinate 2D/vector geometry, scale, measurement persistence, Conditions authority, estimate quantity/cost/pricing/margin, proposal revisions, award lineage, and commercial records.
- Use ledger strips, shelves, rails, semantic tokens, narrow stacking, focus-visible states, and reduced-motion-safe states; preserve functional editors, dialogs, inputs, tables, and supported overflow.
- No schema, RLS, RPC, persistence API, estimating engine, Takeoff engine, calculation, route, push, or deployment changes.
- Use existing authoritative values or unavailable conventions only; do not create client-side quantities, pricing, margin, or status formulas.
- Each batch receives exactly one local commit only after targeted validation, browser QA, and Nik acceptance. Do not push or deploy.

## Review Focus

- Accepted `TakeoffDrawingWorkspace` presentation remains intact.
- `IntegratedTakeoffConditionWorkspace` keeps 2D authority and derived 3D verification boundaries.
- Estimate worksheet pricing actions and audit records remain unchanged.
- Proposal revision and job-setup award lineage remain navigable.
- Change-order approval/rejection actions preserve commercial authority.

### Task 1: Takeoff index and assemblies

**Files:**
- Modify: `app/takeoff/page.tsx`
- Modify: `components/takeoff/ManualTakeoffEntry.tsx`
- Modify: `app/takeoff/assemblies/page.tsx`
- Modify: `app/takeoff/assemblies/AssemblyPage.module.css`
- Test: `tests/takeoff-mobile-review.test.ts`

**Interfaces:**
- Consumes: `ManualTakeoffEntry`, `createTakeoffSet`, `updateTakeoffOutputPrice`, and current assembly query rows.
- Produces: flattened Takeoff queues and assembly registers that retain their existing actions.

- [ ] Step 1: Read the Takeoff metrics, set cards, manual-entry boundary, and assembly sections.
- [ ] Step 2: Convert summary `Card` collections to ledger strips and set/assembly grouping to shelf-grounded registers; preserve manual-entry input borders and all action forms.
- [ ] Step 3: Retain set filters, links, output-price action, empty actions, semantic alerts, table overflow, and tabular CY/SF/LF values.
- [ ] Step 4: Run `pnpm test -- tests/takeoff-mobile-review.test.ts` and verify the existing mobile Takeoff assertions.
- [ ] Step 5: Browser-check `/takeoff` and `/takeoff/assemblies` at desktop and narrow widths with keyboard focus.

### Task 2: Accepted Takeoff workstation gap audit

**Files:**
- Modify: `app/takeoff/[setId]/page.tsx`
- Modify: `app/takeoff/[setId]/TakeoffDrawingPage.module.css`
- Modify: `components/takeoff/TakeoffConditionWorkflowShell.tsx`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.tsx`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.module.css`
- Modify: `components/takeoff/TakeoffDrawingWorkspace.tsx`
- Modify: `components/takeoff/TakeoffDrawingWorkspace.module.css`
- Test: `tests/ui-takeoff-specialist-reference.test.ts`

**Interfaces:**
- Consumes: accepted seed changes in `page.tsx`, `IntegratedTakeoffConditionWorkspace.module.css`, `TakeoffDrawingWorkspace.tsx`, and `TakeoffDrawingWorkspace.module.css`; `resolveDerived3DSnapshot`; `TakeoffConditionWorkflowShell`.
- Produces: only verified missing Indigo Harbor visual detail while preserving the existing Takeoff workstation.

- [ ] Step 1: Compare the named accepted seed files against their seeded commit before editing and classify each source requirement as preserved or a genuine visual gap.
- [ ] Step 2: Keep `TakeoffDrawingWorkspace`, `IntegratedTakeoffConditionWorkspace`, sheet upload/naming, 2D selection, scale, Conditions, and derived 3D contracts unchanged unless the gap is strictly structural presentation.
- [ ] Step 3: Add only missing semantic shelf, rail, focus, or narrow-layout treatment; do not alter geometry state, measurement identity, drawing mode, or 3D derivation.
- [ ] Step 4: Run `pnpm test -- tests/ui-takeoff-specialist-reference.test.ts`.
- [ ] Step 5: Browser-check 2D, derived 3D, condition selection, plan upload, sheet naming, keyboard focus, and reduced motion on `/takeoff/[setId]`.

### Task 3: Estimate index, deep worksheet, and audit

**Files:**
- Modify: `app/estimates/page.tsx`
- Modify: `components/estimates/EstimateGrid.tsx`
- Modify: `app/estimates/[estimateId]/page.tsx`
- Modify: `components/estimates/EstimateWorksheet.tsx`
- Modify: `components/estimates/PricingCoverage.tsx`
- Modify: `components/estimates/LaborReview.tsx`
- Modify: `app/estimates/audit/page.tsx`
- Test: `tests/estimate-worksheet.test.ts`
- Test: `tests/estimate-output-scope.test.ts`

**Interfaces:**
- Consumes: `EstimateGrid`, `EstimateWorksheet`, `PricingCoverage`, `LaborReview`, `createEstimate`, `addEstimateSection`, `addEstimateItem`, `updateEstimatePricing`, and audit query rows.
- Produces: ledger-based estimate list, worksheet, coverage, labor review, and audit registers.

- [ ] Step 1: Read each named component boundary and its current price/margin display fields.
- [ ] Step 2: Flatten only decorative cards into metrics ledgers, section shelves, action rails, and ruled audit tables; retain worksheet edit controls, inputs, dialogs, and current stage/filter behavior.
- [ ] Step 3: Render missing pricing coverage, labor review, and audit exceptions from their existing predicates; do not introduce thresholds or recalculate cost, sell, margin, Conditions, or rates.
- [ ] Step 4: Run `pnpm test -- tests/estimate-worksheet.test.ts` and `pnpm test -- tests/estimate-output-scope.test.ts`.
- [ ] Step 5: Browser-check `/estimates`, `/estimates/[estimateId]`, and `/estimates/audit`, including pricing actions, focus, tables, light/dark/system, and narrow layouts.

### Task 4: Proposals, Job Setup, and Change Orders

**Files:**
- Modify: `app/proposals/page.tsx`
- Modify: `app/job-setup/page.tsx`
- Modify: `app/job-setup/[projectId]/page.tsx`
- Modify: `app/change-orders/page.tsx`
- Modify: `app/change-orders/actions.ts`

**Interfaces:**
- Consumes: proposal revision rows, job-setup project lineage, `createChangeOrder`, `addChangeOrderItem`, `updateChangeOrder`, `approveChangeOrder`, and `rejectChangeOrder`.
- Produces: traceable proposal, award, and change-order registers with unchanged lineage and action boundaries.

- [ ] Step 1: Read proposal status, job setup, and change-order section markup plus every named action form.
- [ ] Step 2: Replace decorative cards with shelf-ledgers and compact action rails; retain revision/status filters, deep links, item inputs, approval/rejection controls, and empty actions.
- [ ] Step 3: Show revision, award, approved/rejected, and unapproved exposure states only from existing record fields; do not add automated commercial assertions.
- [ ] Step 4: Browser-check `/proposals`, `/job-setup`, `/job-setup/[projectId]`, and `/change-orders` with keyboard action paths and narrow form layout.

### Task 5: Batch validation and acceptance stop

**Files:**
- Modify: `app/takeoff/page.tsx`
- Modify: `app/takeoff/[setId]/page.tsx`
- Modify: `app/takeoff/assemblies/page.tsx`
- Modify: `app/estimates/page.tsx`
- Modify: `app/estimates/[estimateId]/page.tsx`
- Modify: `app/estimates/audit/page.tsx`
- Modify: `app/proposals/page.tsx`
- Modify: `app/job-setup/page.tsx`
- Modify: `app/change-orders/page.tsx`

**Interfaces:**
- Consumes: all Batch 2 presentation and authority contracts.
- Produces: validation evidence for Nik review.

- [ ] Step 1: Run `pnpm test -- tests/takeoff-mobile-review.test.ts`, `pnpm test -- tests/ui-takeoff-specialist-reference.test.ts`, `pnpm test -- tests/estimate-worksheet.test.ts`, and `pnpm test -- tests/estimate-output-scope.test.ts`.
- [ ] Step 2: Run `pnpm typecheck`.
- [ ] Step 3: Inspect `git status --short` and `git diff --stat`.
- [ ] Step 4: Perform local browser QA for `/takeoff`, `/takeoff/[setId]`, `/takeoff/assemblies`, `/estimates`, `/estimates/[estimateId]`, `/estimates/audit`, `/proposals`, `/job-setup`, and `/change-orders` in light, dark, system, desktop, and narrow modes; check focus, reduced motion, actions, and unsupported metrics.
- [ ] Step 5: Verify the five Review Focus conditions through the Takeoff, estimate, proposal, job-setup, and change-order behavior in Tasks 1–4.
- [ ] Step 6: STOP. Nik reviews the Codex report and browser result first. Only after explicit acceptance should this batch receive its ONE local commit: `feat: apply Indigo Harbor preconstruction commercial flow`.
