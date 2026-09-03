# Module Spec — Field / Production / Pour Control

Status: P4 target

## Purpose
Help crews execute work, capture time/production evidence, expose readiness and delays, and control pours with minimal field friction.

Carez must not turn the foreman into a field data-entry clerk. The foreman is an execution leader whose primary interface should answer: what is ready, what is blocked, are we ahead or behind, where is the crew now, what must happen next, and what requires intervention.

## Role model
- **Employee:** payroll clock/time, current assignment/work context, one-tap start/switch/blocked actions when the planned work changes.
- **Foreman:** crew awareness, readiness, blocker resolution, crew reassignment, sequence control, ahead/behind visibility, and minimal exception confirmation. Routine production quantities should not require daily manual entry.
- **Superintendent:** readiness, constraints, inspections, pours, coordination, lookahead risk, and cross-crew/project intervention.

## Distinct field records

Carez must preserve six separate but linked concepts:

1. **Constraint** — a prospective readiness requirement or condition.
2. **Blocker Event** — a realized failed start or execution interruption.
3. **Timecard** — payroll/workforce clock truth.
4. **Actual Work Context** — the auditable attribution of time to what was actually performed or experienced.
5. **Completion Evidence** — evidence that an identified quantity scope reached partial or complete physical state.
6. **Production Evidence** — a derived observation used for production analysis and future estimating guidance.

None of these records substitutes for another. Their links provide the evidence chain.

## Field execution model

### Scheduled assignment is a starting hypothesis, not field truth

An employee may be scheduled for one operation but arrive to find that operation unavailable because of excavation, inspection, access, weather, material, equipment, preceding-trade, design, or other constraints.

Carez must allow the actual field work context to diverge from the planned assignment without corrupting time, production, or schedule history.

### Timecard versus Actual Work Context

A Timecard answers when an employee was on the clock and the paid-time facts required by payroll. Actual Work Context answers which Job Spine, Project, Work Package, Operation, Production Work Unit, and activity classification consumed each attributable interval.

- Changing attribution does not rewrite clock-in/out or paid-time facts.
- Context segments link to the applicable Timecard interval and reconcile against it.
- Overlap, gaps, mixed work, and unresolved attribution are visible review states rather than silently assigned production.
- Productive operation, setup/mobilization, waiting/blocker, inspection hold, material/equipment delay, rework, travel, and other applicable contexts remain distinguishable.
- Corrections preserve who changed the attribution, when, why, and the prior state.

### One-tap actual work context

When an employee clocks into a project, Carez should present the expected assignment first:

`Start scheduled work`

If it cannot be performed, the employee or authorized crew leader can use a low-friction exception action such as:

`Can't Start / Blocked`

The blocker should use fast reason choices with optional voice/photo/note rather than requiring a narrative form. Carez should then expose currently READY alternate work that the employee/crew is eligible to perform.

Switching actual work during the day must be equally simple. The system splits time across actual operation/work-unit contexts rather than assuming the original schedule remained true all day.

### Crew-level control

The foreman should be able to move the crew, or a selected subset of the crew, from one operation/work unit to another with one action. Employees should not each have to repeat the same administrative change when the whole crew is redirected.

## Production work units

Production learning should be based on measurable execution units derived from Takeoff / Work Package scope wherever practical.

Examples:
- Garage strip footing — 184 LF
- East basement wall — 96 LF / associated SFCA
- Garage slab — 1,240 SF
- Pad footing group — 8 EA
- Exterior sidewalk zone A — 620 SF

Each work unit preserves:
- exact authorized quantity lineage through the governing Scope Allocation version;
- operation/method context;
- scheduled target;
- actual crew/time context;
- linked Completion Evidence;
- blocker/wait/rework context;
- production-learning confidence.

When a measurable work unit is completed, Carez already knows the authorized installed quantity from its Scope Allocation lineage. The system can calculate production from attributable Actual Work Context without asking the foreman to manually type daily LF/SF/CY/EA completed.

Partial production may be inferred only when evidence is sufficient. Uncertain or mixed work must be marked low-confidence rather than silently becoming a production-rate benchmark.

### Completion Evidence

Completion is supported by an explicit evidence event rather than a bare checkbox. Completion Evidence retains:
- Production Work Unit and governing Scope Allocation version;
- partial/complete state and quantity scope completed where defensible;
- recorded time and field-effective time;
- source and recorder;
- supporting photo, inspection, pour, ticket, successor-start, or authorized confirmation references where applicable;
- verification state, verifier, and verification time;
- correction/supersession lineage.

Completion Evidence does not alter the Accepted Scope Snapshot or original allocated quantity. A later scope revision creates a new authorized allocation/version and preserves evidence recorded against the prior version.

## Production-learning evidence

Production Evidence is a derived, traceable observation. It must distinguish productive and nonproductive context rather than dividing every paid hour by installed quantity.

Relevant time/context classifications include:
- productive operation time;
- setup/mobilization;
- waiting/blocker time;
- inspection hold;
- material/equipment delay;
- rework;
- travel or other non-production time where applicable.

Each Production Evidence observation links the authorized Scope Allocation version, relevant Completion Evidence, attributable Actual Work Context segments, physical quantity, method/crew/project context, exception contamination, derivation version, and confidence factors.

Carez should calculate production-rate evidence from attributable productive context + trustworthy completed measurable scope + method/project context. It may surface trends and recommended ranges to estimators, but it must never automatically rewrite published Company Condition Templates, Project Condition assumptions, referenced legacy assemblies, Accepted Scope Snapshots, frozen budgets, or estimator-approved production assumptions.

Confidence remains explainable through component quality for:
- quantity authority;
- time attribution;
- completion verification;
- method/context completeness;
- exception/contamination separation.

Confidence examples:
- **High:** exact measurable work unit completed, crew time cleanly attributed, no unresolved mixed-work period.
- **Medium:** partial/mixed period with estimator/PM/foreman-confirmed allocation.
- **Low / excluded from learning:** ambiguous activity, unresolved time assignment, major rework/waiting contamination, or quantity not reliably known.

## Foreman operating experience

The foreman home should be an exception-driven live crew board, not a daily report form.

It should emphasize:
- today's crew and where each person/group is working;
- current operation/work unit;
- READY / AT RISK / BLOCKED status;
- planned vs expected finish / ahead-behind indicator;
- inspections, pours, material/equipment and access constraints;
- next READY operation(s);
- blocker owner and expected resolution;
- one-tap crew reassignment;
- urgent changes since the morning plan.

Carez should generate the routine daily record from schedule, timecards, work-context changes, completions, blockers, photos, tickets, and other captured evidence. The foreman should review exceptions, not re-enter events Carez already knows.

## Constraints, Blocker Events, and field variance

A Constraint is managed prospectively by scheduling/readiness. It may be satisfied, waived by an authorized person, or remain open without ever producing field impact.

Blocker Events are first-class records of realized execution impact, not free-text notes or synonyms for unsatisfied constraints. A Blocker Event may link to its originating Constraint.

A Blocker Event should retain:
- affected project/work package/operation/work unit;
- originating constraint when applicable;
- reason/category;
- detected/reported time;
- reporting source;
- responsible party/owner when known;
- expected clear date/time when known;
- actual clear date/time;
- affected crew and Actual Work Context;
- downstream schedule impact;
- optional evidence/photo/voice/note.

A Blocker Event changes operational readiness/forecast. It does not silently rewrite the Accepted Scope Snapshot, frozen commercial baseline, or committed contractual milestones.

## Pour Control
Track linked scope/work package, readiness, mix, supplier, pump/placement method, scheduled quantity, deliveries, placed quantity, returned quantity, inspection/test context, notes, and production variance.

Pour tickets, batch/delivery records, inspections, scheduled scope, and placed/returned quantities may support Completion Evidence and higher-quality Production Evidence. The source records remain distinct rather than being collapsed into a manual day-end quantity.

## Invariants
- Field input is operation/work-package/work-unit aware.
- Timecard and Actual Work Context are distinct, linked, and independently auditable.
- Scheduled assignment and actual work context are distinct and both retained.
- Constraint and Blocker Event are distinct; a prospective readiness gap is not automatically a realized delay.
- Foremen are exception managers and execution leaders, not routine production-quantity data-entry workers.
- Production quantity is distinct from time and cost.
- Completion Evidence is distinct from work-unit status and from derived Production Evidence.
- Production learning uses attributable Actual Work Context, authorized Scope Allocation versions, and trustworthy measurable Completion Evidence.
- Production Evidence is versioned/append-only and never mutates its source records.
- Ambiguous production evidence is confidence-rated or excluded rather than treated as fact.
- Actuals feed cost/forecast and future estimating evidence without rewriting estimate assumptions.
- Schedule/readiness changes do not mutate Accepted Scope Snapshots or frozen commercial baselines.
- Mobile is field-first: high-value actions, low navigation, strong offline/error recovery where required.

