# Carez Concrete OS — Canonical Architecture

## Product premise

Carez Concrete OS is one concrete-contractor operating system from bid invitation through closeout and learning.

Canonical digital thread:

```text
Job Spine
→ Opportunity / ITB
→ Plans
→ Takeoff
→ Estimate Revision
→ Proposal Revision
→ Award Decision
→ Accepted Scope Snapshot
→ Frozen Commercial Baseline / Budget
→ Project
→ Work Package
→ Operation
→ Production Work Unit
→ Versioned Scope Allocation
→ Constraint / Readiness / Schedule
→ Assignment
→ Timecard + Actual Work Context
→ Blocker / Completion Evidence
→ Production Evidence
→ Actual Cost
→ Forecast / Variance
→ Future estimating intelligence
```

The architecture must reduce re-entry and preserve exact lineage between physical scope, commercial decisions, and field execution. The lifecycle changes; the lineage does not.

## Platform stance

- Modular monolith.
- Next.js application with PostgreSQL/Supabase as source of truth.
- Source-controlled migrations.
- Server-authoritative deterministic domain engines.
- Async/background work only where needed for document processing, indexing, integrations, or other long-running tasks.
- No microservices/Kubernetes/Kafka/event sourcing without a demonstrated requirement.

## Data and security

- `company_id` remains the tenant root.
- Browser-accessible tenant tables use RLS.
- Authorization is enforced server-side and, where appropriate, repeated in PostgreSQL procedures.
- Commercially accepted records are immutable/versioned rather than silently rewritten.
- Auditability and provenance are first-class requirements.
- Financial values and quantity/cost recalculation are not trusted to browser-only calculations.

## Job Spine and lifecycle identity

Every bid-to-closeout lifecycle is anchored by one persistent company-scoped **Job Spine** identity.

- Opportunity, Estimate, Proposal, Award Decision, Accepted Scope Snapshot, Project, and later Change Event records are phase-specific entities linked to the same Job Spine.
- An Opportunity never changes its entity type or mutates into a Project. Award creates a distinct Project record on the existing Job Spine.
- Preconstruction records remain historically available after award, loss, rebid, or revision.
- Multiple estimate and proposal revisions may coexist beneath one Job Spine without changing the identity of the underlying job.
- Customer, location, document, scope, quantity, pricing, and approval data should flow through links and immutable snapshots rather than manual re-entry.
- Shared records such as documents may link at the Job Spine level and, when useful, to the exact phase-specific record they support.

## Takeoff

- PDF is the visual reference.
- Stable normalized/vector page coordinates are authoritative geometry.
- Geometry and calibration must remain deterministic across zoom/render changes.
- Editing, cutouts, arcs, duplicate, persistent undo/redo, and worksheet lineage operate on persisted geometry/domain state.
- The permanent resizable bottom quantity/estimate worksheet is a flagship workstation element.
- Takeoff selects and applies published company-owned assemblies.
- Assembly authoring remains integrated with the Takeoff workstation so the live plan can remain visible, but it must use a dedicated resizable builder/composer surface rather than turning the permanent Inspector into a long-form editor.

## Assemblies and resource engine

- Carez does not use a hard-coded production assembly catalog for new work.
- New companies begin with an empty company Assembly Library.
- Assemblies are company-owned, user-authored concrete recipes.
- Optional system templates live in a separate read-only Template Catalog and become company-owned only through an explicit copy-to-draft action.
- Published assembly versions are immutable.
- Historical referenced versions may be retired/hidden but remain preserved for lineage until safe retention rules permit deletion.
- Assembly authoring is an interactive, structured drag-and-drop builder integrated into the Takeoff workstation with the plan still visible; it is not an unrestricted node graph, separate disconnected estimating app, or long Inspector form.
- Assemblies convert Takeoff measurements plus declared plan facts, estimator method decisions, production assumptions, and property bindings into deterministic resource and labor outputs.
- Resources are first-class and independently priceable; assemblies determine resource demand rather than embedding current price as quantity logic.
- Installed/theoretical quantity, procurement quantity, and reusable inventory demand are distinct concepts.
- Formula authoring is visual/estimator-friendly but compiles to one deterministic server-authoritative formula engine with unit validation, dependency/cycle checks, conditional logic, and traceability.
- Takeoff → published assembly version → child/component/resource output → estimate item lineage remains exact.
- Production Quantity, Direct Cost, and Sell are distinct concepts.
- Missing inputs or missing prices are explicit holds, not fabricated zeros.
- Plan facts, Carez method decisions, production assumptions, and commercial assumptions remain distinguishable.
- Pricing and production assumptions retain provenance.

## Commercial lineage

An award decision identifies what the customer accepted; it does not make the mutable estimating draft the execution baseline.

The required boundary is:

```text
Issued Proposal Revision
→ Award / Customer Acceptance
→ Accepted Scope Snapshot
→ Frozen Commercial Baseline / Budget
→ Project Execution
```

The immutable Accepted Scope Snapshot explicitly preserves the awarded interpretation, including the accepted proposal and estimate revisions; accepted/rejected alternates; accepted scope hierarchy and quantities; exact Takeoff measurement/output and published assembly-version lineage; inclusions; exclusions; clarifications; allowances; unit-price terms; Production Quantity, Direct Cost, and Sell facts; production assumptions; and pricing provenance.

The frozen commercial baseline is created from the Accepted Scope Snapshot, not inferred later from the current state of an estimate. Partial awards, negotiated scope, and accepted alternates must be represented explicitly.

Later project execution, changes, billing, and forecast behavior append transactions, authorized deltas, or superseding versions. They must not mutate the Accepted Scope Snapshot or original frozen commercial baseline.

Carez keeps **commercial baseline**, **schedule baseline**, and **production-assumption baseline** as separate named concepts. A change to one never silently changes either of the others.

## Project operating model

After award:

```text
Project
→ Work Package
→ Operation
→ Production Work Unit
→ Versioned Scope Allocation
→ Committed / Lookahead / Daily Schedule
→ Readiness
→ Assignment
→ Timecard + Actual Work Context
→ Completion / Production Evidence
→ Cost / Forecast
```

Work packages are concrete execution units containing scope, budget, drawings, operations, measurable production work units, readiness, crew, production, material needs, pour linkage, notes, photos, and cost/forecast lineage.

Where practical, measurable awarded Takeoff scope should become assignable production work units so scheduling, crew time, completion, production learning, blockers, and actual cost all reference the same physical scope.

A Production Work Unit does not have to consume an entire Takeoff measurement. It owns one or more versioned **Scope Allocations** that partition authorized physical scope from an Accepted Scope Snapshot item or later approved change-scope item.

Each allocation preserves the exact source measurement/output version, operation/allocation basis, allocated quantity and unit, authorization source, and supersession lineage. Allocation sets may leave authorized scope unallocated, but may not silently overlap or double-count quantity within the same authorized source and operation/allocation basis. Split/merge/resequence actions preserve prior allocations and field evidence. A later RFI, drawing revision, or change records the original baseline quantity, current authorized quantity, delta, and source; it never edits the original quantity in place.

Scheduling distinguishes:
- committed/baseline milestones;
- rolling lookahead planning;
- daily executable READY work.

Actual execution history is retained separately from all three planning layers.

A **Constraint** is a prospective readiness requirement or condition that may prevent work from becoming READY. A **Blocker Event** records realized execution impact after work is attempted or underway. A constraint may be cleared without ever becoming a blocker; a blocker may link to the constraint that caused it.

Field variance may alter the working/lookahead plan and actual work context without erasing the failed plan, silently changing committed milestones, or mutating the frozen commercial baseline.

## Field and pour control

Role-specific workflows keep field interaction simpler than office authoring.

- Employees: payroll time plus a low-friction actual work context; scheduled work is offered first, with one-tap switch/blocked behavior when field conditions differ.
- Foremen: execution leadership, crew awareness, readiness, blockers, sequence, ahead/behind status, and crew reassignment. Foremen are not routine daily production-quantity data-entry workers.
- Superintendents: readiness, coordination, lookahead risk, inspections, pours, and cross-crew/project constraints.
- Pour Control: readiness, mix, supplier, pump, linked scope, deliveries, placed/returned quantities, inspections, and variance.

Field truth uses separate, linked records with separate authority:

- **Timecard** — payroll/workforce clock truth and paid-time intervals.
- **Actual Work Context** — auditable allocation of timecard segments to the Job Spine, Project, Work Package, Operation, Production Work Unit, governing Scope Allocation version, and activity classification.
- **Constraint** — prospective requirement affecting readiness.
- **Blocker Event** — realized interruption, delay, or failed-start impact with crew/time and schedule context.
- **Completion Evidence** — timestamped evidence of partial or complete physical scope, source, verifier, quantity scope, and verification state.
- **Production Evidence** — derived observation combining an authorized Scope Allocation version, attributable productive labor, method/context, completion evidence, exception context, and confidence.

Correcting Actual Work Context never rewrites the underlying Timecard. Work-context allocations reconcile to paid time and expose unresolved or overlapping periods. Waiting, blocked, rework, setup, and ambiguous time remain distinguishable so paid time is not automatically treated as productive labor.

Production learning should derive from attributable employee/crew work context plus trustworthy completion of measurable work units and other high-quality evidence such as pour tickets. Completion is supported by evidence rather than a bare checkbox.

Production Evidence is an append-only/versioned observation, not an assembly mutation. Confidence preserves explainable component quality for quantity, time attribution, completion, method context, and exception contamination; simple HIGH / MEDIUM / LOW / EXCLUDED categories may be derived for presentation. High-confidence evidence can inform future estimating history; ambiguous evidence is reviewed or excluded. Field actuals and historical production may inform estimator decisions but never automatically rewrite published assemblies, production assumptions, budgets, Accepted Scope Snapshots, or accepted estimates.

Blocker Events are first-class records tied to the affected work unit/operation, actual work context, and downstream schedule impact. Carez should help authorized field leaders redirect crews to alternate READY work and suggest resequencing, but humans approve material schedule changes.

## Finance and procurement

Carez owns operational financial intelligence, not the statutory general ledger.

Keep distinct and traceable:

- Budget
- Committed
- Actual
- Forecast

Procurement originates from project need derived from the Accepted Scope Snapshot, authorized scope changes, and approved execution planning. Vendor bills and purchases preserve source lineage. Changes and billing retain original commercial baselines.

## Documents and knowledge

One document architecture should allow files to link to the Job Spine and multiple phase-specific entities. Drawings separate logical sheet identity from exact revision. Search spans project and commercial records. AI-derived facts retain page/region evidence and never overwrite source documents.

## AI boundary

AI may assist:

- setup;
- recognition;
- extraction;
- repetition;
- comparison;
- retrieval;
- summarization;
- QA;
- clerical preparation;
- schedule/readiness risk detection;
- alternate READY-work suggestions;
- production-evidence classification and learning recommendations.

Humans remain authoritative for:

- scope;
- assumptions;
- assemblies;
- means and methods;
- production rates;
- pricing;
- margin;
- budgets;
- schedule commitments and material resequencing decisions;
- approvals;
- final commercial decisions.

## Experience architecture

Desktop is a professional workstation. Mobile is field-first.

Desktop shell invariant:

```text
OPEN:   [ permanent app rail ][ context drawer ][ workspace ]
CLOSED: [ permanent app rail ][ workspace ]
```

The primary app rail never disappears at desktop width merely because the context drawer closes.

The visual direction is professional, industrial, calm, precise, dense, premium, and concrete-native. Avoid generic AI/SaaS dashboards, excessive whitespace, giant rounded cards, glassmorphism, and decorative UI that competes with plans or estimating data.
