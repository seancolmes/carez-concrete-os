# Module Spec — Projects / Work Packages / Scheduling

Status: P3 target

## Purpose
Translate an immutable Accepted Scope Snapshot and frozen commercial baseline into concrete execution units and a field-realistic schedule that can adapt to changing conditions without losing baseline or history.

## Operating model
Job Spine → Project → Accepted Scope Snapshot / Frozen Commercial Baseline → Work Package → Operation → Production Work Unit → Versioned Scope Allocation → Schedule / Readiness → Assignment / Field Actuals → Production Evidence → Cost / Forecast.

## Work package contents
Accepted-scope lineage, frozen budget allocation, drawings/revisions, operations, production work units, scope-allocation versions, readiness constraints, crew needs, production targets, material needs, pour linkage, inspections, notes, photos, and cost/forecast lineage.

## Scheduling layers

Carez should distinguish three scheduling layers instead of treating one editable calendar as all schedule truth:

1. **Committed / baseline milestones** — contractual or approved project dates and major commitments. These do not move silently.
2. **Rolling lookahead** — the PM/superintendent plan for the next days/weeks based on dependencies, crew capacity, procurement, inspections, weather, access, and trade coordination.
3. **Daily executable plan** — the actual READY work presented to crews for today.

Field variance can change the rolling lookahead and daily executable plan while retaining the original/committed schedule and change history. Actual execution is a fourth, historical layer and never replaces any of the three planned layers.

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
- exact source Takeoff measurement/output version and published assembly version where applicable;
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
