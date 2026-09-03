# ADR-001 — User-Authored Assemblies and Separate Template Catalog

Status: Accepted
Date: 2026-09-02
Amended: 2026-09-02 — integrated Takeoff Assembly Builder and Focus Builder interaction locked

## Context

Carez has an accepted immutable custom-assembly foundation, but earlier migrations also seed selectable concrete assemblies and embed example dimensions, production factors, waste assumptions, and labor baselines into company working libraries.

This conflicts with the approved product direction: estimators must build and own their own assemblies, while Carez may accelerate setup through optional templates similar to professional takeoff/estimating systems.

The Assembly Builder also requires a richer authoring experience than ordinary input forms inside the Takeoff Inspector. The Takeoff right pane is already responsible for measurement and selected-object context and should not become the primary assembly authoring surface.

An earlier form of this ADR placed authoring in a separate full-page Assembly Studio. That interaction is superseded by the approved integrated model: normal assembly authoring remains inside the Takeoff workstation with the live plan in context, using a dedicated resizable builder/composer surface. A temporary Focus Builder may expand that composer for complex work without navigating to another route or creating a separate application surface.

## Decision

1. **Carez will not ship hard-coded selectable production assemblies as the working assembly catalog.**
2. New companies start with an empty company Assembly Library.
3. Existing hard-coded assembly seed/initialization behavior is removed from active product behavior.
4. Existing referenced published assembly versions remain preserved as hidden/retired lineage records until safe retention rules permit deletion; unreferenced seeded records may be removed through a verified migration.
5. Useful examples are recreated as a separate read-only **Assembly Template Catalog**.
6. Using a template explicitly copies it into a new company-owned draft assembly. Template updates never mutate the company's copied assembly.
7. Primary assembly authoring remains **inside the Takeoff workstation**. In normal authoring mode the live plan remains visible and the Assembly Builder uses a dedicated resizable composer surface, normally expanding from the permanent bottom Quantity Worksheet/workstation region. It is not implemented as a long form in the Takeoff Inspector, a separate browser window, or a disconnected full-page route.
8. The Takeoff Inspector remains compact and contextual. It may show the selected assembly/version, current job method/profile, holds, key outputs, and commands such as Create Assembly, Edit Assembly, Create Revision, or Open Builder, but it is not the primary recipe-authoring canvas.
9. The Assembly Builder supports an optional **Focus Builder** mode for complex assemblies. Focus Builder may temporarily expand the composer to occupy most of the Takeoff workspace, but it remains on the same Takeoff route, uses the same draft and calculation authority, and preserves sheet, plan, zoom/pan, selection, and measurement context so exiting focus returns the estimator to the prior drawing state.
10. The Assembly Builder uses structured drag-and-drop building blocks for properties, resources, labor/equipment outputs, formulas, and child assemblies.
11. Authoring remains constrained and recipe-oriented rather than becoming an unrestricted node-graph canvas.
12. A Test Bench previews resolved properties, resource quantities, man-hours, holds, provenance, and formula traces using the same deterministic server-authoritative calculation engine.
13. The existing deterministic formula AST remains the commercial calculation authority. UI-friendly expression authoring may compile to this AST, but a separate math.js/JavaScript evaluator is not authoritative.
14. The formula engine is extended with unit awareness, conditional logic, lookup/piecewise rules, dependency validation, and circular-reference protection.
15. Resources are first-class and independently priceable. Assemblies calculate physical resource/labor demand; resource/pricing systems provide current costs and provenance.
16. Installed/theoretical quantity, procurement quantity, and reusable inventory demand remain separate concepts.
17. Labor production assumptions remain separate from loaded labor price and preserve source/provenance.

## Rationale

A fixed catalog forces Carez assumptions onto contractors and creates maintenance problems as means, methods, supplier products, labor productivity, and company practices differ. User-owned assemblies preserve estimator authority and make the system adaptable without code changes.

Templates retain the setup speed of systems such as zzTakeoff without making example assumptions commercial truth.

Keeping normal assembly authoring in the Takeoff workstation preserves plan context and avoids forcing an estimator to leave the measurement workflow just to create or revise a recipe. Moving the heavy authoring surface into a resizable bottom composer protects the Inspector from becoming an overloaded property form. Focus Builder provides additional workspace when a recipe becomes complex without introducing a second route, second authoring model, or context-loss boundary.

## Consequences

### Positive

- estimators can create and revise concrete recipes without developer intervention;
- no hard-coded Carez assembly is required for new work;
- templates accelerate setup without becoming hidden defaults;
- resource quantities, production assumptions, and costs remain traceable and independently maintainable;
- normal assembly authoring keeps the live plan in context;
- the Takeoff Inspector remains compact and task-focused;
- Focus Builder provides room for complex authoring without navigating away from Takeoff;
- published assembly lineage remains immutable and auditable.

### Costs / migration work

- existing seeded assembly creation and selectors must be audited and removed from active new-work behavior;
- historical references require a safe retirement/deletion migration strategy;
- a separate template storage/model and explicit copy-to-company workflow are required;
- the integrated Assembly Builder requires significant UI, drag/drop, formula-authoring, preview, validation, resource-library, bottom-workstation resizing, and Focus Builder state-preservation work;
- Takeoff drawing state must survive entry/exit from normal builder and Focus Builder modes without mutating geometry or losing viewport/selection context;
- unit-aware formula validation will require coordinated domain changes and tests.

## Protected invariants

This decision does not change:

- Supabase/PostgreSQL authority;
- tenant isolation and RLS;
- stable Takeoff page-coordinate geometry;
- immutable/versioned published assembly lineage;
- server-authoritative deterministic calculations;
- separation of Production Quantity, Direct Cost, and Sell;
- human authority over assemblies, means/methods, production rates, pricing, margin, and approvals.

## Canonical owners

- `docs/modules/assembly-resource-engine.md`
- `docs/modules/estimating.md`
- `docs/ARCHITECTURE.md`
- `docs/modules/takeoff.md` for the Takeoff/Assembly Builder interaction boundary
