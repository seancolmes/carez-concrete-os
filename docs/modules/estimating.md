# Module Spec — Estimating

Status: next major commercial modernization phase after P0.5 Condition/3D foundation

## Purpose

Turn concrete Condition outputs, company means/method decisions, and pricing sources into a commercially reviewable concrete estimate on the persistent Job Spine without duplicate quantity entry.

## Primary workflow

Scope/Conditions → Takeoff → Pricing → Labor → Review/Recap → Proposal Revision.

Award boundary: Proposal Revision → Award Decision/Customer Acceptance → Accepted Scope Snapshot → Frozen Commercial Baseline/Budget.

## Condition Engine boundary

Concrete Condition authoring/calculation is owned by the Concrete Condition & Resource Engine in docs/modules/assembly-resource-engine.md. Estimating consumes deterministic resource/labor/equipment outputs from exact Project Concrete Condition, Company Condition Template, Platform Condition Archetype, module, and measurement-role versions.

Estimating does not own a second formula, quantity, or 3D engine. Normal estimators price and review named concrete Conditions and their modules; they are not required to author formulas.

Advanced custom company logic remains an administrative extension using the same server-authoritative engine. Existing immutable recipe/assembly lineage remains supported through the migration compatibility layer.

## Primary structure

The estimate workspace presents:

- scope/Condition tree;
- synchronized Quantity, Resources, Labor, Pricing, Holds, and Recap views;
- output/module detail and source lineage;
- supplier quote/cost-source selection;
- production assumptions and man-hour build-up;
- alternates, allowances, inclusions, exclusions, clarifications, and proposal grouping.

Selecting a Condition, measurement, module output, or estimate item keeps the corresponding plan/3D/worksheet records synchronized when the drawing workspace is present.

## Invariants

- Published Company Condition Template and Platform Condition Archetype versions are immutable.
- Project Concrete Condition revisions and overrides retain provenance.
- Plan facts, method decisions, production assumptions, commercial assumptions, and drawing presentation remain distinguishable.
- Production Quantity, Direct Cost, and Sell remain separate.
- Pricing retains source/provenance and effective date where available.
- Missing input/price/labor rate becomes a visible hold, not a fabricated zero.
- Manual commercial overrides retain provenance through physical quantity recalculation.
- Accepted commercial records preserve exact historical lineage.
- Opportunity, Estimate, Proposal, Award, Accepted Scope Snapshot, and Project remain distinct records linked by the Job Spine.
- Only an explicit immutable Accepted Scope Snapshot—not current mutable estimate state—may source the frozen commercial baseline.
- Resource quantity and resource price remain independent.
- Installed/theoretical quantity, procurement quantity, and reusable inventory demand remain distinguishable.
- 2D, 3D, worksheet, and estimate totals reconcile to the same authoritative domain outputs.

## Core entities

Scope hierarchy, Project Concrete Condition version, Company Condition Template version, Platform Condition Archetype version, Condition module/output, measurement role, deterministic resource output, estimate item, pricing source, production assumption, hold/status, alternate/allowance/exclusion/inclusion, Proposal revision, Award decision, and Accepted Scope Snapshot.

Legacy assembly/version/component identifiers remain compatibility lineage until dependency-safe migration is complete.

## Pricing sequence

Pricing review supports:

1. applicable vendor bill/actual purchase history;
2. purchase order or supplier quote;
3. company cost catalog;
4. intentionally published company-template default;
5. explicit manual override.

Source description and effective date remain visible. Missing price stays on hold.

Bid zones and supplier quote sets may organize pricing without changing physical Condition quantities.

### Supplier quote sets

Supplier quote evidence is scoped to the exact Estimate revision, not to the downstream Project procurement workflow. A quote set may group competing suppliers by bid zone or scope; each quote line references the generated Takeoff output it prices and records supplier identity, quote reference/date/expiry, quoted unit, unit cost, and freight/tax/fee notes.

Selecting a supplier quote is an explicit commercial decision. Selection is server-authoritative, requires the quote and output to belong to the same company and Estimate, requires matching pricing units, never accepts or mutates Production Quantity, and snapshots `supplier_quote` provenance onto the Takeoff output, generated Estimate item, and linked draft Project Concrete Condition output. Verified Conditions and issued/locked Estimate revisions remain immutable.

Pricing coverage is exception-first: missing price, missing labor rate, expired selected quote, available-but-unselected quote evidence, supplier-quote coverage, and manual overrides remain visible before Review/Recap.

## Labor sequence

Each labor operation shows:

- physical production quantity/unit;
- immutable company baseline MH/unit and source;
- relevant Carez historical evidence when available;
- estimator-reviewed job MH/unit;
- calculated man-hours;
- loaded labor rate;
- Direct Cost.

Changing a production assumption changes man-hours/cost, not concrete, rebar, form, or embed quantities.

## Review and recap

Review emphasizes exceptions and decisions:

- unresolved module/3D/input/price/labor/method holds;
- manual overrides;
- unusual production assumptions;
- unpriced or duplicated resources;
- scope/zone/alternate completeness;
- supplier coverage;
- Direct Cost, overhead/reserve policy, and Sell;
- proposal inclusions/exclusions/clarifications.

3D review issues may block estimator review when designated required, but never auto-change scope.

## Accepted scope handoff

- Proposal revisions are issued records and remain historically identifiable beneath the Job Spine.
- Customer acceptance explicitly resolves full/partial award, alternates, negotiated scope, allowances, unit prices, clarifications, inclusions, exclusions, and terms.
- The Accepted Scope Snapshot preserves exact Proposal and Estimate revisions; scope hierarchy; Takeoff measurement/role and Condition/template/archetype versions; module/resource outputs; production assumptions; Direct Costs; Sell values; and pricing provenance.
- Project creation and frozen budget generation consume that snapshot.
- Later revisions, value engineering, RFIs, and changes append linked records or authorized deltas without mutating the original snapshot.

## Resource direction

Concrete, reinforcing, formwork, anchors/embeds, joints, slab systems, excavation/backfill, consumed material, reusable inventory demand, labor, owned/rented equipment, subcontractors, finish/cure/protection, and miscellaneous concrete resources are first-class outputs.

## Acceptance

An estimator can trace every commercial line to the exact Condition, measurement role, module/output, production assumption, quantity driver, and price source; complete Pricing/Labor/Review/Proposal without formula authoring; and freeze the precisely accepted scope without duplicate quantity entry.
