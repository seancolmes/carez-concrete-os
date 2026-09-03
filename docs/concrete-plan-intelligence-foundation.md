> **Document status:** ACCEPTED DETAILED DESIGN  
> **Canonical owner:** `docs/modules/ai-assistance.md`, `docs/modules/documents-knowledge.md`, `docs/ARCHITECTURE.md`  
> **Use:** Supporting Plan Intelligence domain/schema contract. Canonical module and architecture documents govern if scope later changes.  
> **Supersession:** Active design foundation; implementation status belongs in `docs/CURRENT_STATE.md`.

# Carez Concrete Plan Intelligence Foundation

## Purpose

Carez should not ask AI to perform takeoff first. A plan upload should first become a concrete-specific, source-cited knowledge layer that Project Concrete Conditions, Company Condition Templates, and Takeoff objects can consume.

The separation is deliberate:

- **Plans define design requirements.** Concrete strength, wall/slab/footing dimensions, reinforcement, cover, joints, embeds, testing, finishes, schedules, details and revisions come from the contract documents.
- **Estimator-approved Conditions and company templates define means, methods, and commercial logic.** Waste, form system, crew, production rate, equipment, purchasing assumptions, cost and sell remain under estimator control.
- **AI proposes; people approve.** AI discovery never silently becomes an authoritative scope, quantity, Condition assumption, cost, or field instruction.

## Concrete information model

A plan set is normalized into four layers:

1. **Evidence** — page regions and text/images that were actually found.
2. **Scope** — where a requirement applies: plan set, sheet, schedule, detail, type/mark, zone or individual takeoff object.
3. **Facts** — normalized concrete requirements with canonical property keys and typed values.
4. **Human decisions / applications** — confirmation, rejection or override, followed by an explicit binding to a takeoff property when appropriate.

This avoids turning OCR text into truth and preserves a complete source trail.

## Common concrete domains

The canonical fact vocabulary is concrete-specific but extensible. Initial domains include:

- `concrete` — compressive strength, mix/class, exposure, air, slump, w/cm, admixtures
- `reinforcing` — bar size/grade/spacing, mats/faces, laps, hooks, dowels, development, welded wire reinforcement
- `cover` — cast-against-earth, exposed, interior and condition-specific cover
- `footing` — width, depth, steps, keys, reinforcement, bearing-related concrete requirements
- `wall` — thickness, height/type, vertical/horizontal reinforcement, boundary/pilaster conditions
- `slab` — thickness, reinforcement, subbase, vapor barrier, thickened edges
- `grade_beam`, `pier`, `column`, `pad`
- `joint` — construction, control, expansion, isolation, sawcut and waterstop requirements
- `embed` — anchors, hold-downs, plates, sleeves and inserts
- `finish` — broom, trowel, exposed aggregate, slope and finish classes
- `testing` — special inspection, cylinders, slump/air testing and reinforcing inspection
- `civil_concrete` — curb, sidewalk, driveway approach and site concrete requirements
- `revision` — addendum/change relationships that supersede earlier requirements

Canonical property keys are namespaced strings, for example:

- `concrete.compressive_strength_psi`
- `concrete.air_percent`
- `reinforcing.grade`
- `reinforcing.vertical.bar_size`
- `reinforcing.vertical.spacing_in`
- `reinforcing.horizontal.bar_size`
- `reinforcing.horizontal.spacing_in`
- `cover.cast_against_earth_in`
- `wall.thickness_in`
- `slab.thickness_in`
- `footing.width_in`
- `footing.depth_in`

The schema intentionally does not hard-code the complete vocabulary as a database enum. The Condition Engine maps these canonical plan keys to typed archetype/module inputs and estimator-approved Project Condition properties.

## Source provenance

Every proposed fact must trace to one or more `plan_source_regions` containing:

- takeoff set / plan revision
- sheet and PDF page
- source type: general note, schedule, detail, callout, section, specification, legend, revision, etc.
- human-readable source reference (`5/S3.1`, `W1`, `General Structural Note 8`, etc.)
- normalized page-space region when available
- extracted raw text
- extraction confidence and metadata

A fact can have primary, supporting and contradicting evidence.

## Scope and precedence

`plan_scopes` form a parent/child hierarchy and carry an explicit specificity rank. Typical precedence is:

`plan set -> sheet/general requirement -> schedule/type -> detail -> zone/condition -> takeoff object`

A more-specific plan requirement can refine a less-specific requirement, but the system must retain both facts and their sources. `plan_fact_relations` records `supports`, `refines`, `overrides`, `conflicts_with` and `references` relationships instead of deleting evidence.

Manual estimator decisions always outrank AI proposals.

## Review states

Raw evidence is discovery. A normalized `plan_fact` is an AI proposal. Human decisions are append-only records:

- `confirmed` — use the proposed requirement as the approved plan interpretation
- `overridden` — retain the proposal, but use a human-entered resolved value/reason
- `rejected` — do not use the proposed fact

The effective state is therefore auditable without mutating the original extracted fact. A later decision supersedes an earlier decision by time/order rather than overwriting history.

## Conflict behavior

AI must not silently choose between contradictory requirements. If General Notes, a schedule and a detail disagree, all relevant facts remain stored and a `conflicts_with` / `overrides` relationship is recorded. Carez can propose the likely precedence, but the estimator resolves ambiguous conflicts.

## Revision behavior

Plan intelligence is revision-bound through `takeoff_set_id`. A new plan revision produces a new run and new facts; historical facts remain attached to the prior takeoff revision. Later revision comparison can connect facts across revisions using `supersedes` relationships without mutating accepted historical takeoff/estimate lineage.

## Takeoff application boundary

`takeoff_plan_fact_applications` is the future bridge from confirmed plan requirements to a measured object. It stores the exact fact/decision/value applied and an optional future target property key.

It does **not** directly change geometry, cost, production rate or sell. The Condition input resolver consumes approved applications using this order:

1. estimator manual override
2. takeoff-object approved plan fact
3. detail/zone approved plan fact
4. type/schedule approved plan fact
5. sheet/plan-set approved plan fact
6. published Company Condition Template default

Geometry remains authoritative for measured dimensions; plan intelligence supplies design requirements and annotations, not replacement geometry.

## Database objects

The foundation contains:

- `plan_intelligence_runs`
- `plan_scopes`
- `plan_source_regions`
- `plan_facts`
- `plan_fact_sources`
- `plan_fact_relations`
- `plan_fact_decisions`
- `takeoff_plan_fact_applications`
- `plan_effective_facts` (`security_invoker` view)

Raw AI evidence/facts are service-written and office-readable. Human decisions are append-only. Takeoff applications are office-controlled. Every table is tenant-scoped with RLS and explicit Data API grants; `anon` receives no access.

## Deliberately not implemented in this slice

- OCR / vision / LLM plan scanning
- automatic sheet naming
- automatic fact-to-Condition-property mapping
- Condition archetype/module schemas and company-template property mapping
- automatic takeoff mutation
- revision-diff UI
- field publication of unconfirmed AI findings

Those layers should consume this schema rather than force a later redesign of it.
