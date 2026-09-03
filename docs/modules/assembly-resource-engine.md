# Module Spec — Concrete Condition & Resource Engine

Status: approved P0.5 architecture target; legacy assembly runtime remains active until migrated and verified

## Purpose

Turn authoritative Takeoff geometry plus explicit concrete plan facts, company methods, production assumptions, and commercial inputs into deterministic physical resources, labor, equipment, holds, and estimate lineage without requiring formula authoring during normal estimating.

The repository path remains assembly-resource-engine.md during migration so existing links do not break. **Concrete Condition & Resource Engine** is the active product and architecture name.

## Product invariants

- Concrete Conditions are the primary estimator-facing model.
- Standard Conditions are operated through concrete modules, typed fields, toggles, dropdowns, and compact grids.
- Formula Composer is not part of normal Takeoff.
- Platform calculation behavior does not silently choose project scope, reinforcing design, means/methods, production rates, waste, price, or margin.
- Company templates and project Conditions remain versioned and attributable.
- Published Company Condition Template versions are immutable.
- Calculations are deterministic and server-authoritative.
- RLS, tenant isolation, auditability, and exact output lineage remain mandatory.
- Resources are first-class and independently priceable.
- Production Quantity, Direct Cost, and Sell remain separate.
- Installed/theoretical quantity, procurement quantity, and reusable inventory demand remain separate.
- Missing requirements create explicit holds rather than fabricated zeros.
- Accepted commercial references and published legacy records are never destructively rewritten.

## Product concepts

### Platform Condition Archetype

A Carez-owned, versioned definition of one concrete family. It owns:

- supported primary and secondary measurement roles;
- typed input/output schemas and units;
- module compatibility;
- deterministic algorithms;
- validation and hold rules;
- dimensional facts required for derived 3D;
- property-tab presentation metadata;
- migration compatibility identifiers.

Archetypes supply reliable concrete calculation behavior. They are not company or project assumptions.

### Company Condition Template

A company-owned versioned preset for one archetype. It owns preferred:

- products/catalog mappings;
- enabled modules;
- means/method defaults;
- production baselines and sources;
- waste/rounding policies;
- pricing policy/default source;
- labels, organization, and template tags.

A published template is immutable. A change creates a draft revision and later publication.

### Project Concrete Condition

A job/takeoff-set-specific versioned condition, such as F1, F2, W1, or S1. It owns:

- confirmed plan facts;
- estimator-approved method decisions;
- job production assumptions;
- permitted commercial overrides;
- enabled/repeated module instances;
- primary and secondary measurement links;
- drawing presentation;
- holds/review state;
- exact source provenance and supersession history.

### Condition Module

A composable, typed capability attached to a Condition.

Initial module registry:

- Concrete
- Forms
- Reinforcing
- Anchors / embeds
- Slab systems
- Excavation / backfill
- Placement / pump / equipment
- Finish / cure / protection
- Labor operations
- Miscellaneous

A module contains inputs, activation, validation, deterministic output rules, output definitions, and presentation metadata. Repeatable instances are supported where the physical work repeats.

### Measurement Role

A named relationship between persisted Takeoff geometry and a Project Concrete Condition. One role is primary; others may provide edge forms, steps, openings, joints, blockouts, anchor groups, or other traceable geometry.

### Output

A deterministic module result with:

- exact Condition/archetype/template/module version lineage;
- measurement/role drivers;
- production quantity and unit;
- installed/procurement/inventory classification;
- labor/equipment basis where applicable;
- hold/review state;
- price provenance;
- estimate-item linkage.

## Input governance

Every input is typed as:

1. plan fact;
2. method decision;
3. production assumption;
4. commercial assumption;
5. drawing presentation.

Resolution order is:

1. authorized project/Condition override;
2. approved plan fact;
3. Company Condition Template default;
4. Platform Archetype default only where genuinely universal and safe;
5. unresolved hold.

Derived and editable values must look different in the UI. Overrides retain actor, time, reason, prior source, and effective value.

A built-in geometry/measurement fact is used before asking for a duplicate input.

## Module behavior

### Concrete

Calculates theoretical volume from authoritative geometry and governed dimensions/profile, then applies explicit waste/rounding only at the appropriate output layer. Concrete class/PSI/mix are estimator-visible facts when used.

### Forms

Calculates form contact area plus explicit consumed/reusable form resources from visible formed-face and system choices. It does not hide unknown resources behind a generic allowance.

Safety-critical form-system layouts require a verified source/envelope and human approval. Carez counts a selected safe method; it does not engineer formwork.

### Reinforcing

Supports repeated sets for continuous bars, transverse bars, vertical/horizontal wall steel, mats/grids, dowels/starters, ties/stirrups, cages, WWR/WWF, fiber, and governed custom scheduled steel.

Inputs may include size/unit weight, count/spacing, cover, layers/faces, stock length, lap policy, standard hooks/shapes, location range, waste, and placement labor. Carez never invents structural design.

### Anchors / embeds

Supports direct counts, spacing along runs, grouped anchor templates, dowels/embeds linked to secondary measurement roles, and blockouts/penetrations with traceable count sources.

### Slab systems

Supports vapor barrier, granular base, WWR/rebar/fiber, thickened edges, joints, blockouts, finish, cure, protection, and placement choices as visible modules.

### Excavation / backfill

Uses explicit cut profile, working room, over-excavation, export, reuse, and backfill/compaction assumptions. The source plan geometry and assumptions remain explainable.

### Placement / equipment

Separates physical demand from commercial fulfillment. Pump, chute, conveyor, crane/bucket, owned equipment, rental, and subcontract paths remain distinct where applicable.

### Labor operations

Each operation preserves physical basis/unit, immutable company baseline and source, estimator-reviewed job rate, resulting man-hours, labor cost basis, and output lineage. Changing labor production does not change physical material quantity.

## Holds

Valid geometry persists when a specific module cannot calculate. Hold categories include:

- Input required
- 3D input required
- Price required
- Labor rate required
- Method verification required
- Review/manual override

A hold blocks only the dependent output and appropriate commercial-readiness gate. Resolving it recalculates atomically without redrawing geometry.

## Advanced custom logic

A single deterministic AST engine remains available for compatibility and authorized advanced company configuration.

- It is not exposed in normal Takeoff.
- It cannot execute arbitrary JavaScript, SQL expressions, or unvalidated code.
- It compiles through the same unit/reference/dependency validation and server calculation path.
- Existing valid published formulas remain readable and reproducible.
- A standard Condition module should be extended when a broadly useful concrete pattern is missing.
- Advanced logic is for legitimate company-specific cases, not the default way to model ordinary concrete.

## 3D projection boundary

The engine emits governed dimensional facts for the derived 3D service: profile, dimensions, elevation/reference, sweep/extrusion, openings, and segment overrides.

It does not accept 3D mesh measurements as quantity authority. Slabs/pads extrude governed profiles; walls/strip footings/grade beams sweep governed profiles; cutouts/openings subtract; stepped segments follow explicit elevation/profile data.

The renderer and client may cache meshes by stable version/hash, but all calculated outputs remain server/domain results.

## Lineage

Canonical lineage is:

Takeoff Measurement + Role  
→ Project Concrete Condition Version  
→ Company Condition Template Version  
→ Platform Condition Archetype Version  
→ Condition Module / Output Definition  
→ Takeoff Output  
→ Estimate Item

The compatibility layer may additionally retain legacy assembly version/component IDs until all referenced history is fully supported.

## Migration from legacy assemblies/recipes

The migration is additive and dependency-safe.

1. Inventory legacy assemblies, versions, variables, components, children, formulas, method profiles, measurements, outputs, estimate links, proposals, and accepted references.
2. Add Condition/archetype/template/module/role structures with company-scoped RLS and immutable version rules.
3. Provide explicit legacy compatibility IDs/mappings.
4. Implement and test pilot archetypes for Pad/Column Footing, Strip/Wall Footing, and Slab on Grade.
5. Convert supported company recipes/project variants and reconcile quantity, hold, price, and lineage results.
6. Switch new standard work to Conditions only after parity.
7. Preserve historical legacy views as read-only where needed.
8. Remove active Recipe Editor/Formula Composer/Assembly Library routes and components after dependency checks.
9. Never delete a referenced published or accepted record. Any physical schema retirement requires a separate approved recoverable migration.

## Integration boundaries

### Takeoff

Owns plan/revision/calibration, vector geometry, measurement roles, selection/editing, 2D/3D/Split interaction, and the estimator workstation.

### Estimating

Owns scope organization, pricing review, production-rate review, Direct Cost/Sell strategy, commercial holds, recap, and Proposal revisions.

### Resource catalog and procurement

Own product/supplier/rental/inventory identity, quotes/cost history, package/stock optimization, fulfillment, commitments, and receipts. Condition outputs express physical demand.

### Project and field

Consume accepted scope and resource/production assumptions through immutable lineage. Actual evidence may inform future templates but never silently rewrites them.

## Initial acceptance

The engine is accepted when the three pilot families can be created, measured, edited, recalculated, priced, traced, migrated, and verified in 2D/3D without formula UI in the daily workflow, with representative RLS, refresh, undo/redo, deletion, cross-sheet, hold, and output-reconciliation tests.
