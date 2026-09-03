# Carez Concrete OS — Canonical Architecture

## Product premise

Carez Concrete OS is one concrete-contractor operating system from bid invitation through closeout and learning.

Canonical digital thread:

```text
Job Spine
→ Opportunity / ITB
→ Plans
→ Takeoff / Concrete Conditions
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
- The primary daily object is a named Project Concrete Condition, not a formula or generic recipe.
- One primary measurement role and optional secondary roles connect independently persisted geometry to the same Condition.
- The permanent resizable bottom Quantity/Estimate Worksheet remains available during Condition setup, measuring, verification, and commercial review.
- The estimator works through a resizable context pane with Plans, Conditions, and Zones tabs; a dominant drawing surface; a dockable/floatable/resizable Condition Properties window; and the worksheet.
- Standard Takeoff uses concrete-readable tabs, toggles, dropdowns, typed dimensions, compact grids, derived values, and explicit overrides/holds. Normal users do not see or author formulas.
- Window layout changes preserve sheet, viewport, zoom/pan, calibration, selection, active tool, and unsaved property state.
- Accepted Scope Snapshots preserve the exact measurement, role, Condition/template/archetype versions, outputs, and commercial lineage used by the awarded Proposal revision.

## Concrete Condition and resource engine

- Carez owns versioned Platform Condition Archetypes that define supported geometry roles, typed schemas, module compatibility, deterministic algorithms, validation, output contracts, and dimensional facts.
- Companies own versioned Company Condition Templates containing preferred enabled modules, products, means/methods, production baselines, waste/rounding policy, and pricing defaults.
- Jobs use versioned Project Concrete Conditions containing confirmed plan facts and estimator-approved method, production, and commercial overrides.
- Platform behavior may encode reliable concrete math; it may not silently choose job dimensions, reinforcing design, means/methods, production rates, price, waste, or margin.
- Standard Condition modules include Concrete, Forms, Reinforcing, Anchors/Embeds, Slab Systems, Excavation/Backfill, Placement/Pump/Equipment, Finish/Cure/Protection, Labor Operations, and Miscellaneous.
- Modules are repeatable where physical work repeats and expose typed inputs, activation/validation, deterministic outputs, presentation metadata, provenance, and holds.
- Anchor bolts, dowels, embeds, blockouts, joints, reinforcement sets, form resources, equipment, and labor operations are first-class traceable outputs.
- Resources are independently priceable; Conditions determine physical demand rather than embedding current price into quantity math.
- Installed/theoretical quantity, procurement quantity, reusable inventory demand, Production Quantity, Direct Cost, and Sell are distinct.
- Valid geometry saves when one module is unresolved. Only dependent outputs receive Input, 3D Input, Price, Labor Rate, Method Verification, or Review holds.
- Published Company Condition Template versions are immutable; Project Condition revisions and overrides preserve exact source provenance.
- Formula Composer is removed from normal Takeoff. The deterministic AST remains a compatibility and authorized advanced-company extension behind the same server-authoritative validation/calculation path.
- Canonical lineage is Takeoff Measurement + Role → Project Concrete Condition Version → Company Condition Template Version → Platform Condition Archetype Version → Module/Output → Takeoff Output → Estimate Item.
- Existing published assembly/recipe versions, formula ASTs, outputs, method profiles, estimate links, and accepted references remain immutable through a dependency-safe migration. Legacy UI becomes read-only before removal; referenced history is never deleted.

## Derived 2D/3D takeoff verification

- The drawing workspace exposes 2D, 3D, and synchronized Split modes.
- Persisted 2D/vector geometry remains quantity authority. The 3D scene is a deterministic projection of the same measurement/role/Condition IDs plus governed profile, dimensions, elevation/reference, openings, and segment/step metadata.
- A mesh or rendered solid is never an independent quantity record and never becomes commercial calculation authority.
- Selection, Condition color, visibility, zones, filters, review state, and worksheet focus synchronize across views.
- Missing required dimensions/elevation create a visible 3D Input Required hold; Carez does not invent geometry.
- Initial 3D is read-only quality control: orbit/pan/zoom, hide/isolate, zone/level filters, issue list, and click-through to Condition Properties.
- Quality checks may surface overlap/duplicates, gaps/disconnections, floating or incorrectly elevated elements, opening/cutout conflicts, step discontinuities, and revision changes. Humans confirm scope corrections.
- Controlled property editing from 3D follows only after it uses the same commands, validation, persistence, undo/redo, and lineage as 2D. Freeform 3D modeling is not an initial goal.
- Rebar visualization may later display governed estimating assumptions, but it is not structural-engineering or fabrication authority.
- If 3D rendering is unavailable, authoritative 2D Takeoff and quantities continue to operate.

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

Production Evidence is append-only/versioned and may inform future estimating but never automatically rewrites published Company Condition Templates, Project Condition assumptions, budgets, Accepted Scope Snapshots, or accepted estimates.

## Finance and procurement

Carez owns operational financial intelligence, not the statutory general ledger. Keep Budget, Committed, Actual, and Forecast distinct and traceable. Procurement originates from authorized project need and preserves source lineage. Changes/billing retain original commercial baselines.

## Documents and knowledge

One document architecture links files to the Job Spine and phase-specific entities. Drawings separate logical sheet identity from exact revision. Search spans project/commercial records. AI-derived facts retain source evidence and never overwrite source documents.

## AI boundary

AI may assist setup, recognition, extraction, repetition, comparison, retrieval, summarization, QA, clerical preparation, schedule/readiness risk detection, alternate READY-work suggestions, and production-evidence classification.

Humans remain authoritative for scope, Project Concrete Conditions, company templates/defaults, means/methods, reinforcing interpretation, production rates, pricing, margin, budgets, schedule commitments/material resequencing, approvals, and final commercial decisions.

## Experience architecture

Desktop is a professional workstation. Mobile is field-first.

```text
OPEN:   [ permanent app rail ][ context drawer ][ workspace ]
CLOSED: [ permanent app rail ][ workspace ]
```

The primary desktop rail never disappears merely because the context drawer closes.

Visual direction: modern, minimal, calm, precise, spacious enough for excellent readability, and concrete-native. Use the Estimating EDGE interaction pattern as a benchmark for clear condition organization and screen division while retaining Carez branding and the shared light workstation system. Prefer crisp borders, tabs, dropdowns, restrained color, readable grids, and a small number of predictable dockable/floatable/resizable windows. Avoid tiny text, cramped tool chrome, generic SaaS card walls, giant rounded cards, glassmorphism, decorative UI, excessive unused whitespace, and uncontrolled overlapping dialogs.

### Dashboard / Today

The authenticated desktop home surface is the **Today** operating dashboard. It is an operations command surface rather than a generic analytics dashboard.

- Preserve the permanent dark navy Carez app rail while the main dashboard uses the approved light workstation system.
- The primary hierarchy is current operating position → management attention → scheduled production → active jobs, with estimating pipeline and cash attention as secondary operating context.
- Existing dashboard metrics and domain meaning remain intact: Ready to Move, Hard Holds, Field Active, Customers Owe, 7-Day Cash, management attention, scheduled production, active jobs, bid pipeline, and operational cash attention.
- Management exceptions gain stronger hierarchy when present; healthy/zero states remain visually quiet.
- Use icons, semantic color, typography, spacing, and table/list structure to improve scan speed without turning the page into a card-heavy SaaS dashboard.
- The approved light-system Dashboard concept is the reference presentation target for this route; implementation must preserve existing data sources, links, permissions, Job Spine meaning, and operational semantics.
