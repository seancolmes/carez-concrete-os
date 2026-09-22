# Indigo Harbor Product Rollout

## Status

Approved for implementation.

This is a presentation-system rollout across existing Carez workspaces. It does not authorize new business architecture, calculations, persistence, routes merely to match historical prompts, database changes, or production deployment.

ADR-024 remains the visual/theme authority. ADR-016 remains the implemented shell until its dedicated replacement. ADR-020 remains authoritative for the Takeoff workstation.

## Goal

Establish one consistent Indigo Harbor / Precision Grid technical interface throughout Carez while preserving all authoritative concrete, estimating, financial, production, commercial, tenant, and operational behavior underneath it.

Primary visual language:

- Card-free open technical workspaces; transparent semantic surfaces; continuous 1px structural grids.
- Flat metric ledger strips; edge-to-edge section shelves; grounded action rails; compact control rails; flat status ribbons.
- Concrete-native terminology; restrained semantic warning states; monospaced telemetry where appropriate.
- Precise line-based hover, focus, and selected states; true light/dark/system support.

## Rollout Model

Use one long-lived local branch: `carez/indigo-harbor-product-rollout`, beginning at `fdf8d4d75bde329cfb84897c45b7186606b46e77`.

Before Batch 1, seed it with **only** verified, accepted implementation commits from `carez/takeoff-precon-canvas-ui`, `carez/schedule-field-control-ui`, and `carez/cashflow-financial-controls-ui`. Inspect unique commits before integration; do not merge branches blindly.

Accepted existing work on `/takeoff/[setId]`, `/schedule`, and `/cashflow` uses **preserve first / gap-fill second** behavior during later batches.

Use five large local implementation batches. No batch pushes or deployments. Each batch receives one local commit after local QA. Only after all five pass final validation is the rollout integrated into local `staging` and delivered through one staging push and one Vercel staging deployment.

## Batch 1 — Command Surfaces, Navigation & Intake

Routes and owners: `/`, `/projects`, `/documents`, `/reports`, `/leads`, `/leads/inbox`, `/preconstruction/bid-intelligence`, and the existing Global Workspaces flyout/navigation component.

Purpose: establish the shared Indigo Harbor line-grid language across primary command and intake surfaces. The Workspaces flyout may become a wide multi-column workspace matrix but remains within existing AppShell/navigation architecture.

Protect project lifecycle semantics, document persistence/upload contracts, Outlook/integration backend behavior, Bid Intelligence scoring logic, and AppShell architecture.

Expected local commit: `feat: apply Indigo Harbor command surfaces`.

## Batch 2 — Takeoff, Estimating, Proposals & Award

Routes and authoritative equivalents: `/takeoff`, `/takeoff/[setId]`, `/takeoff/assemblies`, `/estimates`, the verified current deep Estimate route, the verified current Estimate audit route, `/proposals`, `/job-setup`, and `/change-orders`. Verify dynamic route names from the repository; do not assume historical `[id]` names.

For `/takeoff/[setId]`, mode is **gap audit**: preserve the accepted Takeoff workstation and add only genuine missing presentation detail.

Protect stable page-coordinate 2D/vector geometry, Takeoff quantity authority, measurement persistence, scale authority, Conditions authority, estimate quantity/cost/pricing/margin calculations, proposal revision lineage, award/project lineage, and commercial records.

Expected local commit: `feat: apply Indigo Harbor preconstruction commercial flow`.

## Batch 3 — Schedule, Readiness, Field & Resources

Routes: `/schedule`, `/schedule/look-ahead`, `/schedule/readiness`, `/readiness/resources`, `/field`, `/crew`, `/crew/access`, and `/inventory`.

For `/schedule`, mode is **gap audit**: preserve accepted current 14-day schedule authority; do not force it to 21 days. The dedicated `/schedule/look-ahead` route may retain its actual 21-day authority.

Protect scheduling logic, crew allocation logic, labor-deficit calculations, readiness rules, timecard semantics, inventory/procurement calculations, employee access/auth, and weather architecture.

Expected local commit: `feat: apply Indigo Harbor field operations flow`.

## Batch 4 — Production Intelligence & Project Controls

Routes: `/production/work-packages`, `/production/control`, `/production/intelligence`, `/production/scope-drift`, `/production/reconcile`, `/production/pour-control`, and `/forecast`.

Protect Work Package quantity authority; earned production calculations; Production Quantity / Direct Cost / Sell separation; CY / SF / LF evidence authority; production learning semantics; scope-drift classification; reconciliation behavior; pour-control funding locks; and EAC / FTC / forecasting formulas.

Presentation may expose and clarify existing authoritative state. It may not create a production, learning, reconciliation, or forecasting engine.

Expected local commit: `feat: apply Indigo Harbor production controls`.

## Batch 5 — Finance, Procurement, Payroll & Admin

Routes: `/cashflow`, `/payables`, `/billing`, `/procurement`, `/banking`, `/banking/rules`, `/payroll`, `/job-costs`, `/finance/overhead`, and `/settings`.

For `/cashflow`, mode is **gap audit**: preserve the accepted Cashflow implementation.

Protect AP liability recognition, payment semantics, AR/progress billing, retainage, bank reconciliation, payroll calculations, employer taxes, L&I / workers compensation rates, company hourly burden calculations, job-cost posting, procurement commitments, and overhead allocation.

Behavioral accounting copy may be displayed only where the existing implementation proves its semantics.

Expected local commit: `feat: apply Indigo Harbor financial controls`.

## Common Execution Contract

Every batch uses a fresh Codex task while working on `carez/indigo-harbor-product-rollout`. At batch start verify the correct branch, clean tree, and prior batch commits.

Read only `AGENTS.md`, `CODEX.md`, assigned routes, direct dependencies, `CAREZ_COMPONENT_PACK.md` when necessary, and directly relevant governing ADRs. Do not broadly inspect Git history, issues, PRs, `CURRENT_STATE`, `ROADMAP`, unrelated routes, GitHub, Vercel, Supabase, or web resources. Network/plugins/MCP/web remain off. Do not run `sync.ps1`, push, or deploy.

## Route Ownership Rule

For every requested route: verify it exists; if present, use it and direct owned dependencies; if missing, perform a narrow ownership lookup; if an authoritative replacement exists, remap and continue; never create a route simply to match an old prompt.

Known mappings: `/precon` → `/takeoff/[setId]`; `/operations` → `/schedule`; `/control-board` → `/cashflow`. A moved route must not abort an otherwise independent batch.

## Indigo Harbor Presentation Contract

Major workspaces read as one continuous technical surface:

`AppShell → page header/action grid → metric ledger → control rail → section shelves → primary work matrix → supporting registers`

Avoid decorative large Card wrappers, floating dashboard islands, thick rounded containers, solid dark modules, and hard-coded alternate palettes. Use existing Carez semantic tokens; raw Tailwind colors in source prompts are visual intent, not mandatory literal classes. Prefer semantic ADR-024-compatible tokens.

### Ledger strips

For 3–6 summary metrics, use one continuous transparent or near-transparent row with thin internal vertical divisions, uppercase mono metadata labels, high-contrast primary values, optional context, tabular numerics where useful, and no independent metric cards.

### Section shelves and rails

Primary sections use continuous horizontal structural baselines; titles/actions sit on the shelf, not decorative boxes. Top-right actions align to the page grid and may use a vertical action-region boundary; unrelated actions do not float over the page.

Search, selectors, filters, and tabs use lean transparent control rails. Preserve functional input boundaries and use a continuous baseline beneath grouped controls.

Warnings/guidance become flat ruled status lines rather than message cards.

### Interaction, type, forms, and tables

Prefer thin left-edge traces, semantic Indigo/cyan boundary accents, line strengthening, restrained low-alpha surfaces, and explicit `focus-visible` states. Avoid heavy full-row fills where a boundary trace is sufficient.

Use normal interface typography for narrative content. Use mono/tabular typography selectively for quantities, money, measurements, rates, timestamps, identifiers, statuses, and telemetry; never make entire pages monospace.

Card-free does not remove input borders: preserve field affordance, labels, focus states, and accessibility. Tables are ledger-style rows with thin horizontal rules, compact density, tabular numeric alignment, restrained hover, and selective vertical divisions; do not introduce spreadsheet complexity unnecessarily.

Empty states remain flat and structurally attached to their section shelf, without oversized dark cards, while preserving legitimate actions.

Desktop uses appropriate multi-column structural grids. On narrow viewports, stack sections, remove irrelevant vertical dividers, preserve horizontal shelves, permit current supported table overflow, and prevent page-wide horizontal scrolling.

## When a Card May Remain

A bounded surface may remain when it communicates real interaction or function: modal/dialog, popover, dropdown, command palette, focused editor, temporary inspector, meaningful drop zone, or a necessary complex-form grouping.

If the boundary is decorative, flatten it. If it communicates function, preserve or refine it.

## Business Authority and Copy Safety

For every requested metric, action, or status: display an existing authoritative value; use an existing approved helper where it derives the value; otherwise omit it, use the existing unavailable convention, or report it unsupported. Never invent client-side business formulas for UI completeness.

Authoritative support is required for 7-day net cash, AR/progress draws, supplier liabilities, canonical hourly burden, margin thresholds, labor deficits, planned MH at risk, cash holds, unapproved exposure, yield variance, profitability, retainage, and budget variance.

Domain terminology may be refined when accurate. Assertions such as “automatically posts,” “automatically matches,” “dynamically calculates,” “clears what Carez owes,” “reduces cash,” or “updates accounting totals” may appear only when current product behavior proves them. Otherwise retain truthful wording and report requested copy unsupported.

## Database / Backend Exclusions

This rollout does not authorize changes to `supabase/migrations`, database schema, RLS, tenant model, RPCs, generated database types, auth architecture, persistence APIs, accounting engines, estimating engines, Takeoff geometry/quantity authority, schedule engines, or banking integration architecture. Mark a UI requirement unsupported if it depends on any of these.

## Shared Component Discipline and Global CSS

Prefer route-owned changes. Existing shared Carez presentation primitives may receive small compatible enhancements only when multiple assigned routes require them, existing consumers remain correct, the existing component system remains authoritative, and duplication is materially reduced.

Do not create parallel systems such as `IndigoHarborCard`, `PrecisionGridV2`, `UniversalLedgerFramework`, or `NewDashboardSystem`. The existing Carez component system remains authoritative. The Global Workspaces flyout is an explicit shared-navigation target.

`globals.css` is not to be changed by default. Change it only when necessary to extend existing semantic behavior, never to introduce route-specific palettes; explicitly report and justify every such modification.

## Accessibility

Preserve keyboard navigation, semantic buttons/links, labels, visible focus, disabled states, contrast, reduced-motion behavior, and light/dark/system support. Any pulse animation respects reduced motion. Actionable information cannot rely solely on hover.

## Batch Outcome and Stop Rules

Classify every route as `IMPLEMENTED`, `PRESERVED`, `ADAPTED`, `PARTIAL`, `SKIPPED — UNSUPPORTED CONTRACT`, `SKIPPED — ROUTE MOVED`, or `BLOCKED — ARCHITECTURAL`. One unsupported route does not abort an otherwise independent batch.

Hard stop if work unexpectedly requires schema/RLS, destructive behavior, new authoritative business calculations, broad shared architecture changes, removal of accepted functionality, or unresolved ownership that could make the edit unsafe.

## Per-Batch Validation and Report

At each batch end, run targeted tests for changed areas, `pnpm typecheck`, `git status --short`, and `git diff --stat`; confirm only intended files changed and perform local browser QA. If no targeted tests exist, explicitly report that. After acceptance, create exactly one local commit for that batch; do not push.

Each report returns:

```text
BATCH:
<name>

FILES CHANGED:
<files>

IMPLEMENTED ROUTES:
<routes>

PARTIAL / SKIPPED ROUTES:
<route — reason>

SUPPORTED REQUESTED BEHAVIOR:
<items>

UNSUPPORTED REQUESTED BEHAVIOR:
<items>

SHARED COMPONENT CHANGES:
<none or files + reason>

TARGETED TESTS:
<results>

TYPECHECK:
<result>

WORKING TREE:
<summary>

UNRESOLVED BLOCKERS:
<none or exact blockers>
```

Do not commit or push unless explicitly instructed after review.

## Final Validation

After all five accepted batch commits, run `pnpm typecheck`, `pnpm check`, and `pnpm build`; do not redundantly run build if `pnpm check` already performs the authoritative production build. Then inspect:

```text
git status --short --branch
git log --oneline staging..carez/indigo-harbor-product-rollout
git diff --name-status staging...carez/indigo-harbor-product-rollout
git diff --stat staging...carez/indigo-harbor-product-rollout
```

The tree must be clean. Final local browser regression follows Today → Opportunity → Takeoff → Estimate → Proposal → Project / Job Setup → Schedule → Field / Readiness → Production → Forecast → Cashflow / Payables / Billing; also check Documents, Crew, Banking, Procurement, Inventory, and Settings.

## Delivery

Only after all local validation succeeds, integrate `carez/indigo-harbor-product-rollout` into local `staging` and validate merged staging again. Then use the verified delivery pipeline exactly once: one staging push, one GitHub Actions cycle, one Vercel staging deployment, and one deployed browser QA cycle. `main` remains untouched; production release needs separate explicit authorization from Nik.

## Success Criteria

Carez has one coherent Indigo Harbor technical interface across the operating system while preserving the same authoritative concrete, estimating, financial, production, commercial, tenant, and operational contracts underneath it. Presentation may change substantially; business truth may not.

## Documentation Policy

This single design spec is the durable rollout design artifact. Do not create per-batch checkpoint documents. Git history preserves implementation evidence. After implementation and deployed verification, update `docs/CURRENT_STATE.md` only with verified implementation state. Do not create an ADR unless implementation reveals a genuinely new cross-cutting architectural decision.

## Spec Self-Review

Before committing, search this document for `TBD`, `TODO`, `placeholder`, and `unresolved`; check batch-boundary, authority, delivery, and accepted Takeoff/Schedule/Cashflow consistency; confirm no task contradicts the local-only five-batch workflow; correct every issue directly in this document.
