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
→ Schedule
→ Crew / Time
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

## Assemblies and estimating

- Published assembly versions are immutable.
- Assemblies convert measurement outputs plus declared estimator inputs into deterministic resource and labor outputs.
- Takeoff → published assembly version → component/output → estimate item lineage must remain exact.
- Production Quantity, Direct Cost, and Sell are distinct concepts.
- Missing inputs or missing prices are explicit holds, not fabricated zeros.
- Plan facts, Carez method decisions, production assumptions, and commercial assumptions remain distinguishable.
- Pricing retains provenance.

## Commercial lineage

Accepted estimate/proposal state becomes a frozen project baseline. Later project execution, changes, billing, and forecast behavior may add transactions or revisions but must not mutate the accepted historical commercial record.

## Project operating model

After award:

```text
Project
→ Work Package
→ Operation
→ Schedule
→ Crew / Field
→ Production
→ Cost / Forecast
```

Work packages are concrete execution units containing scope, budget, drawings, operations, readiness, crew, production, material needs, pour linkage, notes, and photos.

## Field and pour control

Role-specific workflows keep field interaction simpler than office authoring.

- Employees: clock/time and assigned work.
- Foremen: crew, operation, quantity, issues, production.
- Superintendents: readiness, coordination, pours.
- Pour Control: readiness, mix, supplier, pump, linked scope, deliveries, placed/returned quantities, inspections, and variance.

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
- clerical preparation.

Humans remain authoritative for:

- scope;
- assumptions;
- assemblies;
- means and methods;
- production rates;
- pricing;
- margin;
- budgets;
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
