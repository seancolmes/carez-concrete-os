# Plan 002: Restore recorded Takeoff and Schedule workspaces

> Executor: Start with one bounded reproduction in the dedicated Carez QA browser profile. Capture the relevant console and network result before editing. This is a diagnosis-led plan because the recording proves symptoms but not the PDF, layout, or schedule-provider root causes. Preserve all uncommitted work at commit 4a0f104d.

## Status

- Priority: P1
- Effort: M, potentially larger if a persisted provider contract is broken
- Risk: Medium; Takeoff layout and PDF loading share a consequential measurement workspace
- Depends on: 001
- Category: correctness and runtime integrity
- Confidence: High for symptoms, open for causes

## Why this matters

In the local recording, the Tracing Engine has no visible plan while a raw pdfjs-dist chunk string appears, Commercial Recap is blank, and Field Schedule says its records are unavailable. Each prevents an operator from completing or verifying work. The exact cause must be identified before a patch.

## Current state

- components/takeoff/TakeoffDrawingWorkspace.tsx:256-277 dynamically imports pdfjs-dist, loads the signed URL, and assigns error.message to the UI; :600 displays that message when renderBox is absent.
- components/takeoff/IntegratedTakeoffConditionWorkspace.tsx:636-644 renders the three-phase selector and drawing host; :744-758 renders Commercial Recap.
- components/takeoff/IntegratedTakeoffConditionWorkspace.module.css:1,10-13,26-27,83 defines flex, absolute panes, and hidden rules.
- components/opportunities/views/TakeoffView.tsx:179-202 embeds the Takeoff workstation inside the Opportunity page. components/AppShell.tsx:35,95 only treats /takeoff/[setId] as a dedicated workstation.
- components/field/views/schedule.tsx:33-44 requests work_schedule_items and related records; :170 shows a generic unavailable alert when itemsError is set.

## Scope

In scope: a single local QA reproduction of each symptom, then the smallest owning frontend route/component or source-controlled migration if evidence establishes that boundary. If a database/RLS change is implicated, stop this plan and create a separate Carez database migration task with exact error evidence.

Out of scope: remote Supabase writes, production diagnosis, geometry/cost formula changes, broad layout rewrites, and speculative dependency upgrades.

## Steps and gates

1. Reproduce Tracing Engine once with the same local QA set. Capture the failed request or chunk URL, status, console error, and visible PDF state. Distinguish a transient dev chunk load from an enduring failure. Verify: a plan sheet renders at a known page/scale or an actionable, sanitized error with retry appears. A raw internal chunk string is not an acceptable final state.
2. Reproduce Commercial Recap in both the embedded Opportunity and dedicated /takeoff/[setId] routes. Inspect the recap panel's computed dimensions, visibility, and output count. Verify: header, metrics, table or explicit empty state, and footnote are visible and reachable without outer document scrolling. If dedicated works and embedded fails, keep the fix in embedded layout/navigation.
3. Reproduce Field Schedule once, capture the exact work_schedule_items error code and response, and identify whether the relation, RLS, network, or data contract failed. Verify: the grid loads, or the UI gives a specific recoverable state while preserving entered scheduling work. Do not suppress the error by showing an empty schedule.
4. After the owning cause is proven, make one focused fix per symptom and re-run that exact reproduction once. Run pnpm typecheck, then only the relevant existing Takeoff or Field test. Expected: exit 0 and no regression in saved 2D quantity authority.

## Done criteria

- The three recorded symptoms have captured cause/evidence and an exact owning path.
- The plan PDF is visible or a specific retryable error is shown; Commercial Recap has visible content or an explicit empty state; Schedule distinguishes unavailable data from zero work.
- The exact reproductions pass once after each fix, and pnpm typecheck passes.
- No provider or persistence mutation occurs without a separately scoped authorization and migration review.

## Stop conditions

- Dedicated QA browser/session is unavailable; report the connection blocker.
- A failure points to remote production truth, an unsafely mutable provider, RLS, or schema evolution.
- The proposed fix would change geometry, cost, or pricing authority.

## Maintenance note

Keep PDF import errors internal to diagnostics while showing a safe actionable message to the estimator. Preserve the distinction between a loading state, a missing source PDF, and a failed load.
