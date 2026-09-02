# Module Spec — Projects / Work Packages / Scheduling

Status: P3 target

## Purpose
Translate an awarded/frozen commercial baseline into concrete execution units and a field-realistic schedule that can adapt to changing conditions without losing baseline or history.

## Operating model
Project → Work Package → Operation → Production Work Unit → Schedule → Crew/Field → Production → Cost/Forecast.

## Work package contents
Scope, frozen budget allocation, drawings/revisions, operations, production work units, readiness constraints, crew needs, production targets, material needs, pour linkage, inspections, notes, photos, and cost/forecast lineage.

## Scheduling layers

Carez should distinguish three scheduling layers instead of treating one editable calendar as all schedule truth:

1. **Committed / baseline milestones** — contractual or approved project dates and major commitments. These do not move silently.
2. **Rolling lookahead** — the PM/superintendent plan for the next days/weeks based on dependencies, crew capacity, procurement, inspections, weather, access, and trade coordination.
3. **Daily executable plan** — the actual READY work presented to crews for today.

Field variance can change the rolling lookahead and daily executable plan while retaining the original/committed schedule and change history.

## Production work units

Operations should be divisible into measurable, assignable production work units wherever practical. Work units inherit exact physical quantity lineage from awarded Takeoff scope.

Examples:
- Strip Footings → Garage Footing — 184 LF
- Foundation Walls → East Wall — 96 LF
- Slab on Grade → Garage Slab — 1,240 SF

This allows schedule assignment, crew time attribution, completion, production learning, blockers, and cost/forecast to reference the same physical scope rather than generic tasks.

## Readiness and constraints

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

## Field change and resequencing

If scheduled work becomes unavailable in the field, Carez must preserve the failed plan event, create/attach the blocker, and help the foreman or superintendent redirect the crew to alternate READY work.

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

Carez should calculate operational progress from planned work-unit duration/production assumptions plus actual attributed labor time and completed measurable work units.

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
- Award/frozen budget is the lineage source.
- Work packages represent physical execution scope, not generic task containers.
- Production work units retain exact Takeoff/estimate lineage where measurable scope exists.
- Committed schedule, rolling lookahead, and daily executable plan are distinct and traceable.
- Scheduled assignment and actual field work context may diverge without data corruption.
- READY / AT RISK / BLOCKED are operational states, not decorative labels.
- Schedule changes must not silently rewrite frozen commercial baselines or committed milestones.
- Production and cost actuals trace back through work unit/operation/work package to the awarded estimate baseline.
