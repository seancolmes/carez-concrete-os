# Module Spec — Takeoff

Status: active flagship workstation; Condition-first Takeoff + synchronized derived 3D implemented on staging; P0.5E cutover final acceptance tracked in Issue #39

## Purpose

Convert plan geometry into authoritative physical measurements, concrete-specific Condition outputs, and exact estimating lineage from one readable workstation.

## Core workflow

Plans → calibrate/verify scale → select or create Project Concrete Condition → measure primary/independently located secondary roles → derive deterministic geometry facts → resolve module holds → verify in 2D/3D → worksheet review → estimate outputs.

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

The published V1 family set includes Pad/Column Footing, Strip/Wall Footing, Slab on Grade, Thickened Edge, Thickened Slab, Grade Beam, Foundation Wall, Column/Pier, Elevated Slab, Concrete Stairs, Concrete Curb, and Opening/Boxout. Additional company-priority families such as mats and sidewalks remain additive extensions; they do not change the geometry, server-calculation, or human-authority invariants below.

### Condition Properties boundary

The primary property surface docks right in the normal workstation and collapses/restores as a unit. The docked pane uses a stable responsive width rather than horizontal drag-resizing. An explicit future floating-properties mode may support drag/resize/maximize without reintroducing draggable dock boundaries.

The baseline tabs are General, Rebar, Forms, Excavation, Labor, Drawing, and More. A mature family may replace that generic grouping with a concrete-native estimator sequence. Strip / Wall Footing uses Scope, Concrete, Forms, Rebar, Embeds, Excavation, Placement, Finish / cure, Labor, Review, and Drawing. A family hides irrelevant tabs. Common inputs appear first and advanced detail stays behind disclosures.

The property window exposes typed inputs, toggles, dropdowns, governed overrides, source/provenance, holds, and immediate output summaries. It does not expose Formula Composer during normal Takeoff.

Boolean Condition values and module enabled/disabled states use source-owned shadcn-compatible `Switch` controls rather than checkbox UI. `Toggle`/`Toggle Group` remain reserved for pressed/unpressed workstation actions and modes rather than persistent boolean properties.

`Calculated Outputs` uses progressive disclosure as a collapsible section. Its header and concise output/issue/pricing summary remain visible while collapsed; expanding reveals the detailed calculated-output grid without changing any calculation, persistence, or lineage behavior.

Advanced custom logic is administered outside the normal Takeoff workflow by authorized company users and uses the same server-authoritative calculation engine.

### Estimator state truth

For a measurement linked to an active Concrete Condition, the worksheet presents the current Condition as authority rather than a legacy compatibility projection.

- Before the first Condition calculation, calculated worksheet columns remain blank and the row reports **Not calculated**.
- When a saved Condition has unsaved edits, stale calculated values are not presented as current truth; the row reports **Pending recalculation** until the next server calculation.
- A calculated quantity and a complete price are separate states. The UI distinguishes **Ready**, **Qty ready · Price missing**, **Calculation hold**, and **Not included**.
- Direct-cost totals are explicitly partial while active outputs remain unpriced.
- Working-state role counts distinguish `assigned · unsaved` from persisted takeoff/output counts.
- Calculation, scope, production, commercial, and pricing exceptions are presented through one categorized issue surface rather than unrelated counters all called “holds.”

### EDGE-style estimating workbench

The **EDGE-style Condition-first estimator workflow** is the estimating UX contract: the estimator works from named concrete Conditions and concrete-native properties/modules into quantities, labor, pricing readiness, worksheet review, and Estimate lineage without being exposed to formula authoring as the normal workflow. EDGE is a workflow benchmark, not Carez's visual theme or underlying data model.

Concrete Conditions should be workable in the sequence an estimator uses to understand the physical work:

1. Scope / geometry
2. Concrete
3. Forms
4. Reinforcing
5. Embeds
6. Excavation
7. Placement
8. Finish / cure
9. Labor / productivity
10. Pricing / review

The review surface provides compact module summaries so an estimator can see included scope, installed/order quantities, labor, price readiness, and issues without opening every module. Repeatable physical objects such as reinforcing sets, anchors/embeds, and miscellaneous items are shown as intentional instances; required disabled database placeholder rows are not estimator-facing concepts.

For Strip / Wall Footing, Forms uses authoritative run geometry plus estimator-approved form method/system choices. End bulkheads / pour stops use an estimator-controlled count source whose run-endpoint option is derived from the saved run geometry rather than a duplicate EA drawing. When wood form boards are tracked, the estimator selects the physical board and Carez derives installed board LF from formed-edge geometry, footing depth, and board courses; the run LF is never re-entered as a form-material input.

The primary takeoff may be assigned to an existing estimate section from Review. Carez may suggest a likely project section, but the estimator remains authoritative and can accept or override it.

## Measurement roles

Every Project Concrete Condition declares one primary measurement role and may have multiple named secondary roles or deterministic secondary facts.

Examples:

- Slab: primary area; secondary edge form, thickened edge, joints, blockouts, penetrations where independent geometry is required.
- Strip footing: primary centerline/run; derived open-run endpoint candidates for end bulkheads / pour stops; independently located steps, keyways, dowels, and embeds as secondary roles where required.
- Wall: primary wall run; secondary openings, pilasters, construction joints, waterstop.
- Pad/pier: primary count/locations; secondary pedestals, anchor groups, varying-dimension instances.

A secondary object with independent plan location, extent, shape, or quantity authority is a persisted measurement record with its own geometry, unit, sheet/revision, and stable Condition link. A deterministic fact already contained in authoritative primary geometry is derived rather than redrawn as a duplicate measurement. The estimator remains authoritative where a geometric fact does not by itself determine means/methods; for example, a Strip run endpoint is only a candidate bulkhead location until the estimator chooses Run endpoints, Explicit count, or None.

### Area / polygon

Available deterministic facts include gross area, cutout area, net area, gross perimeter, outer perimeter, cutout perimeter, point/section counts, and governed volume facts when required dimensions are resolved.

### Linear / polyline

Available facts include total length, segment lengths, segment count, open/closed state, open-run endpoint count, and governed section/profile facts. Stepped runs may carry segment elevation/profile overrides.

### Count / locations

Available facts include count, location, supported shape/profile, per-instance dimensions/overrides, grouping, and rotation/orientation when relevant.

## Drawing interaction contract

- Count, linear, area, cutout/hole, and governed secondary-role tools.
- Arc geometry, vertex editing, whole-object movement, duplication, clipboard, snapping/ortho, and persistent undo/redo as implementation slices mature.
- Selection synchronizes among plan, 3D, Conditions pane, Properties, worksheet, and estimate rows.
- Right-click/context actions may open properties, duplicate, convert compatible role/type, hide/isolate, or navigate lineage.
- Keyboard focus and shortcuts are predictable and do not conflict with text/dimension inputs.
- Sheet, viewport, zoom/pan, calibration, selection, active tool, and safe window state survive normal docking/view changes.

## 2D / 3D contract

- **2D** is the authoritative drawing/editing view.
- **3D** is a derived concrete verification view in the same drawing viewport; there is no estimator-facing Split mode.
- The active PDF sheet is rendered directly as the spatial reference plane for 3D.
- Condition color, visibility, zone, group, review status, and selection are shared.
- 3D-capable Conditions require governed profile/dimensions plus elevation value and top/bottom/centerline reference.
- Missing 3D inputs create a visible hold; no dimension is invented.
- Initial 3D interaction is read-only verification with orbit/pan/zoom, Home/Top/Focus, isolate/hide, filters, issue list, and click-through to Properties.
- Per-sheet camera state and stable-ID selection persist safely across 2D/3D switching and property recalculation.
- Direct 3D geometry editing is deferred until the same command, validation, persistence, collaboration, undo/redo, and lineage path has parity with 2D.
- The R3F/Three.js renderer consumes derived scene facts only; it does not calculate or persist an independent quantity total.
- The retired SVG pseudo-3D renderer is not part of the active product path.
- If 3D rendering is unavailable, 2D Takeoff and all quantities continue to work.

## Workstation information hierarchy

- Global navigation lives above the workstation in the ADR-016 compact application header + animated category navigation shell; Takeoff does not spend permanent horizontal width on a global app rail.
- Visual priority is plan/geometry → active Condition decision → quantity/hold state.
- The contextual left pane uses Plans, Conditions, and Zones tabs, has a stable expanded width, and collapses to a compact edge rail; it is not horizontally drag-resizable.
- The drawing surface owns the largest area.
- Condition Properties is the one governed right-side work surface; in normal docked mode it uses a stable responsive width and collapses/restores instead of horizontal drag-resizing. Carez does not create a pile of overlapping dialogs.
- The bottom worksheet remains a readable estimator grid with vertical dock resizing, resizable columns, and saved views.
- Shared controls should use the accepted Carez component pack: Condition Tree, Number Field, Toolbar, Resizable Workspace where resizing remains purposeful, Data Grid, Loading States, File Upload, Date/Time where relevant, and the shared motion language.
- Persistent text must identify an object, communicate actionable state/problem, or enable a decision.
- Provenance remains stored but appears through drill-down instead of permanent narration.
- Minimize stacked horizontal chrome and duplicate status/tool state inside the module workspace; the compact global header/category rows remain outside the Takeoff work area.

## Inputs

Plans/sheets/revisions, calibration, measurement geometry/roles, published Company Condition Template version, Platform Condition Archetype version, Project Concrete Condition inputs, confirmed plan facts, estimator-approved method/production/commercial overrides, and drawing presentation settings.

## Outputs

Measurements, role-linked geometry facts, Condition module outputs, 3D projection facts, categorized issues, calculation/pricing readiness, and exact estimate-item lineage.

## Award and execution lineage

- Takeoff remains physical measurement authority; it does not infer what Proposal scope was accepted.
- Awarded physical scope enters execution through an immutable Accepted Scope Snapshot item or approved change-scope item.
- Production Work Units may partition authorized scope through versioned Scope Allocations rather than assuming one whole measurement equals one field work unit.
- Each allocation retains exact accepted measurement/output/Condition version, quantity, unit, and authorization source.

## Legacy migration

The old Scope Recipe, Project Scope Variant, System Block, Formula Composer, and Recipe Editor vocabulary is retired from the primary workflow through the gated migration in ADR-012.

Existing published recipes/assemblies, formula ASTs, outputs, method profiles, estimate links, and accepted references remain readable and immutable. Supported editable pilot work is reconciled through Concrete Conditions; unsupported or historical compatibility records remain untouched. The legacy Assembly History surface is read-only, active recipe/formula authoring is removed from normal Takeoff, and no referenced history is deleted.

The obsolete `carez_create_custom_assembly` RPC is retired additively: application/service execution is revoked, and privileged stale callers receive an explicit unsupported-operation error directing them to Project Concrete Conditions. Its signature remains for deliberate compatibility failure; no historical assembly records are changed and no obsolete folder schema is recreated.

## Current foundation

P0 geometry/editor/atomic recalculation and the Concrete Condition workstation are implemented. Issue #41 synchronized derived 2D/3D verification is closed and accepted. The active 3D path is the client-only R3F/Three.js viewer backed by the exact PDF sheet plane and existing derived scene authority. The SVG pseudo-3D renderer and legacy formula-first authoring path are retired from normal Takeoff. Current P0.5E release/acceptance state is tracked in docs/CURRENT_STATE.md and Issue #39.

## Deferred/next

Multi-select, whole-object pointer movement, clipboard, layers, snapping, revision overlay/migration, thumbnails/batch sheet operations, controlled 3D property editing, optional 3D geometry editing, rebar visualization, and assisted plan intelligence.
