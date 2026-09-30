# Estimating workspace audit and execution plans

Prepared 2026-09-29 from the 5:50 local development recording, all 34 PNGs in the Estimating Edge ZIP, and the current uncommitted Carez checkout at commit 4a0f104d. The ZIP contains no stylesheet or source tokens. The recording covers selected Opportunities, Takeoff, Projects empty state, Field, and Financials; it does not demonstrate every route or populated workflow. Current working-tree changes are authoritative and must be preserved.

## Direction

Build a viewport-bound desktop operating frame with a compact global command rail, one record context path, a local command bar, a dominant work pane, optional resizable roster/inspector panes, and a persistent status or totals strip. Scroll inside bounded grids and panes, with explicit paging or virtualization for large sets. Keep task-oriented mobile layouts. Use the Estimating Edge Windows client as the estimating interaction reference and its separate web Portal as the reports/library reference. Do not copy its tiny text, ambiguous icon-only commands, nested dialogs, or exact brand assets.

The operator selected both dark and light workspaces. Preserve the current local dark direction from ADR-028 while designing a separate light token set; application behavior and authoritative calculations remain the same in either theme. ADR-025 still governs compatible shell structure, and ADR-020 governs Takeoff quantity authority.

## Verified findings

| Priority | Finding | Evidence | Confidence |
| --- | --- | --- | --- |
| P1 | Duplicate React key can duplicate or omit historical Takeoff rows | Recording 0:45 and 2:05; embedded query omits id at components/opportunities/views/TakeoffView.tsx:49-50 while key is built from row.id at components/takeoff/IntegratedTakeoffConditionWorkspace.tsx:615-616 | High |
| P1 | Tracing plan remains blank with a raw PDF chunk message | Recording roughly 2:00-2:25; PDF loader at components/takeoff/TakeoffDrawingWorkspace.tsx:256-277 and raw message at :600 | Observed symptom; root cause open |
| P1 | Commercial Recap is blank below its step selector | Recording roughly 2:30-2:45; recap markup exists at components/takeoff/IntegratedTakeoffConditionWorkspace.tsx:744-758 | Observed symptom; root cause open |
| P1 | Schedule records are unavailable in the recorded Field session | Recording 3:00 and 4:00; query at components/field/views/schedule.tsx:33-44, fallback at :170 | Observed symptom; provider cause open |
| P1 | Most pages remain document-scrolling while only dedicated Takeoff receives workstation overflow | components/AppShell.tsx:35,95; recording shows stacked Opportunity and Financials chrome before task content | High |
| P2 | Live-looking finance actions target disabled views | components/AppShell.tsx:27-33; components/financials/FinancialsWorkspace.tsx:37-58; app/settings/page.tsx:66; app/projects/[id]/page.tsx:97 | High |
| P2 | No-job calls to action open forms requiring a job | Recording 3:20 and 5:00; components/field/views/production.tsx:52; components/financials/views/invoices.tsx:38-39 | High for recorded empty state |
| P2 | Authenticated pages can nest main landmarks | components/AppShell.tsx:95 plus app/field/page.tsx:57 and app/financials/page.tsx:34 | High |
| P2 | Dark-only theme code conflicts with the newly requested dual-theme behavior | app/globals.css:75-105,248-249; lib/ui/appearance.ts:18-22; components/PourtraceAntProvider.tsx:7-14; components/settings/AppearanceSettings.tsx:1-8 | High |

The inspected hubs use long pages and unbounded list rendering, not an actual infinite-load mechanism. The Cost Catalog briefly displays zero while loading, then resolves to three rows; do not treat that transient state as missing data. The recorded Projects-to-Schedule link works. No 404 was shown.

## Comparison with the supplied references

| Area | Estimating Edge images | Recorded Carez state | Recommendation |
| --- | --- | --- | --- |
| Global frame | Compact title/context strip and one task toolbar above a bounded work area | Six domain links, repeated page header/metrics, then several navigation layers | Keep the Command Rail, compress record context and actions into one local row, and give the task the remaining viewport |
| Bid/estimate navigation | Bids to Scenarios to Sections to Pages to Conditions forms a visible hierarchy | Opportunity section links, selected record controls, Scope/Takeoff links, four hash anchors, and a Takeoff phase selector can all appear in one journey | Display one lineage path and one active task level at a time; make record and revision selection explicit |
| Pricing | Dense editable material/labor grids with quantity, unit, cost, and selected-condition context; bottom-end totals stay visible | Commercial Baseline exists, but a selected example was not shown; estimate review is a long vertically stacked document | Pilot a bounded pricing grid with column management, visible calculation lineage, and persistent direct-cost/sell/status summary; validate against current server calculations |
| Takeoff | Separate three-pane drawing station: bid tree, dominant 2D plan, contextual properties/calculations, bottom scale/status | Takeoff is embedded below Opportunity chrome; recorded plan did not load and recap was blank | Use the dedicated Takeoff route as the workstation, fix recorded failures first, then retain linked Opportunity return context |
| Reports/templates | The Windows client uses a report selector/preview; the separate Edge Portal uses a two-pane manager and browser PDF tools | Reports/Documents routes exist in source but were not shown in the video | Use a manager/preview pattern after runtime review of current routes; avoid assuming Portal styling is the Windows client styling |
| Scheduling/jobs/finance | No supplied screenshot shows these Edge domains | Carez has Projects, Field schedule/production, Billing, and Job Cost, with several unconnected finance destinations | Keep the domain workflows, reduce their primary-navigation weight, and make only connected actions look active |

The Windows client screenshots show a white work canvas, cobalt grid headers, compact neutral chrome, amber focus/edit cues, and status dots. The Portal screenshots show a different gray/teal web visual system. Approximate pixels cannot substitute for a supplied stylesheet. The implementation should derive accessible PourTrace light tokens from these references and keep the current dark token family; exact Edge branding and legacy control defects should not be copied.

## Module disposition

| Module or route family | Disposition | Reason and placement |
| --- | --- | --- |
| Opportunities, estimates, proposals, Takeoff, Concrete Conditions, vendor quote selection | Keep as the estimating core | These support the user's Edge-like estimating loop and Carez's quantity-to-sell lineage. Vendor Quotes belongs inside an estimate's price-source workflow rather than a constant global button. |
| Projects, job setup, startup, scope drift, change orders, forecast, closeout | Keep; consolidate under the selected Job workspace | Edge screenshots do not establish that these should be deleted. Move low-frequency lifecycle tools into contextual Job commands; verify URL-only startup/closeout entry points. |
| Field dispatch, schedule, look-ahead, production, crew | Keep; reorganize into task views | Schedule and Look-Ahead should share one planning workspace. Add a Kanban/board alternative only if it supports the dispatch job better than the existing timeline. |
| Billing, invoices, payments, retainage, job cost, cost catalog | Keep as connected Finance views | They are substantive Carez workflows. Use bounded tables and selected-record detail rather than repeated KPI and worklist stacks. |
| Ledger, banking, reconcile, bank rules, payables/procurement, payroll | Hide or mark unavailable before activation | The current FinancialsWorkspace excludes these views. Keep compatibility URLs while removing misleading ready-to-use shortcuts. |
| Reports and Documents | Keep as contextual managers | Edge Portal's two-pane catalog/preview is a useful reference, but these routes need their own live review before implementation. |
| Takeoff legacy assembly audit, Takeoff intelligence preview, design-review studies | Retire route families by owner direction | Remove those specialist UI routes and navigation. Preserve referenced published assembly records, Takeoff compatibility lineage, and production evidence. |
| Public proposal, supplier submission, employee clock/invite, invoice/PO print | Keep specialized frames | Their audience and paper/task constraints differ from the authenticated desktop shell. |

## Rollout after the estimating pilot

1. Projects: convert the operations board and selected project into a bounded list/detail workspace; place Job Setup, Changes, Forecast, and Closeout in contextual commands. Preserve award and budget lineage.
2. Field: merge Schedule and Look-Ahead navigation, preserve date/dependency timeline, test an optional sortable board, and keep outdoor/mobile production capture task-focused. Show provider failure separately from an empty schedule.
3. Finance: make Billing and Job Cost the connected primary views, use tables with selected invoice/cost detail, and gate creation on eligible jobs. Preserve print-paper layouts.
4. Reports/Documents/Admin: review these unrecorded routes live, then apply a bounded catalog/preview or settings frame. Keep account and connection management accessible from the utility area.
5. Route and component acceptance: check all 31 remaining page files, all 43 compatibility redirects, dark and light variants, keyboard/focus, text scaling, narrow touch layouts, loading/empty/error/recovery, and preserved deep links. Record untested routes explicitly.

## Execution order

| Plan | Result | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| 001 | Historical Takeoff outputs have stable identity in embedded and dedicated routes | P1 | S | None | Source fixed; two-output runtime check pending |
| 002 | Recorded PDF, Recap, and Schedule failures have bounded diagnoses and verified remedies | P1 | M | 001 | Schedule verified; Takeoff runtime blocked by local `.next` chunk |
| 003 | Navigation and empty-state actions only lead to usable work | P2 | S-M | None | Source complete; focused tests passed |
| 004 | Dark and light themes share a semantic token contract and persistent preference | P1 | M-L | None | Foundation complete; module adoption ongoing |
| 005 | Opportunities and Takeoff prove the viewport-bound desktop shell | P1 | L | 001, 002, 004 | Opportunity pilot rendered; Takeoff acceptance pending |

## Implementation update — 2026-09-29

- The requested Takeoff legacy assembly audit, Takeoff intelligence preview, and design-review route families are removed from the UI and navigation. Persisted published assembly records, Takeoff compatibility lineage, and production evidence remain. A source audit found no remaining route, link, action revalidation, or compatibility redirect to those families; 31 page files and 43 unique compatibility redirects remain.
- Embedded historical Takeoff outputs now select stable IDs and the recap-consumed labor fields. Opportunity plan links open `/takeoff/[setId]`, and the workstation returns to that opportunity's Plans view. The PDF loader shows a retryable message without exposing the raw internal chunk name.
- The recorded Schedule query embedded `pour_plans` without a source-controlled foreign key. It now joins the existing company-scoped pour-plan result by ID. Authenticated local QA showed the Schedule timeline and explicit empty state, with no unavailable-records alert. Takeoff QA instead encountered a missing local `.next` PDF chunk and then a missing `react-resizable-panels` vendor chunk, which prevented a Commercial Recap check. No shared dev output was deleted or restarted.
- The estimating pilot has a fixed desktop outer frame, a compact record and task bar, a locally scrolling paginated bid grid, mutually exclusive Scope record views, dedicated Takeoff entry, and a bottom context strip. Dark and light Opportunity list/Scope views rendered at 1920px; the Scope task layout rendered at 390px. The saved theme preference also changes the shared CSS and Ant Design tokens. Projects, Field, Finance, Reports, Documents, and Settings still need their separate workstation rollouts after Takeoff acceptance.
- TypeScript and the focused appearance/navigation/Takeoff checks passed. A focused 58-test run initially found one outdated expectation for the intentionally removed Procurement shortcut; the affected 10-test suite passed after that expectation was corrected. Full route-by-route visual acceptance and the Takeoff PDF/Recap runtime gates remain open.

After plan 005 is accepted, roll the same shell contract through Projects, Field, Financials, Documents, Reports, and Settings in separate bounded changes. Retain public proposals, vendor submissions, employee clock/invites, and print documents as task-specific surfaces. For Field, combine Schedule and Look-Ahead as views of one work plan and test whether a Kanban view helps dispatch; the existing timeline must remain available. For Financials, foreground live Billing and Job Cost views and keep unconnected Ledger, Procurement, and Payroll out of live-looking menus. For Reports and Documents, use a bounded two-pane manager inspired by the Edge Portal. Audit all 31 remaining page files and 43 compatibility redirects after rollout, including deep-link continuity.

## Route coverage and limits

The current source has 31 page files after the owner-directed removal of four specialist route pages. The recording directly shows /, /opportunities, /projects, /field, and /financials with selected query views. It enters embedded Takeoff inside /opportunities; it does not demonstrate dedicated /takeoff/[setId]. The source-only inventory also includes /overview, /login, /signup, /employee, /employee/join/[token], /crew/access/invite/[token], /vendor-quotes, /vendor-quotes/[token], /takeoff, /takeoff/plans, /projects/[id], /job-setup, /job-setup/[projectId], /startup, /scope-drift, /change-orders, /forecast, /closeout, /overhead, /billing/invoices/[id], /procurement/purchase-orders/[id], /documents, /reports, /settings, and /proposal/[token]. Source inventory does not establish visual or runtime quality on unrecorded routes.

## Component policy

The repository already contains 41 local TSX files in components/ui plus Carez-specific grids, inspectors, loading states, and workspace controls. Reuse and refine those foundations. Add a component when a real workflow needs it; the ZIP does not evidence a need to expose carousel, OTP, phone input, or every other catalog item on every page. Shared desktop contracts should cover data-grid selection, keyboard operation, column management, localized scrolling, resizable panes, context actions, dialogs, status/feedback, and density before adding ornamental variants.

## Considered and rejected

- Deleting Projects, Field, Production, or Finance because Edge screenshots omit them: the ZIP covers estimating and reports only, while Carez owns downstream work and financial lineage.
- Eliminating all scrolling: the reference itself scrolls inside grids and panes. The target is a fixed outer frame with bounded inner scrolling.
- Replacing the schedule timeline with Kanban outright: Kanban is a candidate alternate view, and the existing timeline carries dates and dependencies.
- Treating the detector's seven style warnings as seven defects: inspected accent borders convey status, and the width transition is a two-pixel progress track. Its many color advisories largely reflect DESIGN.md lagging the current ADR-028 dark implementation. Reconcile the design source during plan 004.
- Pixel-copying the Windows client: its tiny labels, dense icon-only commands, and nested dialogs are usability liabilities in the screenshots.

## Audit baseline before implementation

When this report was first prepared, pnpm typecheck passed once. That static check did not validate the recorded runtime failures, accessibility, mobile behavior, or production state. No source files, branches, commits, remote services, or application data were changed during the initial audit; the implementation update above records subsequent local changes.
