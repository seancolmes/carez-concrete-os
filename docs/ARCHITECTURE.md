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
- No distributed rewrite without demonstrated need.

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
- An Opportunity never changes entity type into a Project; award creates a distinct Project on the same Job Spine.
- Preconstruction history remains after award, loss, rebid, or revision.
- Multiple estimate/proposal revisions may coexist beneath one Job Spine.
- Customer, location, document, scope, quantity, pricing, and approval data flow through links and immutable snapshots rather than re-entry.

## Takeoff

- PDF is visual reference; stable normalized/vector page coordinates are authoritative geometry.
- Geometry and calibration remain deterministic across zoom/render changes.
- Editing, cutouts, arcs, duplication, undo/redo, and worksheet lineage operate on persisted domain state.
- The permanent resizable bottom Quantity Worksheet is a flagship workstation element and remains available during normal recipe authoring.
- Takeoff selects and applies published company-owned Concrete Scope Recipes plus verified Project Scope Variants/job inputs.
- Recipe authoring stays on the same Takeoff route through a movable/resizable popup Recipe Editor over the live plan. It is not a separate page/browser window and does not turn the permanent Inspector into a long form.
- Focus Builder maximizes/restores that same editor while preserving sheet, viewport, zoom/pan, calibration, selection, and draft state.

## Assembly and resource engine

- Carez does not use a hard-coded production assembly catalog for new work.
- New companies may begin with an empty company recipe library.
- The persisted company assembly/version model is presented as **Concrete Scope Recipes**: reusable user-authored logic for Slabs, Footings, Walls, Grade Beams, Pads, Flatwork, and other concrete scope.
- Optional system templates live separately and become company-owned only through explicit copy-to-draft.
- Published Scope Recipe versions are immutable; referenced historical versions remain preserved for lineage.
- A **Project Scope Variant** is a takeoff-set/job-specific versioned configuration of one published Scope Recipe. It resolves exact plan facts plus estimator-approved method, production, and commercial inputs without forcing a new global recipe for every drawing condition.
- Existing verified method-profile storage may be extended compatibly to persist Scope Variants; historical profiles remain valid.
- Recipes support repeatable **System Blocks** for concrete volume, continuous reinforcing, spaced/transverse reinforcing, rebar grids/mats, WWF/WWR, dowels/starters, fiber, vapor barrier, formwork, labor, placement/pump/equipment, and custom items.
- System Blocks are calculation primitives, not hidden project assumptions. Multiple reinforcing/system instances may coexist in one recipe.
- Recipes convert authoritative Takeoff measurements plus resolved variables into deterministic resource/labor outputs.
- Resources are first-class and independently priceable; recipes determine physical demand rather than embedding current price into quantity math.
- Installed/theoretical quantity, procurement quantity, reusable inventory demand, Direct Cost, and Sell are distinct.
- Formula authoring is estimator-friendly but compiles to one deterministic server-authoritative engine with validation, dependency/cycle protection, conditional logic, and traceability.
- Normal users are not required to type internal calculation namespaces.
- Takeoff → published Scope Recipe version → Project Scope Variant → child/component/resource output → estimate item lineage remains exact.
- Missing inputs or prices are explicit holds, not fabricated zeros.
- Plan facts, method decisions, production assumptions, and commercial assumptions remain distinguishable and retain provenance.

## Commercial lineage

An award decision identifies what the customer accepted; it does not make a mutable estimate draft the execution baseline.

```text
Issued Proposal Revision
→ Award / Customer Acceptance
→ Accepted Scope Snapshot
→ Frozen Commercial Baseline / Budget
→ Project Execution
```

The immutable Accepted Scope Snapshot preserves accepted proposal/estimate revisions; accepted/rejected alternates; scope hierarchy/quantities; exact Takeoff measurement/output and recipe-version/variant lineage; inclusions; exclusions; clarifications; allowances; unit-price terms; Production Quantity, Direct Cost, Sell; production assumptions; and pricing provenance.

The frozen commercial baseline is created from the Accepted Scope Snapshot. Later execution, changes, billing, and forecast append transactions/authorized deltas/superseding versions and never mutate the original accepted snapshot/baseline.

Commercial baseline, schedule baseline, and production-assumption baseline remain separate named concepts.

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

Where practical, measurable awarded Takeoff scope becomes assignable production work units so scheduling, crew time, completion, production learning, blockers, and actual cost reference the same physical scope.

A Production Work Unit may consume one or more versioned **Scope Allocations** partitioning authorized scope from an Accepted Scope Snapshot item or approved change item. Allocations preserve source measurement/output version, allocation basis, quantity/unit, authorization source, and supersession lineage and may not silently overlap/double-count the same authorized source/basis.

Scheduling distinguishes committed/baseline milestones, rolling lookahead, and daily executable READY work. Actual execution history remains separate from planning layers.

A **Constraint** is a prospective readiness condition. A **Blocker Event** records realized execution impact. Field variance may alter lookahead/actual work context without erasing failed plans, silently moving committed milestones, or mutating the frozen baseline.

## Field and pour control

- Employees: payroll time plus low-friction actual work context; scheduled work offered first with quick switch/blocked behavior.
- Foremen: execution leadership, crew awareness, readiness, blockers, sequence, ahead/behind status, and reassignment; not routine daily production-entry workers.
- Superintendents: readiness, coordination, lookahead risk, inspections, pours, and constraints.
- Pour Control: readiness, mix, supplier, pump, linked scope, deliveries, placed/returned quantities, inspections, and variance.

Field truth separates Timecard, Actual Work Context, Constraint, Blocker Event, Completion Evidence, and Production Evidence. Correcting work context never rewrites payroll time. Waiting, blocked, rework, setup, and ambiguous time remain distinguishable from productive labor.

Production Evidence is append-only/versioned and may inform future estimating but never automatically rewrites published recipes, assumptions, budgets, Accepted Scope Snapshots, or accepted estimates.

## Finance and procurement

Carez owns operational financial intelligence, not the statutory general ledger. Keep Budget, Committed, Actual, and Forecast distinct and traceable. Procurement originates from authorized project need and preserves source lineage. Changes/billing retain original commercial baselines.

## Documents and knowledge

One document architecture links files to the Job Spine and phase-specific entities. Drawings separate logical sheet identity from exact revision. Search spans project/commercial records. AI-derived facts retain source evidence and never overwrite source documents.

## AI boundary

AI may assist setup, recognition, extraction, repetition, comparison, retrieval, summarization, QA, clerical preparation, schedule/readiness risk detection, alternate READY-work suggestions, and production-evidence classification.

Humans remain authoritative for scope, assumptions, recipes, means/methods, production rates, pricing, margin, budgets, schedule commitments/material resequencing, approvals, and final commercial decisions.

## Experience architecture

Desktop is a professional workstation. Mobile is field-first.

```text
OPEN:   [ permanent app rail ][ context drawer ][ workspace ]
CLOSED: [ permanent app rail ][ workspace ]
```

The primary desktop rail never disappears merely because the context drawer closes.

Visual direction: professional, industrial, calm, precise, dense, premium, concrete-native. Avoid generic SaaS styling, excessive whitespace, giant rounded cards, glassmorphism, and decorative UI that competes with plans or estimating data.

### Dashboard / Today

The authenticated desktop home surface is the **Today** operating dashboard. It is an operations command surface rather than a generic analytics dashboard.

- Preserve the permanent dark navy Carez app rail while the main dashboard uses the approved light workstation system.
- The primary hierarchy is current operating position → management attention → scheduled production → active jobs, with estimating pipeline and cash attention as secondary operating context.
- Existing dashboard metrics and domain meaning remain intact: Ready to Move, Hard Holds, Field Active, Customers Owe, 7-Day Cash, management attention, scheduled production, active jobs, bid pipeline, and operational cash attention.
- Management exceptions gain stronger hierarchy when present; healthy/zero states remain visually quiet.
- Use icons, semantic color, typography, spacing, and table/list structure to improve scan speed without turning the page into a card-heavy SaaS dashboard.
- The approved light-system Dashboard concept is the reference presentation target for this route; implementation must preserve existing data sources, links, permissions, Job Spine meaning, and operational semantics.
