# ADR-001 — User-Authored Concrete Scope Recipes and Template Catalog

Status: Accepted
Date: 2026-09-02
Amended: 2026-09-03 — Scope Recipes, Project Scope Variants, repeatable System Blocks, and floating Recipe Editor locked

## Context

Concrete drawing conditions vary heavily. A slab may use rebar, WWF/WWR, fiber, or no reinforcing. Footings may contain continuous bars, transverse bars, multiple layers, or combinations. Vapor barrier, forms, placement, finishing, embeds, products, and production assumptions also vary.

Carez already has a deterministic, immutable company-assembly foundation. The approved product direction is to keep that authority while presenting it to estimators as reusable concrete scope logic rather than a fixed catalog or database-style editor.

The earlier bottom-composer authoring model is superseded. The Quantity Worksheet remains the permanent Takeoff worksheet. Normal recipe authoring uses a movable/resizable popup over the live plan; Focus Builder maximizes that same editor when needed.

## Decision

1. Carez does not seed a selectable production-assembly catalog into a company's working library. New companies may begin with no company recipes.
2. The persisted assembly/version model is presented as **Concrete Scope Recipes**: reusable company-owned recipes for Slab, Strip Footing, Wall, Grade Beam, Pad Footing, Sidewalk, and other concrete scope.
3. Published Scope Recipe versions are immutable. Editing published work creates a new draft revision.
4. System templates remain separate read-only starting patterns. `Use Template` copies a template into a company-owned draft.
5. A **Project Scope Variant** is a job/takeoff-set-specific configuration of one published Scope Recipe, such as `S1`, `S2`, `F1`, or `F2`. It resolves plan facts and estimator-approved method/production/commercial variables without forcing a new global recipe for each drawing condition.
6. Existing verified Takeoff method-profile infrastructure may be extended compatibly to store Project Scope Variants. Historical method profiles remain valid.
7. Carez supports repeatable **System Blocks**. Required families include concrete volume, continuous rebar, spaced/transverse rebar, rebar grid/mat, WWF/WWR, dowels/starters, fiber, vapor barrier, formwork, labor operations, pump/placement/equipment, and custom items.
8. System Blocks are calculation primitives, not hidden job assumptions. They may create editable variables and deterministic formulas, but cannot silently choose dimensions, bar layouts, rates, waste, prices, products, or means/methods.
9. Multiple reinforcing sets may coexist in one Scope Recipe. A scope may therefore combine longitudinal bars, transverse bars, grids/mats, WWF/WWR, dowels, ties/stirrups, fiber, or custom reinforcing.
10. The primary **Recipe Editor** remains on the same Takeoff route with the live plan visible. It is a movable/resizable popup, not a separate browser window, separate route, permanent Inspector form, or normal bottom-workstation takeover.
11. Recipe Editor position and size should persist locally where practical. **Focus Builder** is a maximize/restore state of the same popup and same draft.
12. Opening, moving, resizing, maximizing, restoring, or closing the editor must not mutate Takeoff geometry or discard sheet, viewport, zoom/pan, calibration, selection, or draft state.
13. The Takeoff Inspector remains compact/contextual, and the Quantity Worksheet remains available beneath the plan while recipe authoring is open.
14. Formula authoring remains estimator-friendly and compiles to the canonical deterministic server-authoritative AST. Ordinary users are not required to type internal namespace tokens.
15. Carez hard-codes reliable calculation primitives/helpers rather than a closed catalog of job formulas. Estimators can compose and edit math from measured geometry, named inputs, operators, conversions, rounding, conditions, and system helpers.
16. Resources remain first-class and independently priceable. Scope items can bind to company/catalog resources without mixing physical quantity math with current pricing.
17. Installed/theoretical quantity, procurement quantity, reusable inventory demand, Direct Cost, and Sell remain distinct.
18. Test Bench previews the current recipe/variant through the same canonical engine.
19. Referenced historical recipe versions remain preserved for lineage. Legacy seeded records are retired/removed only through dependency-safe migration.

## Rationale

A fixed catalog cannot represent real concrete drawings, while creating a new global assembly for every drawing variation causes catalog explosion. Scope Recipe + Project Scope Variant + repeatable System Blocks preserves reusable company logic while allowing each project to resolve the exact drawn condition.

The popup editor preserves plan context and the permanent worksheet, can be moved away from a detail, and can be maximized only when complex work requires more room.

## Consequences

- One reusable recipe can support many plan variants.
- Reinforcing and other systems can repeat as needed.
- Estimators get concrete-specific helpers without losing control of the math.
- Existing immutable version/resource/formula authority remains reusable.
- Current bottom-composer presentation must be converted to popup presentation.
- Existing method-profile storage requires a compatible Scope Variant discriminator/metadata contract.
- Resource Catalog/product integration can deepen incrementally without becoming a second calculation engine.

## Protected invariants

This decision does not change Supabase/PostgreSQL authority, RLS/tenant isolation, stable Takeoff page-coordinate geometry, immutable published recipe lineage, server-authoritative deterministic calculations, exact Takeoff-to-estimate lineage, Production Quantity / Direct Cost / Sell separation, or human authority over scope, methods, production, pricing, margin, and approvals.

## Canonical owners

- `docs/modules/assembly-resource-engine.md`
- `docs/modules/takeoff.md`
- `docs/modules/estimating.md`
- `docs/ARCHITECTURE.md`
