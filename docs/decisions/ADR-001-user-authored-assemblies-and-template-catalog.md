# ADR-001 — User-Authored Assemblies and Separate Template Catalog

Status: Accepted
Date: 2026-09-02

## Context

Carez has an accepted immutable custom-assembly foundation, but earlier migrations also seed selectable concrete assemblies and embed example dimensions, production factors, waste assumptions, and labor baselines into company working libraries.

This conflicts with the approved product direction: estimators must build and own their own assemblies, while Carez may accelerate setup through optional templates similar to professional takeoff/estimating systems.

The Assembly Builder also requires a richer authoring experience than ordinary input forms inside the Takeoff Inspector. The Takeoff right pane is already responsible for measurement and selected-object context and should not become the primary assembly authoring surface.

## Decision

1. **Carez will not ship hard-coded selectable production assemblies as the working assembly catalog.**
2. New companies start with an empty company Assembly Library.
3. Existing hard-coded assembly seed/initialization behavior is removed from active product behavior.
4. Existing referenced published assembly versions remain preserved as hidden/retired lineage records until safe retention rules permit deletion; unreferenced seeded records may be removed through a verified migration.
5. Useful examples are recreated as a separate read-only **Assembly Template Catalog**.
6. Using a template explicitly copies it into a new company-owned draft assembly. Template updates never mutate the company's copied assembly.
7. Assembly authoring is performed in a dedicated full-page **Assembly Studio** within the permanent desktop shell rather than as a long form in the Takeoff right pane.
8. Assembly Studio uses structured drag-and-drop building blocks for properties, resources, labor/equipment outputs, formulas, and child assemblies.
9. Authoring remains constrained and recipe-oriented rather than becoming an unrestricted node-graph canvas.
10. A Test Bench previews resolved properties, resource quantities, man-hours, holds, provenance, and formula traces using the same deterministic server-authoritative calculation engine.
11. The existing deterministic formula AST remains the commercial calculation authority. UI-friendly expression authoring may compile to this AST, but a separate math.js/JavaScript evaluator is not authoritative.
12. The formula engine is extended with unit awareness, conditional logic, lookup/piecewise rules, dependency validation, and circular-reference protection.
13. Resources are first-class and independently priceable. Assemblies calculate physical resource/labor demand; resource/pricing systems provide current costs and provenance.
14. Installed/theoretical quantity, procurement quantity, and reusable inventory demand remain separate concepts.
15. Labor production assumptions remain separate from loaded labor price and preserve source/provenance.

## Rationale

A fixed catalog forces Carez assumptions onto contractors and creates maintenance problems as means, methods, supplier products, labor productivity, and company practices differ. User-owned assemblies preserve estimator authority and make the system adaptable without code changes.

Templates retain the setup speed of systems such as zzTakeoff without making example assumptions commercial truth.

A dedicated Assembly Studio provides enough space for interactive authoring and testing while keeping the Takeoff workstation focused on plans, geometry, measurements, method/profile selection, and quantity review.

## Consequences

### Positive

- estimators can create and revise concrete recipes without developer intervention;
- no hard-coded Carez assembly is required for new work;
- templates accelerate setup without becoming hidden defaults;
- resource quantities, production assumptions, and costs remain traceable and independently maintainable;
- the Takeoff Inspector remains compact and task-focused;
- published assembly lineage remains immutable and auditable.

### Costs / migration work

- existing seeded assembly creation and selectors must be audited and removed from active new-work behavior;
- historical references require a safe retirement/deletion migration strategy;
- a separate template storage/model and explicit copy-to-company workflow are required;
- Assembly Studio requires significant UI, formula-authoring, preview, validation, and resource-library integration work;
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
- `docs/modules/takeoff.md` for the Takeoff/Studio interaction boundary
