# Batch 3 — Field Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Indigo Harbor presentation to schedule, readiness, field, crew, and inventory-adjacent operations while retaining scheduling and labor authority.

**Architecture:** `/schedule` is a gap audit of the accepted seeded 14-day schedule; `/look-ahead` is the distinct authoritative 21-day route. `/readiness` owns the historical `/schedule/readiness` request, and `/inventory` has no current route: classify it `SKIPPED — UNSUPPORTED CONTRACT` and do not create one.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, existing Carez component system

**Spec:** `docs/superpowers/specs/2026-09-21-indigo-harbor-product-rollout-design.md`

## Global Constraints

- Preserve schedule, crew allocation, labor-deficit, readiness, timecard, employee access, weather, inventory, and procurement authority.
- Use semantic ledger strips, shelves, rails, ruled status lines, focus-visible states, reduced-motion-safe animation, narrow stacking, and supported table overflow.
- Keep current forms, dialogs, tables, filters, actions, and accessibility intact; do not change schema, RLS, APIs, calculations, routes, pushes, or deployments.
- Display only existing authoritative values and state; do not make a labor, readiness, weather, or inventory calculation for presentation.
- Each batch receives exactly one local commit only after targeted validation, browser QA, and Nik acceptance. Do not push or deploy.

## Review Focus

- The accepted `ScheduleGrid` retains 14-day behavior and crew assignments.
- `/look-ahead` retains its separate 21-day readiness scan.
- Readiness holds and resource constraints retain their current action contracts.
- Field daily-log/timecard and crew-rate/access actions remain functional.
- `/inventory` is reported unsupported without creating a route or substitute calculation.

### Task 1: Schedule 14-day gap audit and 21-day look-ahead

**Files:**
- Modify: `app/schedule/page.tsx`
- Modify: `components/schedule/ScheduleGrid.tsx`
- Modify: `components/schedule/ScheduleHeaderActions.tsx`
- Modify: `app/look-ahead/page.tsx`

**Interfaces:**
- Consumes: accepted seed changes, `ScheduleGrid`, `ScheduleHeaderActions`, `createScheduleItem`, schedule days/items, assigned crews, and current look-ahead readiness rows.
- Produces: a preserved 14-day schedule and shelf-led 21-day constraint queue.

- [ ] Step 1: Compare the accepted schedule seed files to the seeded commit and identify only visual gaps.
- [ ] Step 2: Preserve `ScheduleGrid` day count, item placement, assigned crews, header actions, and create form; add only missing flat rails, shelves, focus traces, and narrow overflow handling.
- [ ] Step 3: Flatten `app/look-ahead/page.tsx` metric and work-item wrappers into ledgers and ruled queues while retaining `blocked`, `unscheduledReady`, `list`, `ready_to_start`, `planned_man_hours_at_risk`, and `next_action` state.
- [ ] Step 4: Browser-check `/schedule` remains 14 days and `/look-ahead` remains 21 days; verify crew assignment, focus, and reduced motion.

### Task 2: Readiness and resource control

**Files:**
- Modify: `app/readiness/page.tsx`
- Modify: `app/readiness/resources/page.tsx`
- Modify: `components/readiness/ResourceReadinessWorkspace.tsx`
- Modify: `app/readiness/actions.ts`
- Modify: `app/readiness/resources/actions.ts`

**Interfaces:**
- Consumes: `ResourceReadinessWorkspace`, readiness holds, inspections, predecessor rules, resource rows, operations, inventory, equipment, vendors, PO lines, `clearReadinessHold`, `placeReadinessHold`, and inspection actions.
- Produces: structural readiness and resources registers with unchanged hold controls.

- [ ] Step 1: Read readiness section headings and `ResourceReadinessWorkspace` row/status rendering.
- [ ] Step 2: Convert decorative metrics and status cards to ledger strips and flat hold lines; retain actual `hold`, inspection, predecessor, resource, and vendor state predicates.
- [ ] Step 3: Keep clear/place hold, schedule inspection, record result, and resource controls unchanged; retain inputs and labels as functional boundaries.
- [ ] Step 4: Browser-check `/readiness` and `/readiness/resources`, including hold transitions, resource filters, keyboard forms, semantic warning state, narrow layout, and table overflow.

### Task 3: Field, Crew, and Crew Access

**Files:**
- Modify: `app/field/page.tsx`
- Modify: `components/field/JobsiteLocationSetter.tsx`
- Modify: `app/field/actions.ts`
- Modify: `app/crew/page.tsx`
- Modify: `app/crew/access/page.tsx`
- Modify: `app/crew/actions.ts`
- Modify: `app/crew/access/actions.ts`

**Interfaces:**
- Consumes: `JobsiteLocationSetter`, `createDailyLog`, `createTimecard`, `createCrewMember`, `updateCrewMember`, `changeCrewRate`, and `createEmployeeAccessInvite`.
- Produces: ledger-based field and crew registers with unchanged labor and access workflow.

- [ ] Step 1: Read all named route sections and action form boundaries.
- [ ] Step 2: Flatten daily-log/timecard, crew member/rate, and invitation wrappers into shelves and ledger rows; preserve dialogs, labels, current filters, and action targets.
- [ ] Step 3: Render field and access exceptions only from existing state; use semantic warning/destructive traces and retain location control affordance.
- [ ] Step 4: Browser-check `/field`, `/crew`, and `/crew/access` actions, keyboard navigation, reduced motion, light/dark/system modes, and narrow forms.

### Task 4: Inventory route classification

**Files:**
- Modify: `app/procurement/page.tsx`
- Modify: `app/readiness/resources/page.tsx`

**Interfaces:**
- Consumes: current procurement workflow links and `ResourceReadinessWorkspace` inventory input rows.
- Produces: no `/inventory` route and an explicit Batch report classification.

- [ ] Step 1: Confirm no `app/inventory/page.tsx` exists and no authoritative replacement route owns standalone inventory behavior.
- [ ] Step 2: Do not edit, create, redirect, or link a standalone `/inventory` route.
- [ ] Step 3: Record `/inventory — SKIPPED — UNSUPPORTED CONTRACT: no verified standalone route or authority` in the batch report; preserve inventory references inside the existing resources contract.

### Task 5: Batch validation and acceptance stop

**Files:**
- Modify: `app/schedule/page.tsx`
- Modify: `app/look-ahead/page.tsx`
- Modify: `app/readiness/page.tsx`
- Modify: `app/readiness/resources/page.tsx`
- Modify: `app/field/page.tsx`
- Modify: `app/crew/page.tsx`
- Modify: `app/crew/access/page.tsx`

**Interfaces:**
- Consumes: all Batch 3 route authority and presentation contracts.
- Produces: validation evidence for Nik review.

- [ ] Step 1: Report that no targeted test file exists for these schedule, readiness, field, crew, and access presentation routes; do not add a visual-only test framework.
- [ ] Step 2: Run `pnpm typecheck`.
- [ ] Step 3: Inspect `git status --short` and `git diff --stat`.
- [ ] Step 4: Perform local browser QA for `/schedule`, `/look-ahead`, `/readiness`, `/readiness/resources`, `/field`, `/crew`, and `/crew/access` in light, dark, system, desktop, and narrow modes; check focus, reduced motion, actions, 14-day versus 21-day behavior, and unsupported metrics.
- [ ] Step 5: Verify the five Review Focus conditions through the route behavior listed in Tasks 1–4.
- [ ] Step 6: STOP. Nik reviews the Codex report and browser result first. Only after explicit acceptance should this batch receive its ONE local commit: `feat: apply Indigo Harbor field operations flow`.
