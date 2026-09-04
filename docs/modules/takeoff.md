# Module Spec — Takeoff

Status: active flagship workstation; Concrete Condition migration approved, not yet implementation-verified

## Purpose

Convert plan geometry into authoritative physical measurements, concrete-specific Condition outputs, and exact estimating lineage from one readable workstation.

## Core workflow

Plans → calibrate/verify scale → select or create Project Concrete Condition → measure primary/secondary roles → resolve module holds → verify in 2D/3D → worksheet review → estimate outputs.

## Invariants

- PDF is visual reference; stable page-coordinate vector geometry is authoritative.
- Deterministic calculations and persisted geometry.
- Persistent undo/redo.
- Cutouts/holes, arcs, editing, duplication, calibration, and worksheet operations preserve lineage.
- Valid geometry may save when downstream inputs are missing; only dependent outputs become explicit holds.
- Permanent resizable Quantity/Estimate Worksheet on desktop.
- Worksheet column boundaries are independently resizable; useful widths may persist locally.
- The primary daily estimating object is a Concrete Condition, not a formula or generic recipe.
- Standard Condition use does not require a user to see or write a formula.
- Published Company Condition Template versions and accepted historical references remain immutable.
- The Inspector/Condition Properties surface remains contextual; advanced company logic does not turn it into a programming screen.
- 2D geometry is authoritative. 3D is a deterministic, synchronized verification projection of the same records.
- Accepted Scope Snapshots preserve the exact Takeoff measurement, role, Condition/template/archetype versions, outputs, and commercial sources used by the awarded Proposal revision.

## Concrete Condition workflow

### Condition selection

The estimator chooses a concrete family/template or an existing Project Concrete Condition. The Conditions pane supports:

- search, type/code/name, grouping, visibility, color, status, and quick duplicate;
- clear separation of company template and project instance;
- recent/favorite/company-standard filters when supported;
- create/edit without leaving the Takeoff route.

Initial families are Pad/Column Footing, Strip/Wall Footing, and Slab on Grade. Later families include walls, grade beams, mats, piers/columns, sidewalks/curbs, and other company-priority work.

### Condition Properties boundary

The primary property window can dock right, float, drag, resize, maximize/focus, restore, and remember a safe local layout.

Recommended tabs are General, Rebar, Forms, Excavation, Labor, Drawing, and More. A family may hide irrelevant tabs. Common inputs appear first and advanced detail stays behind disclosures.

The property window exposes typed inputs, toggles, dropdowns, governed overrides, source/provenance, holds, and immediate output summaries. It does not expose Formula Composer during normal Takeoff.

Advanced custom logic is administered outside the normal Takeoff workflow by authorized company users and uses the same server-authoritative calculation engine.

## Measurement roles

Every Project Concrete Condition declares one primary measurement role and may have multiple named secondary roles.

Examples:

- Slab: primary area; secondary edge form, thickened edge, joints, blockouts, penetrations.
- Strip footing: primary centerline/run; secondary steps, end forms, keyway, dowels, embeds.
- Wall: primary wall run; secondary openings, pilasters, construction joints, waterstop.
- Pad/pier: primary count/locations; secondary pedestals, anchor groups, varying-dimension instances.

Each role is a persisted measurement record with its own geometry, unit, sheet/revision, and stable Condition link. Secondary measurements are not hidden manual values.

### Area / polygon

Available deterministic facts include gross area, cutout area, net area, gross perimeter, outer perimeter, cutout perimeter, point/section counts, and governed volume facts when required dimensions are resolved.

### Linear / polyline

Available facts include total length, segment lengths, segment count, open/closed state, and governed section/profile facts. Stepped runs may carry segment elevation/profile overrides.

### Count / locations

Available facts include count, location, supported shape/profile, per-instance dimensions/overrides, grouping, and rotation/orientation when relevant.

## Drawing interaction contract

- Count, linear, area, cutout/hole, and governed secondary-role tools.
- Arc geometry, vertex editing, whole-object movement, duplication, clipboard, snapping/ortho, and persistent undo/redo as implementation slices mature.
- Selection synchronizes among plan, 3D, Conditions pane, Properties, worksheet, and estimate rows.
- Right-click/context actions may open properties, duplicate, convert compatible role/type, hide/isolate, or navigate lineage.
- Keyboard focus and shortcuts are predictable and do not conflict with text/dimension inputs.
- Sheet, viewport, zoom/pan, calibration, selection, active tool, and safe window state survive normal docking/view changes.

## 2D / 3D / Split contract

- **2D** is the authoritative drawing/editing view.
- **3D** is a derived concrete verification view.
- **Split** presents synchronized views of the same selected records.
- Condition color, visibility, zone, group, review status, and selection are shared.
- 3D-capable Conditions require governed profile/dimensions plus elevation value and top/bottom/centerline reference.
- Missing 3D inputs create a visible hold; no dimension is invented.
- Initial 3D interaction is read-only verification with orbit/pan/zoom, isolate/hide, filters, issue list, and click-through to Properties.
- Direct 3D geometry editing is deferred until the same command, validation, persistence, collaboration, undo/redo, and lineage path has parity with 2D.
- The renderer does not calculate or persist an independent quantity total.
- If 3D rendering is unavailable, 2D Takeoff and all quantities continue to work.

## Workstation information hierarchy

- Global navigation lives above the workstation in the ADR-016 compact application header + animated category navigation shell; Takeoff does not spend permanent horizontal width on a global app rail.
- Visual priority is plan/geometry → active Condition decision → quantity/hold state.
- The resizable contextual left pane uses Plans, Conditions, and Zones tabs and is module-specific rather than global navigation.
- The drawing surface owns the largest area.
- Condition Properties is the one governed dockable/floatable work window; Carez does not create a pile of overlapping dialogs.
- The bottom worksheet remains a readable estimator grid with resizable columns and saved views.
- Shared controls should use the accepted Carez component pack: Condition Tree, Number Field, Toolbar, Resizable Workspace, Data Grid, Loading States, File Upload, Date/Time where relevant, and the shared motion language.
- Persistent text must identify an object, communicate actionable state/problem, or enable a decision.
- Provenance remains stored but appears through drill-down instead of permanent narration.
- Minimize stacked horizontal chrome and duplicate status/tool state inside the module workspace; the compact global header/category rows remain outside the Takeoff work area.

## Inputs

Plans/sheets/revisions, calibration, measurement geometry/roles, published Company Condition Template version, Platform Condition Archetype version, Project Concrete Condition inputs, confirmed plan facts, estimator-approved method/production/commercial overrides, and drawing presentation settings.

## Outputs

Measurements, role-linked geometry facts, Condition module outputs, 3D projection facts, holds/review issues, and exact estimate-item lineage.

## Award and execution lineage

- Takeoff remains physical measurement authority; it does not infer what Proposal scope was accepted.
- Awarded physical scope enters execution through an immutable Accepted Scope Snapshot item or approved change-scope item.
- Production Work Units may partition authorized scope through versioned Scope Allocations rather than assuming one whole measurement equals one field work unit.
- Each allocation retains exact accepted measurement/output/Condition version, quantity, unit, and authorization source.

## Legacy migration

The old Scope Recipe, Project Scope Variant, System Block, Formula Composer, and Recipe Editor vocabulary is retired from the primary workflow through the gated migration in ADR-012.

Existing published recipes/assemblies, formula ASTs, outputs, method profiles, estimate links, and accepted references remain readable and immutable. They may back compatibility adapters until supported records are reconciled to Conditions. Legacy screens become read-only before removal; no referenced history is deleted.

## Current foundation

P0 geometry/editor/atomic recalculation is implemented. The approved Concrete Condition, derived 3D, dark shadcn, top-navigation shell, and shared component-pack contracts describe architecture targets that still require implementation/browser verification where not already present. Current verified implementation state remains exclusively in docs/CURRENT_STATE.md.

## Deferred/next

Multi-select, whole-object pointer movement, clipboard, layers, snapping, revision overlay/migration, thumbnails/batch sheet operations, controlled 3D property editing, optional 3D geometry editing, rebar visualization, and assisted plan intelligence.
