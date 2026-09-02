# Module Spec — Field / Production / Pour Control

Status: P4 target

## Purpose
Help crews execute work, capture time/production evidence, expose readiness and delays, and control pours with minimal field friction.

Carez must not turn the foreman into a field data-entry clerk. The foreman is an execution leader whose primary interface should answer: what is ready, what is blocked, are we ahead or behind, where is the crew now, what must happen next, and what requires intervention.

## Role model
- **Employee:** clock/time, current assignment/work context, one-tap start/switch/blocked actions when the planned work changes.
- **Foreman:** crew awareness, readiness, blocker resolution, crew reassignment, sequence control, ahead/behind visibility, and minimal exception confirmation. Routine production quantities should not require daily manual entry.
- **Superintendent:** readiness, constraints, inspections, pours, coordination, lookahead risk, and cross-crew/project intervention.

## Field execution model

### Scheduled assignment is a starting hypothesis, not field truth

An employee may be scheduled for one operation but arrive to find that operation unavailable because of excavation, inspection, access, weather, material, equipment, preceding-trade, design, or other constraints.

Carez must allow the actual field work context to diverge from the planned assignment without corrupting time, production, or schedule history.

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
- exact awarded/Takeoff quantity lineage;
- operation/method context;
- scheduled target;
- actual crew/time context;
- completion state;
- blocker/wait/rework context;
- production-learning confidence.

When a measurable work unit is completed, Carez already knows the installed quantity from the work package/Takeoff lineage. The system can calculate production from actual attributed labor hours without asking the foreman to manually type daily LF/SF/CY/EA completed.

Partial production may be inferred only when evidence is sufficient. Uncertain or mixed work must be marked low-confidence rather than silently becoming a production-rate benchmark.

## Production-learning evidence

Production history must distinguish productive and nonproductive context rather than dividing every paid hour by installed quantity.

Relevant time/context classifications include:
- productive operation time;
- setup/mobilization;
- waiting/blocker time;
- inspection hold;
- material/equipment delay;
- rework;
- travel or other non-production time where applicable.

Carez should calculate production-rate evidence from time + completed measurable work units + method/project context. It may surface trends and recommended ranges to estimators, but it must never automatically rewrite published assemblies or estimator-approved production assumptions.

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

## Blockers and field variance

Blockers are first-class execution records, not free-text notes.

A blocker should retain:
- affected project/work package/operation/work unit;
- reason/category;
- detected/reported time;
- reporting source;
- responsible party/owner when known;
- expected clear date/time when known;
- actual clear date/time;
- affected crew/time;
- downstream schedule impact;
- optional evidence/photo/voice/note.

A blocker changes operational readiness/forecast. It does not silently rewrite the awarded baseline or committed contractual milestones.

## Pour Control
Track linked scope/work package, readiness, mix, supplier, pump/placement method, scheduled quantity, deliveries, placed quantity, returned quantity, inspection/test context, notes, and production variance.

Pour tickets, batch/delivery records, inspections, scheduled scope, and placed/returned quantities should provide higher-quality production evidence than asking a foreman to manually reconstruct concrete quantities at day end.

## Invariants
- Field input is operation/work-package/work-unit aware.
- Scheduled assignment and actual work context are distinct and both retained.
- Foremen are exception managers and execution leaders, not routine production-quantity data-entry workers.
- Production quantity is distinct from time and cost.
- Production learning uses attributable labor time and trustworthy measurable completion evidence.
- Ambiguous production evidence is confidence-rated or excluded rather than treated as fact.
- Actuals feed cost/forecast and future estimating evidence without rewriting estimate assumptions.
- Schedule/readiness changes do not mutate frozen commercial baselines.
- Mobile is field-first: high-value actions, low navigation, strong offline/error recovery where required.
