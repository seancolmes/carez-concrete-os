# Plan 005: Establish a desktop estimating workbench

> Executor: Implement one vertical slice after plans 001, 002, and 004 are resolved. Preserve all current uncommitted work at commit 4a0f104d. This plan does not authorize branch changes, commits, remote writes, or a simultaneous rewrite of every route.

## Status

- Priority: P1
- Effort: L
- Risk: Medium-high; layout and navigation changes can strand record context or obscure saved work
- Depends on: 001, 002, 004
- Category: information architecture and workspace layout
- Confidence: High for the observed friction; final arrangement requires user acceptance

## Why this matters

At 1920 by 1032, the recorded Opportunity header, metric row, section tabs, record title, nested controls, and Takeoff steps consume most of the viewport before the plan. Scope's apparent tabs are hash anchors into one long page. The Estimating Edge desktop reference instead keeps bid context and controls compact while the grid or drawing owns the viewport.

## Current state

- components/AppShell.tsx:35,95 grants overflow-hidden workstation behavior only to /takeoff/[setId], while other pages use a scrolling main.
- app/opportunities/page.tsx:110-116 renders the page header, four summary tiles, four section links, selected record title, and nested Scope/Takeoff and Activity controls before task content.
- components/opportunities/views/OpportunitySectionNav.tsx:3-17 uses hash links to Scope, Plans & Takeoff, Estimates, and Proposals within one long document.
- components/opportunities/views/TakeoffView.tsx:179-202 embeds the full workstation inside that document. app/takeoff/[setId]/page.tsx:178-200 is a separate dedicated route with opportunity/estimate return links.
- components/AppShell.tsx:44-46 already provides a global command rail; ADR-025 retains Command Rail, Domain Deck, contextual Command Bar, and a large work area. ADR-020 retains persisted page-coordinate 2D geometry as quantity authority.

## Scope

In scope: AppShell's reusable desktop viewport contract, Opportunity list/detail navigation, the estimating context path, and dedicated Takeoff entry/return flow. Reuse existing local button, data-grid, dialog, resizable, scroll-area, sheet, and tooltip foundations where they fit.

Out of scope: new estimating math, Takeoff geometry, estimate/proposal status semantics, Field/Finance/Project screen rewrites, public proposal layout, and a universal catalog of requested primitives.

## Steps and gates

1. Introduce a desktop shell layout with one bounded workspace under the global rail, a compact context path and command bar, a dominant central work surface, and optional resizable roster/inspector panes. Keep local scrolling in panes, not the outer document. Preserve a mobile task layout with a sheet/stack where fixed desktop panes would be unusable. Verify at 1280 and 1920 desktop widths and a narrow mobile viewport: no outer page scroll for the workbench, no clipped controls, keyboard focus remains visible.
2. Keep Opportunity summary measures on its list/overview surface; when a record is open, show a single compact path for Opportunity, estimate revision, plan set, and Condition as applicable. Replace hash-anchor pseudo-tabs with actual mutually exclusive task destinations or a record picker. Verify a first-time user can open a record, identify the active revision, navigate Scope, Takeoff, Pricing, Proposal, and Activity, and return without losing context.
3. Open plan work in the dedicated /takeoff/[setId] workstation while preserving an obvious return to the same Opportunity and estimate revision. Keep the plan center dominant, condition tree local, properties contextual, and status/quantity strip persistent. Verify 2D remains authoritative and 3D remains a derived review mode.
4. Give long grids explicit paging or virtualization, stable row selection, search/filter state, keyboard row movement, and a column strategy. Keep entered edits on failure and confirm the saved object and state. Verify a multi-page list without outer document growth, then verify empty, loading, pending, success, failure, and permission states.
5. Run pnpm typecheck and only focused existing estimating/Takeoff UI tests. Inspect desktop and mobile in dark and light themes. Use a task walkthrough that asks an estimator to move from a bid to one measured condition and its direct-cost source without naming controls; success is completion without wrong-path backtracking and a correct account of what was saved.

## Done criteria

- The estimating workspace fits the desktop viewport with bounded inner scrolling and a plan/grid-dominant center.
- No layered hash-anchor navigation is needed to reach estimating tasks.
- Record, revision, plan, and Condition context survives navigation and return.
- Takeoff canvas, recap, keyboard interaction, and dark/light themes work in the vertical slice.
- The route and state walkthroughs above pass, pnpm typecheck passes, and the final diff stays within the stated pilot scope.

## Stop conditions

- A navigation change would break accepted proposal, estimate, or published Takeoff deep links without a compatibility mapping.
- Layout work requires changing persisted quantities, calculations, or tenant access.
- Plans 001, 002, or 004 remain unresolved; do not paper over their failures with shell CSS.

## Maintenance note

Use this accepted vertical slice as the pattern for separate Projects, Field, Financials, Reports/Documents, and Settings rollouts. Avoid copying the same long header and metric stack into each new workspace.
