# Refined Operations Reference Slice Design

Status: Approved design; implementation not started  
Date: 2026-09-19  
Subproject: 4 — Refined-operations reference slice  
Planning base: `bebb34268df7e5186c232787c0cfd269370ec237`  
Repository: `seancolmes/carez-concrete-os`  
Branch: `staging`

## 1. Purpose

Subproject 4 proves the accepted Carez OS UI foundation across one real operational workflow:

```text
Today → Projects → Project Overview
```

The slice validates the combined effect of:

- Issue #63 — Precision Grid theme/token/density foundation;
- Issue #71 — role-adaptive Hybrid global shell + authoritative project context;
- Issue #72 — shared component/state/accessibility foundation.

The selected product direction is **Operational Command Spine**.

The objective is not to restyle three pages independently. The objective is to make them behave as one progressively deeper operating workflow:

```text
Today
  company operating position
  "What needs my attention?"

      ↓ project/job

Projects
  portfolio operating control
  "Which job needs focus and why?"

      ↓ select

Project Inspector
  concise selected-job context
  "What is happening with this job?"

      ↓ Open Project

Project Overview
  full authoritative job operating record
  "What is happening across field, production, cost,
   commercial position, and next action?"
```

## 2. Authority and constraints

The following remain authoritative throughout this slice:

- ADR-024 for Precision Grid visual/theme/token/density behavior and the accepted global shell/navigation system;
- ADR-020 and the active Takeoff contracts for Takeoff invariants;
- `docs/design-system/CAREZ_COMPONENT_PACK.md` for shared Carez component responsibilities;
- root `AGENTS.md` and `CODEX.md` for repository/execution rules;
- Supabase/PostgreSQL and existing server-side summaries for operational and commercial truth;
- existing `company_id` tenant isolation and RLS;
- server-authoritative deterministic quantity, cost, pricing, production, forecast, and financial calculations.

This slice changes information hierarchy, visual composition, shared-component adoption, and interaction presentation only. It does not move domain authority into UI code.

## 3. Scope

### In scope

- `app/page.tsx` — Today reference Overview surface;
- `app/projects/page.tsx` and `components/projects/JobsOperationsBoard.tsx` — Projects portfolio control surface;
- `app/projects/[id]/page.tsx` — Project Overview full Record surface;
- small shared presentation helpers/components only where at least two reference surfaces legitimately require them;
- shared semantic status/state adoption from Issue #72;
- responsive, keyboard, focus, light/dark, and rendered acceptance across the full reference path.

### Explicit non-goals

Subproject 4 does not:

- modify Takeoff or Estimate specialist workspaces;
- change project schema or RLS;
- change project, readiness, financial, production, billing, forecast, commitment, or change-order calculation logic;
- change Job Spine lineage;
- invent new operational records;
- alter Issue #71 route-to-project-context semantics;
- add a second component system;
- redesign Schedule, Billing, Field, Procurement, Forecast, Change Orders, or Pour Control;
- add saved views, custom columns, inline grid editing, bulk selection, drag-and-drop prioritization, or a generic dashboard framework;
- add cross-company filtering;
- implement a new retry/data-fetch framework;
- create new AI behavior;
- touch `main`.

## 4. Reference architecture

The reference workflow uses two application archetypes from the approved Carez redesign:

- **Overview** — Today and the summary portions of Project Overview: exceptions, key metrics, decisions, and work requiring attention;
- **Record** — Projects/Project Overview identity and contextual actions: strong object identity, compact sections, related records, and progressive detail.

Desktop interaction favors:

> **select → inspect → act**

The three routes are intentionally asymmetric:

- Today scans the company;
- Projects controls the active job portfolio;
- Project Overview is the authoritative single-job operating record.

## 5. Today — exact hierarchy

Today answers these questions in this order:

1. What requires intervention?
2. What is the company’s operating position?
3. What work moves today and next?
4. What supporting pipeline/cash context matters after execution priorities?

### 5.1 Header

Use the existing current date as the primary title.

Use `Today` as a restrained eyebrow/kicker.

Keep the existing operating-state sentence directly beneath the date, using the current derived counts:

```text
3 items need attention · 4 ready · 1 on hold · 6 active field shifts
```

Keep current route actions:

- Projects — primary;
- Schedule — secondary.

Do not add company-wide date pickers, dashboard customization, or new global filters.

### 5.2 Management Attention

Management Attention is the first operational surface, above metrics.

It remains driven by the existing `attention` collection and current consequence ordering. Existing facts include readiness/holds, field/time issues, overdue A/R, proposal/lead follow-up, and cashflow exceptions.

Presentation contract:

- error/blocking conditions use shared error/blocked semantics;
- attention-required conditions use warning semantics;
- follow-up/informational items use info semantics;
- each row preserves subject, issue, timing, and owning action;
- text communicates meaning without relying on color;
- visible items remain bounded rather than becoming an unbounded activity feed.

When there are no exceptions, the region collapses to a compact clear state rather than occupying the same height as an exception queue.

### 5.3 Operating Position

Keep exactly these five existing metrics:

```text
Ready to move
Hard holds
Field active
Customers owe
7-day cash
```

They render as one compact operating strip rather than five unrelated dashboard cards.

Each metric contains:

- label;
- tabular primary value;
- short supporting explanation;
- restrained semantic tone only when state warrants it.

A favorable value is not automatically green. Semantic emphasis is reserved for meaningful operational conditions.

### 5.4 Scheduled Production

Scheduled Production is the primary execution table on Today.

Keep the existing columns and source behavior:

```text
Time | Job | Operation | Field | Readiness
```

Requirements:

- use the shared Data Grid/state language where practical;
- Ready/Blocked/Scheduled is text-first semantic status;
- blocked operations continue to show existing `start_next_action` context;
- job links remain direct links to `/projects/[id]`;
- no calendar/timeline replacement is introduced.

Empty state remains operational:

> Nothing scheduled today. Open Schedule to plan the next ready operation.

### 5.5 What Moves Next

This is the company-to-project bridge.

Keep the existing information set:

```text
Job / client
Operational state
Next operation
Next field date
Field activity
Readiness
Budget position
```

The section remains a bounded top subset rather than duplicating the full Projects workspace.

The same semantic vocabulary used on Projects must be reused here.

Today does not gain a project Inspector. It identifies the job requiring attention; Projects owns multi-job inspection.

### 5.6 Bid Pipeline and Cash / Collections

These remain secondary operating context below execution surfaces.

Bid Pipeline preserves:

- open leads;
- proposals out;
- needs reply;
- proposal value;
- next follow-up;
- existing navigation to Leads, Takeoff, Estimates, and Proposals.

Cash / Collections preserves:

- customers owe;
- past due;
- seven-day expected inflow;
- seven-day expected outflow;
- seven-day net;
- existing Billing and Cashflow navigation.

These should read as dense supporting panels, not a new field of metric cards.

## 6. Projects — exact control surface

Projects answers:

> Which jobs can move, which cannot, and where should I focus?

### 6.1 Workspace header

Use compact workspace-header treatment:

```text
OPERATIONS

Projects
See which jobs can move, what starts next, and what is holding the field
before labor or cash gets burned.

                                      [Schedule] [+ New direct job]
```

Preserve:

- Schedule action;
- New direct job action and its current exception-only behavior/explanation.

No new project creation workflow is introduced.

### 6.2 Operating-position strip

Keep the current five metrics:

```text
Ready to move
Hard holds
Needs attention
Field active
Customers owe
```

These remain distinct concepts:

- Ready to move = physical operational readiness;
- Hard holds = blocked execution;
- Needs attention = broader exception state;
- Field active = current execution;
- Customers owe = collection position.

### 6.3 Grid toolbar

Filters remain directly attached to the primary grid workspace.

Keep current controls and behavior:

- text search;
- project/job status;
- project stage;
- attention state;
- sort by priority, schedule, budget used, customer balance, or name;
- reset.

Do not add saved views, advanced query builders, column choosers, or hidden local-storage view persistence.

The grid status line remains compact and communicates result count plus the selection/open behavior.

### 6.4 Canonical grid columns

Keep the current operational columns:

| Column | Purpose |
| --- | --- |
| Job / client | Job number, project name, customer, location |
| State | Ready / Hold / In progress / Waiting / Complete |
| Next step | Next physical/managerial action and first relevant constraint |
| Next date | Next known field date |
| Field | Active shift / timecard / GPS context |
| Budget | Budget-used position plus labor remaining |
| Customers owe | Outstanding A/R and past-due context |
| Priority | Critical / High / Normal |
| Actions | Contextual row menu |

This remains an operations grid, not an accounting ledger.

Numeric treatment uses tabular numerals and appropriate alignment. Existing server-derived values remain authoritative.

### 6.5 Shared status vocabulary

Remove route-local visual status systems where the shared Issue #72 state foundation applies.

Operational state presentation:

```text
Ready        → success
Hold         → blocked/error
In progress  → info
Waiting      → warning
Complete     → success or neutral completion treatment
```

Priority is a separate concept:

```text
Critical → error
High     → warning
Normal   → neutral
```

A job may therefore be operationally Ready while still High priority because of a different exception. The UI must not collapse these concepts.

### 6.6 Selection contract

Single-click selects. Selection does not navigate.

Selection must:

1. set `aria-selected`;
2. use selection styling rather than semantic success/warning/error color;
3. update the selected-job Inspector;
4. preserve the current grid/filter/scroll workspace context while the Inspector is open.

Keyboard requirements:

- rows are reachable through normal keyboard flow;
- Enter on the focused row opens `/projects/[id]`;
- row action menus remain independently keyboard accessible;
- pointer-only selection is not required;
- double-click remains convenience behavior only.

### 6.7 Project Inspector

The shared `CarezInspector` is the contextual detail surface.

Its purpose is:

> Why is this job in the state I see, and what can I do next?

Required hierarchy:

```text
JOB INSPECTOR

Job number
Project name
Customer

[Operational state] [Priority]

NEXT OPERATION
next step
next date

CURRENT CONSTRAINTS
existing reasons

READINESS
Ready ops
On hold
Open ops
Timecards

FIELD
Active shifts
GPS exceptions
Time review

FINANCIAL POSITION
Contract amount
Budget used
Labor remaining
Customer balance
Past due

[Open Project] [contextual secondary action or More]
```

Do not fabricate data absent from the existing Jobs summary query.

The current honest statement that approved change orders, committed cost, and actual cost are not exposed by the Jobs summary must remain true until an owning backend change explicitly provides those facts.

### 6.8 Inspector action hierarchy

Open Project is the primary Inspector action.

A single contextual secondary action may be promoted when current state makes it the obvious next task, such as:

- Clear hold;
- Review time.

Other existing destinations live under a compact More menu:

- Schedule;
- Billing;
- Field;
- Cashflow;
- other currently valid links.

Do not render a permanent grid of equally weighted quick-link buttons.

### 6.9 Desktop and mobile containment

Wide desktop may use a persistent contextual Inspector beside the grid where the grid remains usable.

Standard laptop and narrower widths use the same Inspector composition in a Sheet when a persistent pane would materially squeeze the grid.

Mobile does not depend on hover, right-click, or double-click.

Do not create a second card-based mobile Projects product unless rendered browser testing proves the grid unusable after responsive containment.

## 7. Project Overview — exact full record

Project Overview answers, in order:

1. What job am I looking at?
2. What is wrong?
3. Where does the job stand?
4. What is happening in the field?
5. What are we actually producing?
6. How are cost and margin tracking?
7. What have we billed and what is commercially exposed?
8. What needs to happen next?

### 7.1 Projects → Project Overview transition

The Projects Inspector is not a miniature Project Overview.

Opening a project:

- navigates to `/projects/[id]`;
- activates the Issue #71 project-context row;
- renders the same project identity in the Record Header;
- expands from portfolio summary into authoritative job detail;
- discards selected-object Inspector state from the prior Projects workspace.

Switching projects through Project Context must not carry prior-project Inspector, warning, or object state into the new project.

### 7.2 Top-level order

```text
Project Context
↓
Record Header
↓
What Needs Your Attention
↓
Operating Position
↓
Field & Production
↓
Cost & Forecast
↓
Commercial & Billing
↓
Next Job Action + Related Workflows
```

Exceptions appear before passive metrics.

### 7.3 Project Context and Record Header

Issue #71 Project Context remains above route content and remains route-authoritative only for supported project routes.

Use the accepted `CarezRecordHeader`.

Preserve:

- job number;
- project name;
- address;
- customer;
- Review Crew Time;
- Plan Pour;
- Order Materials.

Project record status may appear through shared `CarezStatus`. It remains distinct from derived operational readiness/priority.

Conceptual record-status presentation:

```text
active    → info / Active
on_hold   → blocked / On hold
planning  → neutral / Planning
completed → success / Complete
```

### 7.4 What Needs Your Attention

This is the first content section.

Keep the current warning derivation:

- submitted timecards;
- GPS exceptions;
- negative labor-hours remaining;
- budget use at or above 85%;
- budget use at or above 100%;
- overdue customer balance;
- unapproved change orders.

Current `bad` conditions map to shared error semantics. Current `watch` conditions map to warning semantics.

When there are no warnings, render a compact positive clear state rather than a large empty card.

### 7.5 Operating Position

Keep exactly these six existing facts:

1. Contract;
2. Budget Used;
3. Labor Hours Used;
4. Customer Owes Us;
5. Money Already Ordered;
6. Where Job Is Headed / forecast margin.

Present them as one operating strip with supporting context rather than six independent cards.

Do not change existing calculations or fallback behavior.

### 7.6 Field & Production

Field & Production combines:

- Crew Today;
- Next Pour;
- Actual Production.

Crew Today preserves:

- Clocked In Now;
- Waiting Approval;
- GPS Flags;
- Actual Labor Hours;
- Review Employee Time;
- Field Logs.

Next Pour preserves:

- current selected upcoming/current pour;
- name;
- date;
- expected concrete yards;
- status;
- Pour Control link.

If no pour exists, show a legitimate empty state.

Actual Production uses the shared Data Grid foundation and preserves columns:

```text
Date
Task
Built
Crew MH
Rate
Estimating Factor
```

Existing `production_rate_history` values remain authoritative. The UI does not recompute production rates.

### 7.7 Cost & Forecast

Budget vs Actual should become an easier comparison surface using the existing categories:

```text
                    Actual       Budget
Labor
Materials
Equipment
Subs / Other
Total Company Cost
```

Presentation changes from `actual / budget` strings into aligned comparison columns. Source values and calculations remain unchanged.

Forecast position presents existing:

- forecast margin at completion;
- target margin;
- forecast variance to budget;
- Forecast navigation.

If no forecast is established, retain an honest unavailable/progress-needed state rather than computing one in UI code.

### 7.8 Commercial & Billing

Commercial & Billing combines billing/collections with change-order exposure.

Billing preserves:

- Authorized Work;
- Billed;
- Not Yet Billed;
- Cash Collected;
- Still Owed;
- Billing navigation.

Change Orders preserve:

- CO number;
- title;
- status;
- field work status;
- proposed sell price;
- approved/open counts;
- Change Orders navigation.

Use shared semantic status presentation instead of route-local badge rules where the shared contract applies.

No approval workflow is added.

### 7.9 Next Job Action

The existing authoritative `p.next_action` remains the source.

Render it as the final explicit decision surface.

If absent, state:

> No next action entered yet.

Do not infer a replacement from schedule, forecast, production, or AI.

### 7.10 Related Workflows

Keep existing workflow destinations but reduce visual competition.

Existing destinations include:

- Review Crew Time;
- Procurement;
- Change Orders;
- Forecast;
- Billing;
- Pour Control.

Use a compact link/toolbar/menu treatment rather than six equal large cards.

## 8. Cross-route continuity contract

The same concept must use the same terminology and shared visual language as the user moves deeper.

| Concept | Today | Projects | Project Overview |
| --- | --- | --- | --- |
| Physical readiness | Ready / Blocked | Ready / Hold | Attention/readiness context |
| Next work | Next operation | Next step | Next Job Action |
| Field execution | Working / active shifts | Field | Crew Today |
| Cost position | Budget position | Budget | Cost & Forecast |
| Customer money | Customers owe | Customers owe | Commercial & Billing |
| Exceptions | Management Attention | Priority / constraints | What Needs Your Attention |

Concepts that genuinely differ remain distinct. In particular:

- project record status;
- operational readiness;
- exception priority.

A small pure presentation helper under `lib/ui/` may centralize label/tone mappings shared by multiple reference surfaces. It must not calculate domain state.

## 9. Navigation and context continuity

### Today

Route: `/`

No project-context row.

### Projects

Route: `/projects`

No project-context row.

A selected project is only local Projects workspace state. Selection does not establish global project authority.

### Project Overview

Route: `/projects/[id]`

Project Context appears because the route authoritatively identifies a project.

Project Context switching preserves the Issue #71 route behavior:

```text
/projects/old-id → /projects/new-id
```

No prior-project selected-object or warning state survives the switch.

### Return behavior

This slice does not add a new global workspace-state persistence system.

While the user remains on Projects, selection/filter/sort/scroll context remains stable during Inspector use.

After full route navigation, browser back/forward remains supported. Durable/shareable Projects view state is not an acceptance requirement for this slice.

## 10. Data trust and unavailable states

Core rule:

> Never turn unavailable data into a reassuring zero.

Examples:

```text
authoritative value = 0
→ render 0

authoritative value unavailable
→ render an explicit unavailable/empty state
```

This distinction applies to:

- budget;
- production;
- forecast;
- A/R;
- commitments;
- field shifts;
- scheduled operations;
- next pour.

Legitimate empty state is not an error state.

## 11. Error-state contract

### 11.1 Route/identity failure

Existing behavior remains:

- unauthenticated → `/login`;
- employee-role routing → `/employee`;
- inaccessible/missing `/projects/[id]` → `notFound()`.

### 11.2 Supporting-section failure

Where practical, failure of a supporting summary degrades only the affected surface rather than silently displaying false zero values or destroying the entire record.

This slice may use the shared Issue #72 feedback/error compositions to communicate that a summary is unavailable.

It does not introduce a new retry/data-fetch framework.

### 11.3 Legitimately empty

Examples include:

- no measured production;
- no active change orders;
- no planned pour;
- nothing scheduled today;
- no projects matching filters.

Use shared empty-state treatment. Do not make these states look like query failures.

## 12. Responsive contract

The information hierarchy remains stable while containment changes.

### Wide desktop — 1440×900 class and wider

- Today uses full-width exception/execution surfaces.
- Projects may use grid + persistent Inspector.
- Project Overview uses balanced paired sections where appropriate.

### Standard laptop — 1280×800 class

- no application-shell overflow;
- Projects keeps the grid primary and may use Sheet-based Inspector if a persistent pane harms grid usability;
- Project Overview paired regions collapse before content becomes cramped.

### Tablet/narrow desktop — 768×1024 class

- accepted Issue #71 responsive shell remains unchanged;
- metrics wrap;
- Data Grids remain contained/horizontally scrollable where necessary;
- Inspectors use Sheet containment;
- no new permanent navigation column.

### Mobile — 390×844 class

Today remains decision-first.

Projects retains search, essential filters, usable job representation, Sheet-based inspection, and explicit Open Project.

Project Overview uses this mobile priority order:

```text
Project Context
↓
Project identity
↓
Attention
↓
Operating Position
↓
Next Job Action
↓
Crew / Field
↓
Next Pour
↓
Production
↓
Cost / Forecast
↓
Billing
↓
Change Orders
↓
Related workflows
```

Next Job Action moves upward on mobile because field execution context is more valuable than full financial detail at phone scale.

No essential operation depends on hover, double-click, right-click, or a persistent desktop Inspector.

## 13. Accessibility contract

### Focus and keyboard

Visible focus is required on all interactive controls.

Projects keyboard flow must support:

```text
search
→ filters
→ sort/reset
→ grid rows
→ row action menu
→ selected-job Inspector
→ Inspector actions
```

Enter on a focused project row opens the project.

Double-click remains convenience only.

Sheet-based Inspector behavior uses the existing accessible Sheet focus/escape behavior.

### Selection

Selected Projects rows expose `aria-selected="true"`.

Selection meaning is not conveyed by color alone.

### Status

Semantic state always includes text labels such as:

- Ready;
- Hold;
- Critical;
- High;
- Blocked;
- Active.

Color supports the label; it does not replace it.

### Grid/table semantics

- headers remain programmatically identifiable;
- numeric values use tabular alignment;
- if direct sortable headers are introduced, they expose correct `aria-sort`;
- otherwise sorting remains represented by the explicit Sort control.

### Dynamic feedback

- error conditions use alert semantics where appropriate;
- informational updates use polite live-region behavior where needed;
- server-rendered content must not generate repetitive unnecessary announcements.

### Motion

No workflow depends on animation.

Reduced-motion users retain complete selection, error, Inspector, and navigation meaning.

## 14. Light/dark and density contract

All migrated surfaces use ADR-024 semantic tokens.

Do not introduce:

- hard-coded alternate amber/red/green palette classes for operational meaning;
- dark-only route styling;
- route-local background systems;
- alternate shadow/elevation vocabulary;
- a second component library.

The current Projects route-local warning palette debt is removed in favor of shared semantic status treatment.

This reference slice uses balanced Precision Grid density. It is neither an oversized consumer dashboard nor a specialist Takeoff-density workstation.

## 15. Shared component adoption

Expected shared-component usage:

```text
Today
  CarezStatus
  CarezFeedback / CarezEmptyState
  CarezDataGrid where appropriate

Projects
  CarezDataGrid
  CarezStatus
  CarezInspector
  CarezEmptyState
  existing shadcn controls

Project Overview
  CarezRecordHeader
  CarezStatus
  CarezFeedback
  CarezDataGrid
  CarezEmptyState
```

A small shared compact operating-metric composition may be introduced because all three reference surfaces legitimately need the same presentational pattern.

Its responsibility is limited to:

```text
label
value
supporting text
semantic tone
```

It must not calculate metrics.

Do not create generic dashboard or attention-feed frameworks unless implementation discovers a concrete repeated interface that cannot be expressed cleanly with the existing shared layer.

## 16. Existing server/data authority to preserve

### Project Overview

Preserve the current reads from:

- `projects`;
- `project_financial_summary`;
- `project_budget_actual_summary`;
- `project_billing_summary`;
- `project_commitment_summary`;
- `project_cost_to_complete_summary`;
- `production_rate_history`;
- `employee_shift_sessions`;
- `change_orders`;
- `pour_plans`.

Current warning, budget, labor, forecast, change-order, shift, and next-pour derivations remain server-route/domain logic.

### Today and Projects

Preserve existing queries, summary sources, and derivation rules. The reference slice changes presentation and shared component use only unless a separately owned bug is discovered.

## 17. Testing boundary

### 17.1 Pure deterministic tests

Any shared operational presentation mapping must be Node-testable and must reject unknown values rather than silently mapping them to a successful/authoritative state.

Representative expectations:

```text
ready    → Ready / success
hold     → Hold / blocked/error
critical → Critical / error
high     → High / warning
unknown  → no successful fallback
```

Tests remain independent of live Supabase.

### 17.2 Reference-slice source contract

Add a focused test file such as:

```text
tests/ui-refined-operations.test.ts
```

It must verify at least:

- Today uses shared semantic status/error/empty components;
- Management Attention precedes operating metrics in the Today composition;
- Projects uses `CarezDataGrid`, `CarezInspector`, and `CarezStatus`;
- Projects preserves selected-row semantics;
- Projects removes hard-coded alternate warning palette usage;
- Project Overview retains `CarezRecordHeader`;
- Project Overview uses shared feedback/status/grid primitives;
- Project Overview section order matches the approved operating narrative;
- important existing action destinations remain present;
- no compatibility presentation layer is added.

### 17.3 Existing regression suite

The following accepted contracts must remain green:

- `tests/ui-navigation.test.ts`;
- `tests/ui-shared-components.test.ts`;
- `tests/ui-shared-state.test.ts`;
- `tests/ui-authority-contract.test.ts`;
- `tests/ui-token-contract.test.ts`;
- normal domain tests.

### 17.4 Validation commands

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-refined-operations.test.ts
pnpm typecheck
pnpm check
```

`pnpm check` currently performs:

```text
pnpm typecheck
pnpm test
pnpm build
```

After push, GitHub Actions provides post-push validation and the matching Vercel staging deployment is the deployed QA authority.

## 18. What automated tests do not prove

Automated source/build tests do not establish acceptance for:

- visual hierarchy;
- realistic 1280px grid usability;
- Inspector width and containment;
- light/dark visual balance;
- keyboard focus quality;
- mobile information order;
- whether Today → Projects → Project Overview reads as one coherent product.

Those require authenticated rendered staging QA.

`docs/CURRENT_STATE.md` must not mark Subproject 4 accepted from source/build success alone.

## 19. Browser acceptance matrix

| Surface | Wide desktop | Laptop | Tablet/narrow | Mobile | Light | Dark | Keyboard |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Today | Required | Required | Required | Required | Required | Required | Required |
| Projects | Required | Required | Required | Required | Required | Required | Required |
| Projects Inspector | Persistent/appropriate | Sheet if needed | Sheet | Sheet | Required | Required | Required |
| Project Overview | Required | Required | Required | Required | Required | Required | Required |
| Project Context on `/projects/[id]` | Required | Required | Required | Required | Required | Required | Required |

Representative viewport targets:

```text
Wide desktop      1440 × 900 or wider
Standard laptop   1280 × 800 class
Tablet/narrow      768 × 1024 class
Mobile             390 × 844 class
```

These are QA targets, not breakpoint specifications.

## 20. End-to-end browser acceptance journey

The acceptance pass must exercise one continuous workflow:

1. Open Today.
2. Confirm Management Attention is first.
3. Confirm Operating Position follows.
4. Confirm Scheduled Production follows.
5. Confirm What Moves Next links coherently into Projects/Project Overview.
6. Open Projects.
7. Confirm compact metric strip.
8. Confirm search/filter/sort behavior.
9. Confirm semantic states are consistent with Today.
10. Select a row and confirm selection does not navigate.
11. Confirm selected row is visibly and semantically selected.
12. Inspect a job.
13. Confirm Inspector matches the selected job.
14. Confirm next operation, constraints, readiness, field, and financial facts are correct.
15. Confirm Open Project is the primary action.
16. Confirm no unavailable/unqueried facts are fabricated.
17. Keyboard-open the project.
18. Confirm `/projects/[id]` loads.
19. Confirm Project Context and Record Header identify the same project.
20. Confirm prior Inspector state is gone.
21. Confirm Project Overview order:
    - Attention;
    - Operating Position;
    - Field & Production;
    - Cost & Forecast;
    - Commercial & Billing;
    - Next Job Action / related workflows.
22. Switch projects through Project Context.
23. Confirm route becomes `/projects/[newId]`.
24. Confirm every displayed fact belongs to the new project.
25. Confirm no stale prior-project state survives.
26. Repeat meaningful visual checks in dark mode, standard-laptop width, tablet/narrow width, and mobile width.
27. Confirm visible keyboard focus and reduced-motion-safe behavior where motion is present.

## 21. Acceptance failure conditions

Subproject 4 does not pass if any of the following are true:

- Today still reads primarily as a generic card dashboard rather than an exception/execution surface;
- Projects loses the `select → inspect → act` workflow;
- Project Overview remains an arbitrary stack of independent cards;
- equivalent state uses conflicting terminology across the route sequence;
- unavailable data is displayed as reassuring zero;
- Project Context appears on Today or `/projects`;
- selected Projects rows become global project authority;
- mobile requires hover, right-click, or double-click;
- the Projects grid is unusable at representative laptop width;
- route-local hard-coded semantic palettes remain where the accepted shared state system applies;
- UI code calculates authoritative quantity, cost, pricing, forecast, production, or commercial values;
- Takeoff or unrelated modules are refactored as part of this slice;
- automated validation passes but authenticated browser QA has not.

## 22. Delivery sequence

Implementation planning must break this design into independently reviewable tasks, with test-first changes where behavior contracts are introduced.

The implementation sequence must preserve:

1. accepted Issue #63 token/theme/density foundation;
2. accepted Issue #71 shell/navigation/project-context behavior;
3. accepted Issue #72 shared component/state/accessibility foundation;
4. current domain/query/calculation behavior;
5. smallest coherent route-level changes;
6. browser acceptance before marking the slice complete.

After Subproject 4 is accepted, the next redesign slice is Subproject 5 — Project → Takeoff specialist reference — using the operational reference as the validated non-specialist counterpart.

## 23. Completion definition

Subproject 4 is complete only when:

- the implementation plan derived from this spec has been executed;
- focused and existing regression tests pass;
- `pnpm typecheck` passes;
- `pnpm check` passes;
- GitHub Actions succeeds on the pushed `staging` commit;
- the matching Vercel staging deployment is READY;
- the browser acceptance matrix passes;
- the end-to-end Today → Projects → Project Overview journey passes;
- canonical documentation is reconciled only after rendered acceptance.

No production release or `main` change is part of this subproject.
