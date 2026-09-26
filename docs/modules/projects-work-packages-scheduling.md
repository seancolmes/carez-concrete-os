# Module Spec — Projects / Work Packages / Scheduling

Status: P3 target

## Purpose
Translate an immutable Accepted Scope Snapshot and frozen commercial baseline into concrete execution units and a field-realistic schedule that can adapt to changing conditions without losing baseline or history.

## Operating model
Job Spine → Project → Accepted Scope Snapshot / Frozen Commercial Baseline → Work Package → Operation → Production Work Unit → Versioned Scope Allocation → Schedule / Readiness → Assignment / Field Actuals → Production Evidence → Cost / Forecast.

## V1 commercial source lineage

The V1 award migration creates an immutable original commercial baseline tied to the Project, Award Decision, exact Proposal revision, Estimate revision, and Accepted Scope Snapshot. The Project view exposes that lineage and the separate baseline Direct Cost and Sell totals. This source baseline does not imply that downstream Work Package allocation or project-budget actual integrations are complete.

## Work package contents
Accepted-scope lineage, frozen budget allocation, drawings/revisions, operations, production work units, scope-allocation versions, readiness constraints, crew needs, production targets, material needs, pour linkage, inspections, notes, photos, and cost/forecast lineage.

## Scheduling layers

Carez should distinguish three scheduling layers instead of treating one editable calendar as all schedule truth:

1. **Committed / baseline milestones** — contractual or approved project dates and major commitments. These do not move silently.
2. **Rolling lookahead** — the PM/superintendent plan for the next days/weeks based on dependencies, crew capacity, procurement, inspections, weather, access, and trade coordination.
3. **Daily executable plan** — the actual READY work presented to crews for today.

Field variance can change the rolling lookahead and daily executable plan while retaining the original/committed schedule and change history. Actual execution is a fourth, historical layer and never replaces any of the three planned layers.

## Schedule workstation UX

The accepted desktop Schedule surface is a dense **Operations Grid** rather than a generic calendar board or card wall.

### Primary composition

- Retain the compact ADR-016 Option D global menubar above the module workspace.
- The Schedule page header remains compact and operational.
- `+ Add work` is the primary page action.
- Related operational destinations such as 21-Day Look-Ahead, Work Readiness, Resources, and Work Packages move into a compact secondary/related-tools menu or toolbar instead of competing as equal primary buttons.
- The four high-level summaries remain concise: Today, This Week, Blocked, and Crew Demand / Short. Semantic color is restrained and communicates operational state rather than decoration.

### Work plan / crew loading modes

The main workstation uses a compact shadcn/Base UI segmented/toggle control for:

- **Work plan** — primary dense operational grid;
- **Crew loading** — crew/resource allocation view over the same governed schedule facts.

Switching views must not duplicate or fork schedule truth. Both views derive from the same schedule/readiness/assignment records.

### 14-day date strip

Directly above the grid, provide a compact interactive 14-day strip.

- Each day is a small, scan-friendly control rather than a large calendar column.
- Users can select one day or a bounded range to filter/focus the grid.
- Today receives restrained emphasis.
- Days may expose compact operational counts/exception indicators only when useful; do not turn the strip into a second dashboard.
- The strip is navigation/filter context, not schedule authority.
- It must remain keyboard accessible and usable with horizontal overflow on smaller widths.

### Operations Grid

The Work plan view should consume the shared Carez Data Grid pattern and preserve dense professional behavior.

Preferred columns:

- Date / Time
- Job
- Work
- Type
- Package / Quantity
- Readiness / Constraint
- Crew
- Status
- Notes
- Actions

Required behavior:

- sticky/pinned Date, Job, and Work columns where helpful;
- resizable columns;
- compact search and filters for readiness, work type, and active date/range;
- row selection and keyboard navigation;
- restrained row hover/selected state;
- semantic readiness treatment: BLOCKED/destructive, AT RISK/warning, READY/success, ordinary planned work neutral;
- row actions consolidated into compact menu/action controls where practical instead of wide button clusters;
- proper loading, error, empty, and no-result states from the shared Carez Loading/Empty patterns;
- horizontal scrolling must not hide essential frozen context;
- no legacy `industrial-grid-*` visual system in the accepted implementation.

### Empty state

When the active view/range has no schedule items, show one clear bounded empty state inside the grid area with concise text such as `Nothing scheduled in this view` and relevant actions such as `Add work` or `View 21-day look-ahead`.

Do not render nearly invisible placeholder rows or explanatory filler text.

### Component-system requirements

The Schedule conversion must use the active dark shadcn/Base UI Carez workspace and the shared Carez component pack where interaction matches, including:

- Carez Data Grid;
- Carez Toolbar;
- shadcn/Base UI Toggle Group or equivalent source-owned segmented control;
- shared search/filter inputs, dropdown menus, buttons, badges/status indicators, tooltips, and loading/empty states;
- Carez Motion rules for short functional transitions only.

ReUI data-grid behavior is an approved interaction/reference source for dense table capabilities such as sticky scrolling, column resizing/pinning, selection, filtering, and empty/loading treatment, but accepted implementation remains Carez-owned source under the shared shadcn system.

### Mobile / narrow screens

Do not force the desktop grid into a card wall. Preserve the same schedule truth with a compact responsive table/list treatment, horizontally scrollable date strip, and the accepted mobile navigation Sheet. Field-first mobile actions should prioritize what the user can do now: view readiness, crew, blockers, and open the governing work item.

## Production work units

Operations should be divisible into measurable, assignable production work units wherever practical. Work units receive exact physical quantity lineage through versioned Scope Allocations from authorized scope; they do not have to equal an entire Takeoff measurement.

Examples:
- Strip Footings → Garage Footing — 184 LF
- Foundation Walls → East Wall — 96 LF
- Slab on Grade → Garage Slab — 1,240 SF

This allows schedule assignment, crew time attribution, completion, production learning, blockers, and cost/forecast to reference the same physical scope rather than generic tasks.

### Scope allocation and revision lineage

A Scope Allocation is the explicit bridge between a Production Work Unit and authorized physical scope.

Each allocation retains:
- Production Work Unit;
- source Accepted Scope Snapshot item or later approved change-scope item;
- exact source Takeoff measurement/role/output version, Project Concrete Condition version, Company Condition Template/Platform Archetype version, and referenced legacy assembly version where applicable;
- operation/production-quantity basis;
- allocated quantity and compatible unit;
- location/segment or other partition identity when applicable;
- authorization source and effective version;
- predecessor/superseded allocation reference and revision reason.

One accepted measurement may support distinct operation/output bases such as layout, form, reinforcing, and placement. Within one operation/allocation basis, its authorized quantity may be partitioned across multiple work units. A work unit may combine compatible authorized scope from multiple sources only when the operation and quantity basis match. The active allocation set may leave scope unallocated, but validation must prevent unintended overlap, incompatible units, cross-company/cross-Job-Spine linkage, and aggregate allocation beyond the authorized quantity for that source/basis.

An RFI, drawing revision, approved change, split, or merge creates a new allocation/version lineage. It preserves original baseline quantity, current authorized quantity, delta quantity, and the authorizing source. Prior schedule, Actual Work Context, Completion Evidence, and Production Evidence remain linked to the allocation version that governed when each event occurred.

## Readiness, constraints, and blockers

Operations/work units expose READY / AT RISK / BLOCKED state based on explicit constraints such as:
- predecessor work;
- excavation/subgrade;
- layout/survey;
- drawings/RFI/design decision;
- materials;
- equipment/pump;
- inspection;
- access;
- weather;
- preceding trade;
- manpower;
- customer/GC release.

Readiness should drive the daily executable plan. A scheduled date alone must never imply that work is actually executable.

A **Constraint** is prospective: a requirement or condition that must be satisfied, waived by an authorized person, or otherwise resolved before work is executable. It can exist days or weeks before a crew attempts the work.

A **Blocker Event** is actual: it records a failed start or interruption that realized field impact. It retains detected/start/clear timestamps, affected work and crew context, owner, evidence, and downstream effect. A blocker may reference the constraint that caused it, but the two records are never interchangeable. An unsatisfied constraint may keep work NOT READY without creating a blocker; a newly discovered field condition may create a blocker even when no prior constraint existed.

## Field change and resequencing

If scheduled work becomes unavailable in the field, Carez must preserve the failed plan event, create/attach the Blocker Event, and help the foreman or superintendent redirect the crew to alternate READY work.

The scheduling engine may suggest resequencing based on:
- READY alternate work;
- crew capability;
- predecessor/successor relationships;
- material/equipment availability;
- inspection windows;
- pour commitments;
- geographic/project efficiency;
- downstream criticality.

Suggestions do not silently rewrite commitments. Authorized humans approve material schedule changes.

## Ahead / behind intelligence

Carez should calculate operational progress from planned work-unit duration/production assumptions plus Actual Work Context, authorized Scope Allocation versions, and trustworthy Completion Evidence for measurable work units.

Foremen should see simple execution guidance such as:
- Ahead
- On Plan
- At Risk
- Behind

The product should answer:
- What should this crew be doing now?
- Is the current work still expected to finish on time?
- What is blocking the next operation?
- What READY work can absorb the crew if the plan fails?
- Which inspection/material/equipment action threatens tomorrow?

This intelligence should minimize manual status reporting.

## Invariants
- Project is a distinct execution record linked to the persistent Job Spine; Opportunity is never mutated into Project.
- Accepted Scope Snapshot is the awarded-scope source; the frozen commercial baseline/budget is derived from it.
- Work packages represent physical execution scope, not generic task containers.
- Production work units retain exact accepted Takeoff/estimate lineage through versioned Scope Allocations where measurable scope exists.
- Scope Allocation revisions append/supersede; they never rewrite original baseline or completed-event lineage.
- Committed schedule, rolling lookahead, and daily executable plan are distinct and traceable.
- Actual execution history remains separate from all schedule-plan layers.
- Constraint and Blocker Event are distinct; NOT READY does not by itself prove realized field impact.
- Scheduled assignment and actual field work context may diverge without data corruption.
- READY / AT RISK / BLOCKED are operational states, not decorative labels.
- Schedule changes must not silently rewrite frozen commercial baselines or committed milestones.
- Completion Evidence and Production Evidence are distinct from work-unit status and remain traceable to the governing Scope Allocation version.
- Production and cost actuals trace back through scope allocation/work unit/operation/work package to the Accepted Scope Snapshot and frozen commercial baseline.
