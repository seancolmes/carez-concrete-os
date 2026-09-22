# Batch 1 — Command Surfaces, Navigation & Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Indigo Harbor technical workspace language to Today, command, intake, and workspace navigation surfaces without changing operational authority.

**Architecture:** Keep each server route's Supabase reads and server-action contracts unchanged; reshape only its rendered hierarchy and existing route-owned helper markup. Retain `AppShell` and `lib/ui/navigation.ts` as the single navigation authority, refining only the existing Workspaces flyout presentation.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, existing Carez component system

**Spec:** `docs/superpowers/specs/2026-09-21-indigo-harbor-product-rollout-design.md`

## Global Constraints

- Use card-free open technical workspaces, semantic surfaces, continuous 1px grids, ledger strips, shelves, rails, and flat status lines; retain bounded functional dialogs, sheets, inputs, and drop zones.
- Preserve project lifecycle, document upload and persistence, Outlook integration, Bid Intelligence scoring, AppShell architecture, tenant isolation, and every existing action/query contract.
- Use existing semantic tokens and ADR-024-compatible light, dark, and system behavior; do not add hard-coded alternate palettes or route-specific global CSS.
- Retain labels, keyboard behavior, visible focus, disabled states, contrast, and reduced-motion support. Narrow layouts stack sections, remove surplus vertical dividers, retain shelves, and prevent page-wide horizontal scroll.
- Display only current authoritative values and approved helpers. Do not add business formulas, persistence, routes, schema/RLS changes, or backend changes.
- Each batch receives exactly one local commit only after targeted validation, browser QA, and Nik acceptance. Do not push or deploy.

## Review Focus

- Today retains `resolveOperationalState` outcomes and action destinations.
- Projects and Documents retain create-project and upload behavior.
- Leads and Inbox retain server-action status transitions and Outlook connection semantics.
- Bid pricing guidance remains sourced from its existing query fields, including protected break-even evidence.
- The Workspaces flyout retains `NAVIGATION_GROUPS`, pins, command navigation, and keyboard operation.

### Task 1: Seed accepted local workspace implementations

**Files:**
- Modify: `app/takeoff/[setId]/page.tsx`
- Modify: `app/takeoff/[setId]/TakeoffDrawingPage.module.css`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.module.css`
- Modify: `components/takeoff/TakeoffDrawingWorkspace.tsx`
- Modify: `components/takeoff/TakeoffDrawingWorkspace.module.css`
- Modify: `app/schedule/page.tsx`
- Modify: `components/schedule/ScheduleGrid.tsx`
- Modify: `components/schedule/ScheduleHeaderActions.tsx`
- Modify: `app/cashflow/page.tsx`

**Interfaces:**
- Consumes: accepted commits `981c864f`, `95472a6f`, and `bc45e01b`.
- Produces: the accepted Takeoff workstation, 14-day Schedule, and Cashflow baselines used by Batches 2, 3, and 5.

- [ ] Step 1: Verify branch `carez/indigo-harbor-product-rollout` and a clean tree.
- [ ] Step 2: Integrate only the verified commits in this order: `git cherry-pick 981c864f`, `git cherry-pick 95472a6f`, `git cherry-pick bc45e01b`.
- [ ] Step 3: Inspect `git diff staging...HEAD -- app/takeoff/[setId]/page.tsx app/schedule/page.tsx app/cashflow/page.tsx` and preserve the accepted changes unchanged.

### Task 2: Today command surface

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/carez/experience.tsx`
- Modify: `lib/ui/operations.ts`

**Interfaces:**
- Consumes: `resolveOperationalState`, `CarezSectionHeading`, `CarezOperationalPulse`, and `CarezExperienceEmpty`.
- Produces: a ledger for current operational values and shelf-aligned Today action links.

- [ ] Step 1: Read the page header, metric collection, operational pulse, and action links in `app/page.tsx`.
- [ ] Step 2: Flatten decorative `Card`, `CardContent`, and `CardHeader` wrappers into one divided metric ledger; retain `resolveOperationalState` conditions verbatim.
- [ ] Step 3: Put Today sections on `CarezSectionHeading` shelves, align current actions to their heading rail, keep `buttonVariants` targets unchanged, and use semantic primary/warning/destructive traces only.
- [ ] Step 4: Preserve `CarezOperationalPulse` focus behavior; any pulse uses `motion-reduce:animate-none`; stack the ledger on narrow screens.
- [ ] Step 5: Verify each `resolveOperationalState` branch and every action destination in local browser QA.

### Task 3: Projects and Documents reference experiences

**Files:**
- Modify: `app/projects/page.tsx`
- Modify: `components/projects/JobsOperationsBoard.tsx`
- Modify: `app/documents/page.tsx`
- Modify: `components/documents/DocumentUpload.tsx`
- Modify: `app/documents/actions.ts`
- Test: `tests/ui-navigation.test.ts`

**Interfaces:**
- Consumes: `JobsOperationsBoard`, `createProject`, `DocumentUpload`, document upload actions, and current project/document query rows.
- Produces: grid-grounded project and document registers with their existing create and upload controls.

- [ ] Step 1: Read `JobsOperationsBoard`, `DocumentUpload`, and their route render sites.
- [ ] Step 2: Replace page-level metric cards with ledger strips; flatten decorative board and document grouping containers while retaining form fields, dialogs, upload drop affordance, and table overflow.
- [ ] Step 3: Put the Projects and Documents headings, create/upload actions, filters, and registers on structural shelves; keep `createProject` and every `DocumentUpload` action unchanged.
- [ ] Step 4: Run `pnpm test -- tests/ui-navigation.test.ts`; verify the existing navigation assertions pass.
- [ ] Step 5: Browser-check project creation dialog, document upload controls, light/dark/system modes, narrow stacking, keyboard focus, and upload boundary affordance.

### Task 4: Reports, Leads, Lead Inbox, and Bid Intelligence

**Files:**
- Modify: `app/reports/page.tsx`
- Modify: `app/leads/page.tsx`
- Modify: `app/leads/inbox/page.tsx`
- Modify: `app/bid-intelligence/page.tsx`
- Modify: `app/leads/actions.ts`
- Modify: `app/leads/inbox/actions.ts`
- Modify: `app/bid-intelligence/actions.ts`

**Interfaces:**
- Consumes: `MetricCard`, `Metric`, `LeadStatus`, `SectionHeading`, `RecommendationBadge`, existing report aggregates, Lead action forms, Inbox Outlook state, and Bid profile/guardrail fields.
- Produces: ledger strips, shelves, and flat semantic status lines without changing pipeline, mailbox, or pricing behavior.

- [ ] Step 1: Read every named route's metric helper and section heading before editing.
- [ ] Step 2: Convert `MetricCard` and `Metric` output into continuous divided ledgers; keep all totals and status predicates from their current server-side variables.
- [ ] Step 3: Flatten lead opportunity, inbox candidate, connection, bid guardrail, competitor feedback, and report presentation wrappers; preserve dialogs, inputs, forms, table scroll, and every named action.
- [ ] Step 4: Render follow-up, Outlook review, recommendation, safe-comparison, and protected-break-even states with their existing predicates as flat ruled ribbons; do not add a pricing calculation or alter truthful accounting copy.
- [ ] Step 5: Verify lead conversion/status/follow-up forms, Inbox connect/disconnect/sync controls, and Bid action forms in local browser QA.

### Task 5: Global Workspaces flyout

**Files:**
- Modify: `components/AppShell.tsx`
- Modify: `lib/ui/navigation.ts`
- Modify: `app/globals.css`
- Test: `tests/ui-navigation.test.ts`

**Interfaces:**
- Consumes: `NAVIGATION_GROUPS`, `resolveActiveDestination`, pin preference helpers, `CarezTopShell`, `CarezNavigationManager`, `CarezCommandMenu`, and `CarezMobileMoreSheet`.
- Produces: the existing Workspaces sheet as a wide multi-column matrix with unchanged destinations and preference persistence.

- [ ] Step 1: Read all named shell functions and `NAVIGATION_GROUPS`; do not introduce another navigation owner.
- [ ] Step 2: Change only the current Workspaces `SheetContent` and `carez-directory-grid` presentation into a flat multi-column matrix; retain links, `aria-current`, pin marks, close-then-navigate behavior, and sheet semantics.
- [ ] Step 3: Retain mobile More, command menu, pin manager, search trigger, focus rings, and device-local preference behavior; use existing semantic custom properties if `app/globals.css` requires a compatible directory-grid extension.
- [ ] Step 4: Run `pnpm test -- tests/ui-navigation.test.ts` and verify `NAVIGATION_GROUPS`, destination resolution, and pin controls.
- [ ] Step 5: Browser-check mouse and keyboard opening, Escape close, tab order, active destination, narrow sheet, and light/dark/system modes.

### Task 6: Batch validation and acceptance stop

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/projects/page.tsx`
- Modify: `app/documents/page.tsx`
- Modify: `app/reports/page.tsx`
- Modify: `app/leads/page.tsx`
- Modify: `app/leads/inbox/page.tsx`
- Modify: `app/bid-intelligence/page.tsx`
- Modify: `components/AppShell.tsx`

**Interfaces:**
- Consumes: all Batch 1 route and navigation contracts.
- Produces: validation evidence for Nik review.

- [ ] Step 1: Run all targeted tests named above: `pnpm test -- tests/ui-navigation.test.ts`.
- [ ] Step 2: Run `pnpm typecheck`.
- [ ] Step 3: Inspect `git status --short` and `git diff --stat`.
- [ ] Step 4: Perform local browser QA for `/`, `/projects`, `/documents`, `/reports`, `/leads`, `/leads/inbox`, `/bid-intelligence`, and the Workspaces flyout in light, dark, system, desktop, and narrow modes; check focus, reduced motion, actions, and unsupported metrics.
- [ ] Step 5: Verify the five Review Focus conditions through the route behavior listed in Tasks 2–5.
- [ ] Step 6: STOP. Nik reviews the Codex report and browser result first. Only after explicit acceptance should this batch receive its ONE local commit: `feat: apply Indigo Harbor command surfaces`.
