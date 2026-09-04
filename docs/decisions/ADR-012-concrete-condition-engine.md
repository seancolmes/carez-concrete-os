# ADR-012 — Concrete Condition Engine

Status: Accepted  
Date: 2026-09-03  
Supersedes in part: ADR-001  
Presentation/shell note: ADR-015 and ADR-016 supersede the earlier light-workstation/permanent-global-left-rail wording in this ADR. The Concrete Condition product/domain decision remains authoritative.

## Context

Carez's first Takeoff foundation proved normalized plan geometry, calibration, deterministic server calculations, immutable published versions, exact Takeoff-to-Estimate lineage, and tenant isolation. Its current daily workflow, however, is organized around Scope Recipes, System Blocks, Project Scope Variants, and a visible Formula Composer.

Review of The EDGE Estimator in concrete use showed a simpler estimator mental model: select a named concrete condition, measure its primary geometry, configure concrete-specific modules, and receive resulting quantities and labor without authoring formulas during normal takeoff. The interface remains readable because the plan, condition tree, property tabs, and worksheet divide responsibility clearly.

Carez adopts that interaction model while retaining its stronger Job Spine, versioning, accepted-scope, field-production, procurement, cost, and learning lineage.

## Decision

### Primary estimator object

The primary daily Takeoff/Estimating object is a **Concrete Condition**.

Examples include F1 — 24 × 10 strip footing, PF2 — 6 × 6 × 18 pad footing, W3 — 8 in wall at 9 ft high, S1 — 5 in slab on grade, and C2 — 24 in round pier.

A Condition combines:

1. concrete work type and geometric profile;
2. one primary measurement role;
3. optional secondary measurement roles;
4. enabled concrete-specific modules;
5. company defaults and job-specific overrides;
6. deterministic resource, labor, equipment, and estimate outputs;
7. exact immutable version and source lineage.

The estimator is not required to see or write a formula to use a standard Condition.

### Three-layer ownership model

Carez separates three kinds of authority:

1. **Platform Condition Archetype** — Carez-owned deterministic calculation behavior, supported module schema, units, validation, and UI contract for a concrete family.
2. **Company Condition Template** — company-owned defaults for products, means/methods, production assumptions, waste, pricing policy, and preferred enabled modules.
3. **Project Concrete Condition** — job/takeoff-set-specific named instance containing confirmed plan facts and estimator-approved overrides.

Platform archetypes may encode reliable concrete math and calculation primitives. They may not silently choose project dimensions, reinforcing design, production rates, price, waste, means/methods, or commercial strategy.

### Measurement roles

Every Condition declares one primary measurement role and may declare additional named roles.

| Condition family | Primary role | Possible secondary roles |
| --- | --- | --- |
| Slab on grade | Area | edge forms, thickened edge, joints, blockouts, penetrations |
| Strip footing | Centerline or run length | steps, end forms, keyway, dowels, embeds |
| Wall | Wall run | openings, pilasters, construction joints, waterstop |
| Pad footing | Count/locations | varying dimensions, pedestals, anchor groups |
| Pier/column | Count/locations | shaft depth, bell/base, embeds |
| Curb/sidewalk | Run or area | returns, ramps, joints |

Each measurement remains an independent persisted geometry record with a role and Condition-instance link. Secondary geometry is not hidden inside a formula and does not become an untraceable manual quantity.

### Standard modules

Conditions expose concrete-specific modules rather than a blank formula canvas. The initial registry is:

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

Modules are composable and repeatable where the work requires it. Reinforcing, anchors/embeds, labor operations, and miscellaneous outputs may have multiple instances.

A module defines typed inputs, visibility/activation rules, validation, deterministic quantity logic, output definitions, and a compact property presentation. Derived values are visibly distinguished from editable values. A governed override records who changed it, when, why, and what source/default it replaced.

### Advanced custom logic

The existing deterministic AST remains a supported compatibility and extension mechanism, but Formula Composer is removed from the normal Takeoff workflow.

Advanced custom logic belongs under company administration and is available only to authorized users when a standard module cannot represent a legitimate company method. It compiles to the same server-authoritative engine, retains immutable versioning, and cannot introduce browser-only calculations.

### Versioning and lineage

Published Company Condition Template versions are immutable. Project Concrete Conditions reference the exact published template version plus the exact Platform Condition Archetype version and store their job overrides/version history.

Canonical physical/commercial lineage becomes:

Takeoff Measurement + Measurement Role  
→ Project Concrete Condition Version  
→ Company Condition Template Version  
→ Platform Condition Archetype Version  
→ Condition Module / Output  
→ Takeoff Output  
→ Estimate Item

Accepted Scope Snapshots preserve those exact references. Later template or Condition changes never rewrite an issued proposal or accepted baseline.

### Holds and commercial separation

Valid geometry saves even when one module lacks an input, price, labor rate, or review decision. Only dependent outputs enter a visible hold.

Production Quantity, Direct Cost, Sell, installed/theoretical quantity, procurement quantity, and reusable inventory demand remain separate.

## Workstation consequence

The flagship desktop layout uses:

- ADR-016 compact top application header and animated global category navigation outside the module workspace;
- resizable contextual pane with Plans, Conditions, and Zones tabs;
- dominant drawing surface with 2D, 3D, and Split modes;
- resizable/dockable Condition Properties window;
- permanent resizable Quantity/Estimate Worksheet.

There is no permanent global desktop left app rail in the accepted target. The left pane inside Takeoff is contextual to the current estimator task.

Condition Properties use concrete-readable tabs and disclosures. Standard work is performed with selections, toggles, dropdowns, typed dimensions, compact grids, and the shared Carez component pack. The UI is governed by ADR-015: dark-first, black/graphite, minimal, dense, high-readability, source-owned through shadcn-compatible React components.

## Migration decision

This is a controlled replacement of the active product model, not destructive data deletion.

1. Preserve existing published assembly/recipe versions, formulas, outputs, estimate links, and accepted commercial references.
2. Add the Condition domain and compatibility mapping additively.
3. Migrate supported standard recipes into Company Condition Templates and Project Concrete Conditions with reconciliation reports.
4. Route new standard Takeoff work through Conditions after verified parity.
5. Make legacy recipe/formula screens read-only where historical inspection is required.
6. Remove retired product routes/components only after no active workflow depends on them.
7. Drop no referenced database record or column. Any later physical schema removal requires dependency proof, backup/recovery planning, and a separate approved migration.

## Consequences

- Daily Takeoff becomes substantially simpler and concrete-native.
- Carez owns a governed library of calculation behavior while each company retains authority over its methods and assumptions.
- The old recipe/formula vocabulary stops being the primary product language.
- Existing calculation, security, and lineage foundations remain reusable during migration.
- Initial implementation must cover a small representative set of concrete families end-to-end before broad catalog expansion.
- Published history remains explainable even after the legacy authoring experience is retired.

## Protected invariants

This decision does not change PostgreSQL/Supabase authority, RLS/tenant isolation, normalized Takeoff geometry, server-authoritative deterministic calculations, immutable published/accepted records, exact Takeoff-to-Estimate lineage, Production Quantity/Direct Cost/Sell separation, or human authority over scope, methods, production, pricing, margin, and approvals.

## Canonical owners

- docs/ARCHITECTURE.md
- docs/modules/takeoff.md
- docs/modules/assembly-resource-engine.md
- docs/modules/estimating.md
- docs/concrete-condition-3d-workstation-target.md
