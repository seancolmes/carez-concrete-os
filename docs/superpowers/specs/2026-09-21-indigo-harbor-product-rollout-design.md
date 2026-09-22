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

Use five large local implementation batches plus the local-only Batch 2.5 foundation. No batch pushes or deployments. Each batch receives one local commit after local QA. Only after all five implementation batches and Batch 2.5 pass final validation is the rollout integrated into local `staging` and delivered through one staging push and one Vercel staging deployment.

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

## Batch 2.5 — SmoothUI Foundation & Workspaces Navigator

Batch 2.5 is local only: no Vercel deployment, staging push, or `main` changes.

Purpose:

- Establish the first approved SmoothUI integration pattern.
- Replace the current visually compressed Workspaces flyout presentation.
- Create the reference Carez motion/interaction implementation that later batches can reuse.

The current narrow Workspaces flyout is replaced presentation-wise by an in-shell Carez Expandable Navbar while preserving the existing AppShell/navigation architecture. On desktop and tablet it expands downward from the existing top shell without a modal backdrop, detached directory, or full-window overlay. On compact widths, the existing Carez Sheet remains the navigator presentation.

Desktop behavior:

- Use operating-domain triggers attached to the top shell and show one selected domain at a time, with a measured-height panel and direction-aware content transition.
- Establish strong hierarchy by actual registered Carez destinations, clearly identify the current workspace, and provide existing-primitive workspace search.
- Present Pinned and Recent only as compact supporting rails when existing device-local state contains entries; do not manufacture an All/Pinned/Recent primary tab hierarchy.
- Use Carez-themed SmoothUI Expandable Navbar source only for structural navigator motion. Existing Carez Sheet, Command, Button, and Tooltip primitives remain authoritative for their respective behavior.

Preferred structural groups are Preconstruction, Projects / Operations, Field, Production, Finance, and System. Route registry ownership wins where a destination does not fit an illustrative group.

Do not use decorative expandable/glow cards merely because they exist. The navigator remains flat, technical, Indigo Harbor, keyboard accessible, responsive, and reduced-motion compatible.

### Pinned / Recent State Safety

Do not imply persistence that does not exist. If current Carez state does not persist pinned or recent workspaces, Batch 2.5 may implement the navigator without persistent pinned/recent state, or use existing safe client-local UI preference mechanisms only if already established in Carez. Do not add database schema, RPCs, auth state, or persistence APIs merely for navigator personalization. Any unsupported persistence is deferred.

Expected local commit after implementation acceptance: `feat: refine SmoothUI workspace navigator`.

## Batch 3 — Schedule, Readiness, Field & Resources

Routes: `/schedule`, `/schedule/look-ahead`, `/schedule/readiness`, `/readiness/resources`, `/field`, `/crew`, `/crew/access`, and `/inventory`.

For `/schedule`, mode is **gap audit**: preserve accepted current 14-day schedule authority; do not force it to 21 days. The dedicated `/schedule/look-ahead` route may retain its actual 21-day authority.

Protect scheduling logic, crew allocation logic, labor-deficit calculations, readiness rules, timecard semantics, inventory/procurement calculations, employee access/auth, and weather architecture.

Evaluate whether a legitimate SmoothUI primitive materially improves each planned interaction; adopt selectively, without replacing working Carez controls for novelty or reopening accepted domain architecture.

Expected local commit: `feat: apply Indigo Harbor field operations flow`.

## Batch 4 — Production Intelligence & Project Controls

Routes: `/production/work-packages`, `/production/control`, `/production/intelligence`, `/production/scope-drift`, `/production/reconcile`, `/production/pour-control`, and `/forecast`.

Protect Work Package quantity authority; earned production calculations; Production Quantity / Direct Cost / Sell separation; CY / SF / LF evidence authority; production learning semantics; scope-drift classification; reconciliation behavior; pour-control funding locks; and EAC / FTC / forecasting formulas.

Presentation may expose and clarify existing authoritative state. It may not create a production, learning, reconciliation, or forecasting engine.

Evaluate whether a legitimate SmoothUI primitive materially improves each planned interaction; adopt selectively, without replacing working Carez controls for novelty or reopening accepted domain architecture.

Expected local commit: `feat: apply Indigo Harbor production controls`.

## Batch 5 — Finance, Procurement, Payroll & Admin

Routes: `/cashflow`, `/payables`, `/billing`, `/procurement`, `/banking`, `/banking/rules`, `/payroll`, `/job-costs`, `/finance/overhead`, and `/settings`.

For `/cashflow`, mode is **gap audit**: preserve the accepted Cashflow implementation.

Protect AP liability recognition, payment semantics, AR/progress billing, retainage, bank reconciliation, payroll calculations, employer taxes, L&I / workers compensation rates, company hourly burden calculations, job-cost posting, procurement commitments, and overhead allocation.

Behavioral accounting copy may be displayed only where the existing implementation proves its semantics.

Evaluate whether a legitimate SmoothUI primitive materially improves each planned interaction; adopt selectively, without replacing working Carez controls for novelty or reopening accepted domain architecture.

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

# SmoothUI Motion & Interaction Authority

## Authority hierarchy

Carez visual and interaction authority is:

1. **ADR-024 / Indigo Harbor** — sole color, theme, density, and visual-identity authority; true light/dark/system semantic tokens remain mandatory.
2. **CAREZ_COMPONENT_PACK** — Carez concrete-native/domain component authority; existing accepted Carez components remain preferred when they already solve the required product behavior correctly.
3. **SmoothUI** — approved preferred source for motion and interactive UI primitives, selectively adopted where a legitimate Carez use case exists. Components must be rethemed/adapted to Carez semantic tokens. SmoothUI must not replace ADR-024 or create a second visual theme.
4. **Application surfaces** — existing Carez workflows enhanced progressively; behavior and product authority remain unchanged.

SmoothUI is **not** a new Carez design system. SmoothUI is **not** the theme authority. SmoothUI is **not** permission to replace accepted domain workflows.

## Component Adoption Rule

For new or materially refined interactions:

1. Check whether an existing Carez component already solves the need.
2. If yes, preserve or enhance it.
3. If not, evaluate a relevant SmoothUI primitive.
4. If SmoothUI legitimately improves usability, accessibility, motion, or consistency, adopt and Carez-theme it.
5. If no appropriate SmoothUI component exists, build the smallest Carez-native primitive.

Do not install or use components merely to increase SmoothUI component count. Do not force irrelevant showcase, social, marketing, novelty, media, or consumer-demo components into Carez.

Excluded by default: social/tweet/review components; music/media novelty controls; decorative arcade/ransom-note effects; marketing/download showcase components; GitHub/star showcase effects; and unrelated gallery/demo components. These may be reconsidered only if a legitimate future Carez workflow needs them.

## SmoothUI Adoption Targets

This is an adoption map of approved examples, not a mandatory one-to-one implementation requirement or permission to install every component during this rollout.

| Carez surface | Example SmoothUI primitives |
| --- | --- |
| Global navigation | Dialog; Drawer; Animated Tabs; Combobox / searchable selector; Pinned List; Morph Icon; Animated List; Notification Badge; Animated Tooltip; Smooth Button |
| Takeoff | Vector Editor Toolbar; Context Menu; Animated Tooltip; Scrubber; Drawer; Animated Toggle |
| Drawing sheets / document trees | File Tree; Animated List; Context Menu |
| Estimate workbook | Animated Number Input; Number Flow; Combobox; Select; Animated Tabs |
| Pricing / totals | Number Flow; Price Flow; Animated Progress |
| Proposal lifecycle | Animated Stepper; Notification Badge; Animated Tabs |
| Scheduling | Animated Tabs; Duration Picker; Rich Popover; Drawer |
| Documents | Animated File Upload; File Tree; Image Metadata Preview; Animated Progress |
| Field / Crew | Animated Input; Select; Animated Toggle; Checkbox; Radio Group; Animated Tags; Combobox |
| Production / Financial | Number Flow; Price Flow; Animated List; Rich Popover; Progress indicators |
| System feedback | Toast; Notification Badge; Skeleton; Motion Loader; Grid Loader |
| Future Carez AI surfaces | AI Conversation; Prompt Input; Message; Response; Sources; Tool Call; Approval; Task List |

## Carez Motion Grammar

### Level 1 — Micro

Typical duration: 100–180 ms.

Use for hover, focus, button press, checkbox/toggle, row trace, tooltip, and compact input feedback.

### Level 2 — Structural

Typical duration: 180–280 ms.

Use for workspace navigator, tabs, drawers, inspectors, expanding rows, and state transitions.

### Level 3 — Attention

State-driven and restrained. Use only for real holds, deficits, failures, loading, and authoritative state changes.

Rules:

- Prefer transform and opacity where practical.
- Avoid theatrical page transitions in dense work surfaces.
- Motion must never obscure Takeoff precision or financial readability.
- Motion must never carry the only representation of state.
- All nonessential animation must respect reduced motion.

## Dependency / Source Adoption Safety

SmoothUI components may be brought into Carez as editable source only when the implementation plan explicitly names the required component and dependency impact. Do not globally import SmoothUI theme variables, replace Carez semantic tokens, or bulk-install all SmoothUI components.

Do not introduce GSAP, Motion, or another runtime dependency unless the selected component genuinely requires it, the repository does not already provide the capability, dependency impact is reviewed in the implementation plan, and the dependency is compatible with Next.js / React server-client boundaries. Prefer existing installed capabilities where equivalent.

## Server / Client Boundaries

SmoothUI adoption must preserve Next.js server/client boundaries. Do not convert large server components to client components solely for animation. Prefer small client-side interactive islands, existing client components, and narrow motion wrappers around interactive elements. Server-authoritative data remains server-authoritative.

## Accessibility & Performance

SmoothUI adoption must preserve or improve keyboard navigation, focus-visible states, ARIA semantics, semantic buttons/links, screen-reader discoverability, reduced motion, light/dark/system compatibility, and responsive behavior.

Avoid animation of large layout surfaces where unnecessary; prefer transform/opacity; use no continuous decorative animation in estimating, Takeoff, or financial workspaces; avoid unnecessary client hydration; and add no large dependency for trivial effects.

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

After all five accepted implementation-batch commits and the accepted Batch 2.5 commit, perform a bounded review of already accepted Batch 1 and Batch 2 surfaces for obvious high-value SmoothUI enhancements. This is not permission for a redesign: only adopt enhancements that materially improve interaction, preserve accepted layout, require small coherent changes, follow the SmoothUI authority, and create no new product logic.

Then run `pnpm typecheck`, `pnpm check`, and `pnpm build`; do not redundantly run build if `pnpm check` already performs the authoritative production build. Then inspect:

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

Carez uses one coherent Indigo Harbor visual identity with a consistent motion and interaction grammar. SmoothUI is visibly integrated where useful but does not make Carez look like a third-party component demo. Carez remains recognizably Carez.

## Documentation Policy

This single design spec is the durable rollout design artifact. Do not create per-batch checkpoint documents. Git history preserves implementation evidence. After implementation and deployed verification, update `docs/CURRENT_STATE.md` only with verified implementation state. Do not create an ADR unless implementation reveals a genuinely new cross-cutting architectural decision.

## Spec Self-Review

Before committing, confirm this document has no unfinished markers or incomplete content; check batch-boundary, authority, delivery, and accepted Takeoff/Schedule/Cashflow consistency; confirm no task contradicts the local-only rollout workflow; correct every issue directly in this document.
