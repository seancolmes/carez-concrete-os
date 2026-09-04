> **Document status:** ACCEPTED DETAILED DESIGN  
> **Canonical owner:** docs/ARCHITECTURE.md, docs/modules/takeoff.md, docs/modules/assembly-resource-engine.md, docs/modules/estimating.md  
> **Use:** Approved product, interaction, migration, and acceptance contract for the Concrete Condition workstation and derived 3D verification.  
> **Supersession:** Replaces the active recipe/formula-first Takeoff contracts in takeoff-estimating-workstation-target.md, custom-assembly-authoring-foundation.md, and builder-means-methods-resource-engine.md. Their durable data, safety, and lineage invariants remain preserved by ADR-012. ADR-016 governs the global top-navigation shell, and ADR-015 + docs/design-system/CAREZ_COMPONENT_PACK.md govern the shared dark shadcn presentation/components.

# Carez Concrete OS — Concrete Condition + 3D Workstation Target

## Product outcome

Carez should feel as direct and readable as a mature concrete estimating workstation while preserving the modern OS-wide digital thread.

The estimator's normal loop is:

Choose or create Condition → confirm visible properties/modules → measure primary and secondary roles → see quantities, labor, cost, and holds → verify in 2D/3D → price and review.

The estimator should not have to build a formula, decode internal namespaces, or leave the plan to understand what a concrete condition contains.

## Reference interpretation

### Estimating EDGE

The useful pattern is the condition-led estimator workflow: named concrete conditions, modular property areas, direct takeoff-to-estimate population, persistent condition organization, and readable screen division. Carez adopts that interaction logic and spaciousness with its own visual system and domain architecture.

Reference reviewed: [The EDGE Estimator concrete workflow](https://youtu.be/6gE_h6iauvg).

Carez does not copy proprietary branding, visual assets, or legacy desktop constraints.

### HAQQ Takeoff

The useful pattern is synchronized concrete 2D/3D verification driven by shape, dimensions, thickness/height, elevation, grouping, and concrete/rebar properties.

Official references:

- [HAQQ unique tools](https://haqqtakeoff.com/unique-tools)
- [HAQQ standard tools](https://haqqtakeoff.com/standard-tools)
- [HAQQ tutorials](https://haqqtakeoff.com/tutorials)

Carez uses this as behavioral evidence for a derived 3D quality-control view. HAQQ's interface is not the Carez visual target, and any advertised future feature is not treated as present capability.

## Experience principles

1. **Concrete language first.** Footings, walls, slabs, pads, piers, rebar, forms, embeds, pumps, finish, labor, and excavation are visible product concepts.
2. **One obvious next action.** Selection and current task determine the controls shown.
3. **Space for the work.** The plan and worksheet receive most of the screen. Text and inputs remain readable at 100% zoom.
4. **Progressive disclosure.** Common inputs are visible; uncommon and advanced inputs live behind tabs/disclosures.
5. **Windows with discipline.** Core panes resize. The Condition window may dock or float. Carez does not become a pile of overlapping dialogs.
6. **Immediate explanation.** Every output can reveal its driver, module, source property, quantity, rate, and hold.
7. **One source of quantity truth.** 2D, 3D, worksheet, and estimate show the same domain quantities.
8. **Keyboard and pointer fluency.** High-frequency commands support predictable shortcuts, focus order, context menus, and undo/redo.
9. **No hidden assumptions.** Derived defaults and explicit overrides are visually different and retain provenance.
10. **Safe continuity.** Sheet, zoom/pan, selection, window layout, filters, and unsaved property state survive normal view/layout changes.
11. **Global navigation stays out of the drawing width.** Carez uses the ADR-016 compact top header/category navigation, while left/right panes inside Takeoff remain contextual to the estimator task.
12. **Shared controls stay shared.** Reuse the accepted Carez Data Grid, Number Field, Condition Tree, Toolbar, Resizable Workspace, File Upload, Loading States, Date/Time and motion patterns rather than creating local equivalents.

## Desktop workstation

~~~mermaid
flowchart TB
  shell["Compact Carez application header"] --> nav["Global category navigation + animated panels"]
  nav --> work["Estimator workspace"]
  work --> left["Resizable context pane: Plans · Conditions · Zones"]
  work --> center["Drawing surface: 2D · 3D · Split"]
  work --> right["Condition Properties: dock · float · resize"]
  center --> bottom["Resizable Quantity / Estimate Worksheet"]
~~~

The global desktop left app rail is not part of the accepted target. The top shell owns global navigation; the Takeoff side panes own only module context.

### Context pane

Top tabs:

- **Plans** — sheets, search, thumbnails/list, scale/revision state.
- **Conditions** — condition tree, type/code/name, color, visibility, status, quick add/duplicate.
- **Zones** — bid zones, alternates, phases, buildings, levels, pour/scope groupings.

The pane is resizable and collapsible. Closing it returns width to the drawing workspace without changing or hiding the global top navigation.

The Conditions tab should use the shared Carez Condition Tree where the interaction matches. Search/filter, visibility, context actions, keyboard selection, drawing color, and hold/status indicators must remain compact and synchronized with plan/Properties/worksheet selection.

### Drawing surface

A compact Carez Toolbar contains measurement tools, selection/editing, snap/ortho, cutouts, arcs, undo/redo, visibility, and view mode.

View switch: **2D**, **3D**, **Split**.

The canvas owns the largest area. Plan geometry remains readable and Takeoff colors remain more salient than UI chrome.

The toolbar uses shared tooltip, icon, overflow, toggle, focus, shortcut, and functional-motion behavior rather than page-local controls.

### Condition Properties window

The window can:

- dock right;
- float over the plan;
- be dragged and resized;
- maximize/focus and restore;
- remember its last safe layout locally;
- collapse inactive sections.

It never opens a separate browser window. Moving or resizing it does not mutate project data.

Recommended top-level tabs:

| Tab | Responsibility |
| --- | --- |
| General | identity, family/profile, primary measurement, dimensions, elevation, concrete |
| Rebar | longitudinal, transverse, mats/WWR, dowels, cages, hooks/lap inputs |
| Forms | formed faces, form system, contact area, reusable/consumed resources |
| Excavation | cut geometry, working room, over-excavation, backfill/export |
| Labor | operations, production basis, baseline, job rate, crew/labor cost |
| Drawing | color, line/fill/opacity, labels, role visibility, 3D appearance |
| More | embeds, slab systems, placement/equipment, finish/cure, miscellaneous |

Tabs may adapt by condition family, but the same property must not appear in multiple competing places.

Within a tab:

- common inputs appear first;
- toggles enable modules;
- dropdowns select governed choices;
- shared Carez Number Field controls handle governed numeric/dimension/spacing/count/rate values where appropriate;
- numeric/architectural dimension inputs declare units;
- computed fields are read-only and visually distinct;
- source badges reveal platform, company, plan, project, or manual provenance;
- missing requirements are inline holds with a direct resolution action.

### Quantity / Estimate Worksheet

The bottom dock is permanently available and vertically resizable through the Carez Resizable Workspace composition. It supports synchronized selection, grouping, saved views, filtering, column resizing, keyboard navigation, and targeted edits.

Core views: Quantities, Resources, Labor, Pricing, Holds, and Recap.

Core columns include Condition, role/measurement, sheet/zone, production quantity/unit, concrete, reinforcing, forms, embeds, equipment, man-hours, unit cost, Direct Cost, Sell, status/hold, and provenance drill-down.

The worksheet uses the shared Carez Data Grid. It is a professional grid, not a card stack.

## Concrete Condition model

### Identity

A Project Concrete Condition has:

- stable ID;
- code and estimator-readable name;
- condition family;
- Company Condition Template version;
- Platform Condition Archetype version;
- color/visibility/group/zone;
- input values and provenance;
- enabled module instances;
- measurement roles;
- status/holds;
- supersession/version history.

### Inputs

| Class | Meaning | Examples |
| --- | --- | --- |
| Plan fact | What the contract documents require | width, depth, wall height, slab thickness, bar callout |
| Method decision | How Carez plans to build it | earth formed, form system, pump, formed sides |
| Production assumption | Labor conversion | MH/LF, MH/SFCA, MH/CY, crew output |
| Commercial assumption | Price or sell decision | quote set, unit cost, rental, markup |
| Drawing presentation | Visual-only | color, opacity, label format |

### Defaults and overrides

Resolution order is explicit:

1. authorized project/Condition override;
2. approved plan fact;
3. Company Condition Template default;
4. Platform Archetype default only where the value is genuinely universal/safe;
5. unresolved hold.

Safety-, scope-, and price-critical assumptions cannot be silently filled from a generic platform default.

### Module output contract

Every output stores the Condition/version, measurement/role drivers, module and output key, production quantity/unit, installed/procurement/inventory classification, input/rate provenance, hold/review state, and exact estimate-item lineage.

## Initial condition families

P0.5 proves the model with three complete families before expanding.

### Pad / column footing — EA

Inputs: plan dimensions, thickness/depth, elevation/reference, shape, concrete class/PSI if used, formed faces, reinforcing pattern, pedestal/anchor options, labor/method.

Outputs may include concrete CY, form contact area/material, rebar LB/LF/EA, anchor/embedded items, excavation/backfill, placement/equipment, and labor.

### Strip / wall footing — LF

Inputs: section width/depth, elevation/reference, formed sides, continuous bars, transverse bars/dowels, steps, placement and production assumptions.

Outputs may include concrete CY, form contact area/material, explicit stakes/hardware, reinforcing, keyway/waterstop, excavation/backfill, pump/equipment, and labor.

### Slab on grade — SF

Inputs: thickness, elevation/reference, cutouts, edge condition, reinforcing system, vapor barrier, granular base, joints, finish/cure, pump/placement, production assumptions.

Outputs may include concrete CY, edge/bulkhead forms, rebar/WWR/fiber, vapor barrier, base, joints, curing/protection, equipment, and labor.

After end-to-end acceptance, add walls, grade beams, mats, piers/columns, sidewalks/curbs, and other company-priority conditions.

## Reinforcing module

The reinforcing module supports repeated governed sets rather than one generic rebar allowance:

- continuous bars;
- transverse bars;
- vertical/horizontal wall steel;
- mats/grids each way and each face/layer;
- dowels/starters;
- ties/stirrups;
- cages;
- WWR/WWF;
- fiber;
- custom scheduled reinforcing.

Inputs can include bar size/unit weight, spacing/count, cover, stock length, lap policy, hooks/shapes, layers/faces, waste, and placement labor. Carez calculates quantities for estimator review; it does not invent structural design.

Copy/paste or duplicate of a reinforcing set should work across compatible Conditions while preserving explicit source and review state.

## Anchors, embeds, blockouts, and counts

Anchor bolts and similar items are first-class count-driven module outputs, not miscellaneous notes.

Supported patterns include:

- direct EA count;
- spacing along a governed run;
- grouped anchor templates at count locations;
- dowels/embeds associated with a secondary role;
- blockouts/penetrations as subtractive geometry plus count/resource outputs.

The worksheet and estimate preserve the exact count source.

## Derived 3D verification

### Shared identity

Each visible 3D object carries the corresponding Condition, measurement, role, sheet/revision, and zone IDs. The renderer receives derived dimensional facts; it does not calculate commercial outputs.

### Interaction

Phase A includes orbit, pan, zoom, reset/home, synchronized selection, hide/show/isolate, color by Condition or review state, section/level filtering, an issue list with jump-to-source, optional dimension/elevation labels, and Split-view camera/selection continuity.

### Review checks

The first useful checks are missing 3D inputs, duplicate/overlapping placements, disconnected wall/footing runs, wrong or inconsistent top/bottom elevations, missing or incorrect holes/openings, stepped-run discontinuities, improbable offsets/floating objects, and revision changes requiring review.

No flag changes scope automatically.

### Performance and fallback

Mesh derivation is incremental and keyed by stable version/hash. Large sheets/projects may load by visible zone/level. If WebGL/rendering is unavailable, 2D Takeoff and all quantities continue to function; 3D reports an explicit unavailable state using the shared Carez Loading/Unavailable patterns.

## Migration from the old framework

“Remove the old framework” means remove it from active product vocabulary and normal workflow after parity—not delete referenced history.

| Legacy active concept | New active concept | Migration treatment |
| --- | --- | --- |
| Concrete Scope Recipe | Company Condition Template | map versioned company defaults/outputs |
| Project Scope Variant / method profile | Project Concrete Condition version | map job facts, method, production, commercial inputs |
| System Block | Condition Module instance | map supported standard behavior |
| Assembly component | Module output definition | preserve stable output lineage |
| Formula Composer in Takeoff | Typed module inputs | remove from daily workstation after parity |
| Formula AST | Compatibility/advanced logic kernel | preserve server-side; administration only |
| Recipe Editor popup | Condition Properties window | replace normal entry/edit experience |
| Assembly Library | Condition Templates | migrate library organization and versions |

Migration gates:

1. inventory current published recipes and references;
2. define additive Condition schema and compatibility IDs;
3. implement archetype/module calculation contracts with tests;
4. migrate the three pilot condition families;
5. reconcile old/new output quantities, holds, prices, and estimate lineage;
6. browser-verify creation, editing, undo/redo, refresh, deletion, cross-sheet scoping, and worksheet totals;
7. route new standard work through Conditions;
8. make referenced legacy artifacts read-only;
9. remove legacy UI/routes only after dependency checks prove no active use;
10. consider physical schema retirement only in a separately approved, recoverable migration.

There is no big-bang destructive database rewrite.

## Implementation slices

### P0.5A — Domain and compatibility foundation

- additive Condition/archetype/template/module/role schema;
- versioning, RLS, provenance, holds;
- adapters to existing output/estimate lineage;
- migration inventory/reconciliation tooling.

### P0.5B — EDGE-inspired workstation shell

- ADR-016 compact application header + global animated category navigation outside the module work area;
- Plans/Conditions/Zones contextual tabs using shared Condition Tree/filter patterns;
- dockable/floatable/resizable Condition Properties through the Carez Resizable Workspace;
- 2D, 3D, and Split switch;
- shared Carez Toolbar and Number Field controls;
- permanent worksheet using the Carez Data Grid;
- saved local panel layout with safe reset;
- no permanent global desktop left rail.

### P0.5C — Three pilot families

- Pad/column footing EA;
- Strip/wall footing LF;
- Slab on grade SF with cutouts;
- concrete/forms/rebar/anchors-or-slab-system/labor outputs.

### P0.5D — Derived 3D Phase A

- derived solids and synchronized selection;
- visibility/color/zone/level controls;
- missing-input and geometric QC issues;
- performance/fallback verification.

### P0.5E — Migration and legacy UI retirement

- migrate/reconcile supported recipes and project variants;
- switch new-work entry paths;
- make remaining historical recipe inspection read-only;
- remove obsolete active UI components/routes after verified dependency checks.

### P1 — Commercial estimating continuation

- pricing provenance/quote sets;
- labor/production review;
- recap/reports;
- estimate review and proposal issuance;
- Accepted Scope Snapshot handoff.

## Acceptance criteria

The direction is accepted only when an authenticated estimator can:

1. create/select a named concrete Condition without encountering a formula editor;
2. measure its primary role and at least one secondary role;
3. see immediate deterministic module outputs and explain each driver;
4. configure rebar, forms, anchors/embeds, labor, and applicable modules through readable controls;
5. save valid geometry while isolated module inputs remain on hold;
6. edit governed properties without redrawing and receive atomic output/estimate reconciliation;
7. use 2D, 3D, and Split with identical selection and quantity totals;
8. detect and resolve representative elevation, overlap/gap, and cutout issues;
9. undo/redo, refresh, delete, and work across sheets without orphan/duplicate outputs;
10. preserve every historical published/accepted reference through migration;
11. complete normal Takeoff with the old recipe/formula UI absent from the primary workflow;
12. work comfortably at 100% desktop zoom with readable fields, calm spacing, and predictable docking/resizing;
13. use the top global header/category navigation without losing drawing width, while contextual Takeoff panes remain distinct from global navigation;
14. use shared Carez Data Grid, Number Field, Condition Tree, Toolbar, Resizable Workspace, Loading, File Upload and motion behavior instead of duplicate local design primitives where applicable.

## Non-goals for P0.5

- freeform BIM authoring;
- automatic structural design;
- fabrication-grade rebar detailing;
- AI-generated scope without estimator approval;
- destructive deletion of published history;
- simultaneous domain redesign of unrelated Carez modules.
