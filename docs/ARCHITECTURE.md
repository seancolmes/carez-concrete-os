# Carez Concrete OS — Canonical Architecture

## Product premise

Carez Concrete OS is one concrete-contractor operating system from bid invitation through closeout and learning.

Canonical digital thread:

```text
Opportunity / ITB
→ Plans
→ Takeoff
→ Estimate
→ Proposal
→ Award
→ Frozen Budget
→ Work Package
→ Operation
→ Production Work Unit
→ Schedule / Readiness
→ Crew / Time / Actual Work Context
→ Production
→ Actual Cost
→ Forecast / Variance
→ Future estimating intelligence
```

The architecture must reduce re-entry and preserve exact lineage between physical scope, commercial decisions, and field execution.

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

Accepted estimate/proposal state becomes a frozen project baseline. Later project execution, changes, billing, and forecast behavior may add transactions or revisions but must not mutate the accepted historical commercial record.

## Project operating model

After award:

```text
Project
→ Work Package
→ Operation
→ Production Work Unit
→ Committed / Lookahead / Daily Schedule
→ Readiness
→ Crew / Actual Work Context
→ Production
→ Cost / Forecast
```

Work packages are concrete execution units containing scope, budget, drawings, operations, measurable production work units, readiness, crew, production, material needs, pour linkage, notes, photos, and cost/forecast lineage.

Where practical, measurable awarded Takeoff scope should become assignable production work units so scheduling, crew time, completion, production learning, blockers, and actual cost all reference the same physical scope.

Scheduling distinguishes:
- committed/baseline milestones;
- rolling lookahead planning;
- daily executable READY work.

Field variance may alter the working/lookahead plan and actual work context without erasing the failed plan, silently changing committed milestones, or mutating the frozen commercial baseline.

## Field and pour control

Role-specific workflows keep field interaction simpler than office authoring.

- Employees: clock/time plus a low-friction actual work context; scheduled work is offered first, with one-tap switch/blocked behavior when field conditions differ.
- Foremen: execution leadership, crew awareness, readiness, blockers, sequence, ahead/behind status, and crew reassignment. Foremen are not routine daily production-quantity data-entry workers.
- Superintendents: readiness, coordination, lookahead risk, inspections, pours, and cross-crew/project constraints.
- Pour Control: readiness, mix, supplier, pump, linked scope, deliveries, placed/returned quantities, inspections, and variance.

Production learning should derive from attributable employee/crew time plus trustworthy completion of measurable work units and other high-quality evidence such as pour tickets. Waiting, blocked, rework, setup, and ambiguous time must remain distinguishable so paid time is not automatically treated as productive labor.

Production evidence is confidence-rated. High-confidence evidence can inform future estimating history; ambiguous evidence is reviewed or excluded. Field actuals and historical production may inform estimator decisions but never automatically rewrite published assemblies, production assumptions, budgets, or accepted estimates.

Blockers are first-class records tied to the affected work unit/operation and downstream schedule impact. Carez should help authorized field leaders redirect crews to alternate READY work and suggest resequencing, but humans approve material schedule changes.

## Finance and procurement

Carez owns operational financial intelligence, not the statutory general ledger.

Keep distinct and traceable:

- Budget
- Committed
- Actual
- Forecast

Procurement originates from project need. Vendor bills and purchases preserve source lineage. Changes and billing retain original baselines.

## Documents and knowledge

One document architecture should allow files to link to multiple entities. Drawings separate logical sheet identity from exact revision. Search spans project and commercial records. AI-derived facts retain page/region evidence and never overwrite source documents.

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
