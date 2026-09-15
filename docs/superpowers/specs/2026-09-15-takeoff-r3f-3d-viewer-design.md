# Takeoff R3F 3D Viewer Design

**Date:** 2026-09-15

**Issue:** #41 — P0.5D — Unified synchronized 2D/3D Takeoff workstation

**Status:** Approved design, pending written-spec review before implementation planning

## Goal

Replace the current SVG pseudo-3D presentation with a real React Three Fiber / Three.js construction-model viewer that renders the active PDF sheet as the spatial reference plane and displays derived concrete solids from existing authoritative Carez Takeoff geometry.

The estimator experience is simple: click **3D** and see the current Takeoff represented spatially over the same plan sheet, using the same colors, elevations, dimensions, and stable domain identities already owned by Carez.

## Non-goals

This design does not introduce:

- a second 3D model database;
- 3D-derived quantity authority;
- freeform BIM modeling;
- photorealistic rendering;
- fabrication-grade reinforcing models;
- cross-sheet building stacking without explicit registration/datum support;
- direct 3D geometry editing in the first replacement milestone;
- per-Condition “make this 3D” setup;
- a Split viewport requirement.

Direct 3D geometry editing/creation remains a follow-on after the replacement viewer is accepted.

## Governing invariants

1. Persisted normalized 2D/vector Takeoff geometry remains the stored geometry and quantity authority.
2. Server/domain quantity outputs remain authoritative; rendered meshes never recalculate commercial or production quantities.
3. 2D and 3D are synchronized views of the same Takeoff element, identified by stable domain IDs.
4. The PDF/takeoff coordinate mapping is shared between 2D and 3D.
5. Unsupported or incomplete 3D projection may hold one element but must not block valid 2D Takeoff work or valid sibling 3D solids.
6. Human authority over scope, Conditions, means/methods, reinforcing interpretation, rates, pricing, margin, budgets, and approvals remains unchanged.
7. The implementation must preserve the repo contract in `CODEX.md`, especially its rule that persisted page-coordinate 2D/vector geometry is Takeoff quantity authority and derived 3D is verification only.

## 1. Renderer architecture

The existing Carez Takeoff model remains upstream authority:

```text
Authoritative Carez Takeoff
│
├── PDF sheet
├── normalized measurement geometry
├── calibration
├── Condition properties
├── color
├── elevation/reference
├── width/depth/thickness/profile
└── server/domain quantities
          │
          ▼
buildDerived3DScene()
          │
          ▼
Derived3DScene
├── sheetPlanes
├── solids
├── issues
└── sourceQuantities
          │
          ▼
NEW R3F rendering adapter
          │
          ▼
React Three Fiber / Three.js
└── Orthographic construction viewer
```

`buildDerived3DScene()` remains the physical projection authority. It already reads persisted measurements, applies calibration, derives supported slab/footing/pad shapes, carries stable IDs, and copies source quantity references without making mesh-derived quantities authoritative.

The replacement is therefore primarily a rendering/presentation-layer change, not a rewrite of Carez quantity or Condition logic.

### View model

The center Takeoff viewport exposes only:

```text
[ 2D ] [ 3D ]
```

- **2D** — existing PDF.js drawing surface and Takeoff overlay.
- **3D** — R3F Canvas with the active PDF as a physical plan plane plus derived concrete solids.

Sheets, Condition Properties, and the Quantity Worksheet remain in their existing workstation locations.

No estimator-facing Split mode is part of the target.

## 2. Exact 2D/3D synchronization

The same stable domain identifiers drive both views:

```text
measurementId
conditionVersionId
sheetId
```

### 2D -> 3D

Selecting a 2D measurement must:

1. set the authoritative active measurement;
2. select the corresponding Condition;
3. focus the same record in Properties/worksheet;
4. highlight the exact 3D mesh when 3D is opened.

### 3D -> 2D

Clicking a 3D object uses Three.js raycasting and the mesh’s stable `measurementId` to select the same authoritative Takeoff measurement.

No selection matching by color, label, order, or fuzzy geometry is permitted.

### Sheet behavior

The active sheet is the scene boundary.

If A4 is active:

- 2D shows A4;
- 3D shows A4 as the plan plane;
- only A4 Takeoff solids render.

Changing to A5 swaps both the PDF and the 3D scene to A5 without jumping back because of stale selection.

If the current selection is not valid on the new sheet, selection clears cleanly.

### Mode switching

Switching 2D/3D preserves:

- active sheet;
- selected measurement/Condition;
- Properties context;
- worksheet state;
- unsaved/saved calculation state;
- authoritative quantities.

Camera memory is per sheet and is sanitized when restored.

### Property editing

In the first accepted R3F replacement, Properties remains the editing surface.

The estimator may select an element in either 2D or 3D, then edit governed properties such as elevation/reference, width, depth/thickness/height, profile/type, and other supported Condition inputs through the existing Save & recalculate path.

After recalculation the 3D mesh regenerates from the same source record. An elevation change must move the mesh relative to the PDF datum without auto-refitting the camera and hiding the movement.

Direct drag/vertex editing in 3D is deferred.

## 3. Visual target — Style A construction model

The approved visual target is a professional construction takeoff model, not a photorealistic BIM rendering and not translucent markup.

### Scene composition

```text
R3F Canvas
│
├── Orthographic camera
├── OrbitControls
├── restrained ambient/hemisphere light
├── one soft directional key light
├── active PDF plan plane
├── derived Takeoff meshes
├── crisp mesh edges
├── selection/hover treatment
└── subtle contact shadow
```

No skybox, terrain, decorative grid, dramatic environment map, textured concrete, or changing sun position.

### PDF plan plane

The PDF is the visual anchor and must remain readable at a normal oblique 3D angle.

Requirements:

- render the active PDF page directly through PDF.js to a dedicated texture;
- do not scrape/capture the existing visible 2D canvas;
- target roughly 2x displayed resolution;
- cap the initial longest texture dimension at 4096 px;
- use correct color-space handling and high-quality texture filtering;
- render on an opaque white rectangular plane;
- keep page proportions exact;
- add a thin neutral sheet edge and restrained shadow;
- use the same page size/calibration mapping as authoritative 2D Takeoff geometry.

The PDF must not stretch, shear, or become a faded screenshot.

### Concrete meshes

#### Slab / area-based concrete

```text
2D polygon + holes
+ thickness
+ elevation/reference
-> extruded polygon mesh
```

The mesh preserves the authoritative plan footprint and holes. Top/bottom elevations come only from governed inputs.

#### Strip / wall footing

```text
2D measured run
+ governed width/depth/profile
+ elevation/reference
-> continuous footing mesh
```

The mesh follows the saved run and existing governed footprint/profile logic. Corners should read as a continuous physical footing rather than disconnected segment boxes.

No guessed steps, slopes, returns, offsets, or transitions.

#### Pad / column footing

The existing governed location plus dimensions/orientation produces a box/prism at the authoritative plan coordinate.

### Materials and edges

Each mesh uses its existing Condition color.

- top surfaces: bright/readable near the Condition color;
- side surfaces: naturally darker from lighting;
- edges: thin, dark, crisp;
- selected: stronger edge plus restrained brightness/emissive lift;
- hovered: temporary edge emphasis only;
- normal geometry: opaque.

Selected geometry must be obvious within one glance without glow/pulsing effects.

### Camera

Use an orthographic construction/CAD-style camera.

Default Home view:

- approximately 45 degrees yaw;
- approximately 35–40 degrees elevation above the plan;
- target the center of the active PDF sheet;
- frame the complete sheet with comfortable margin.

The PDF sheet, not concrete extents, controls initial framing.

Required interactions:

- orbit;
- pan;
- zoom;
- Home/Reset;
- Top view;
- Focus Selected.

Orbit stays above the plan. Horizontal rotation may be unrestricted, but vertical orbit stops before a near-edge-on unusable view and can never flip beneath the PDF plane.

Changing a Condition elevation must not auto-fit or auto-center the camera.

### Camera persistence

Persist only per-sheet camera rotation, zoom, and target/pan state needed to restore a useful view.

On restore:

- clamp to valid construction-view limits;
- reject/normalize states that put the viewer below the plan;
- prevent restoring a state where the sheet is effectively lost.

## 4. Component boundaries

The current `TakeoffDerived3DView.tsx` combines camera math, PDF capture, manual projection, SVG face generation, controls, selection, filters, and issues. The replacement must split these responsibilities.

Recommended structure:

```text
components/takeoff/3d/
├── Takeoff3DViewport.tsx
├── Takeoff3DScene.tsx
├── Takeoff3DPlan.tsx
├── Takeoff3DSolid.tsx
├── Takeoff3DControls.tsx
├── Takeoff3DToolbar.tsx
├── Takeoff3DErrorBoundary.tsx
└── useTakeoff3DCamera.ts

lib/takeoff/3d/
├── planTexture.ts
├── meshGeometry.ts
├── coordinates.ts
└── selection.ts
```

### Component responsibilities

`Takeoff3DViewport.tsx`

- React-facing integration entry point;
- accepts `scene`, `activeSheetId`, `selectedMeasurementId`, view state, and selection callback;
- owns no quantity calculations.

`Takeoff3DScene.tsx`

- creates Canvas, orthographic camera, lighting, plan, meshes, and camera controls;
- owns no commercial/quantity logic.

`Takeoff3DPlan.tsx`

- loads/renders only the active PDF page through PDF.js;
- creates/disposes the Three.js texture and plan plane;
- never scrapes the 2D canvas.

`Takeoff3DSolid.tsx`

- converts a single existing `Derived3DSolid` to a renderable mesh through `meshGeometry.ts`;
- handles Condition color, top/side presentation, edges, selection, hover, and click-to-select;
- does not choose physical dimensions.

`meshGeometry.ts`

- pure conversion from existing `Derived3DShape` to `THREE.BufferGeometry`;
- no React, no state, no quantity logic;
- unit-testable in Node where practical.

`Takeoff3DControls.tsx` / `useTakeoff3DCamera.ts`

- own OrbitControls, Home, Top, Focus, limits, and per-sheet camera memory;
- do not own Takeoff selection or business state.

## 5. Dependencies

The approved renderer stack is limited to:

```text
three
@react-three/fiber
@react-three/drei
```

No second UI framework, BIM framework, CAD authoring package, or alternate component system is allowed.

### CODEX.md dependency-rule note

`CODEX.md` currently contains a blanket “no new dependency” execution rule. This approved design explicitly requires the three packages above, so implementation is blocked until the execution plan includes a narrow repository-governance adjustment allowing task-required dependencies that are explicitly approved by the spec/prompt. Do not silently violate `CODEX.md`.

The governance adjustment must remain narrow: no unrelated dependency additions are authorized.

## 6. Integration with existing workstation state

`IntegratedTakeoffConditionWorkspace` already owns the relevant shared state, including active sheet, selected measurement/Condition, view mode, derived scene, and current Condition workflow context.

The R3F viewer plugs into that state rather than introducing another global store.

Conceptually:

```tsx
viewMode === '2d'
  ? <TakeoffDrawingWorkspace ... />
  : <Takeoff3DViewport
      scene={derivedScene}
      activeSheetId={activeSheetId}
      selectedMeasurementId={selectedMeasurementId}
      onSelectMeasurement={requestMeasurementSelection}
    />
```

Exact prop names may follow current repo conventions, but the boundary is fixed: the viewer consumes existing domain state and emits stable-ID selection events.

## 7. Performance constraints

Initial performance target:

- one active PDF texture at a time;
- active-sheet Takeoff meshes only;
- scene geometry rebuild only when relevant geometry/physical properties change;
- selection changes should not rebuild geometry;
- hover should not rebuild scene geometry;
- camera motion must avoid React state churn per frame;
- dispose replaced Three.js textures/geometries/materials correctly;
- do not preload 3D scenes for every PDF sheet.

A4 renders when A4 is active; A5 replaces it when A5 becomes active.

## 8. Error behavior

3D must never block normal 2D Takeoff work.

If one element lacks supported physical inputs:

- valid siblings still render;
- the affected element is identified clearly;
- Carez states the exact missing/unsupported reason;
- `Resolve input` focuses the existing Properties field when applicable;
- 2D geometry and worksheet remain available.

If the renderer itself fails:

> 3D unavailable — 2D Takeoff and quantities remain available.

No Takeoff data is changed or lost.

## 9. Migration strategy

### Milestone A — R3F foundation

Build in an isolated Codex worktree from current `staging`.

Deliver only:

- R3F Canvas;
- orthographic camera;
- PDF.js texture plane;
- Home/Top/orbit/pan/zoom;
- clean A4 rendering.

No concrete meshes yet.

Acceptance: the PDF construction viewer alone looks professional and remains readable at the default oblique angle.

### Milestone B — physical meshes

Add:

- slab/prism rendering;
- strip/wall footing rendering;
- pad footing rendering;
- Style A materials, lighting, edges, selection visuals.

Acceptance: geometry registers exactly over the authoritative 2D locations and reads as physical concrete volume.

### Milestone C — synchronization

Add/finish:

- 2D -> 3D selection;
- 3D -> 2D selection;
- active-sheet synchronization;
- property-change mesh regeneration;
- per-sheet camera memory;
- unsupported-element disclosure without blocking valid siblings.

Acceptance: the full Issue #41 Parts 1–2 browser workflow passes on a real multi-element sheet.

### Milestone D — legacy retirement

Only after A–C pass browser acceptance:

- delete the SVG pseudo-3D renderer and its CSS;
- remove the temporary internal renderer gate;
- remove renderer-only obsolete helpers/tests;
- run final regression and update Issue #41.

The SVG renderer remains a fallback until R3F has clearly passed the visual and synchronization gates.

## 10. Temporary renderer gate

During migration only, support an internal developer renderer choice such as:

```text
legacy-svg
r3f
```

This must not become an estimator-facing product option.

Purpose:

- side-by-side regression comparison;
- safe rollback;
- isolate browser defects during migration.

Remove the gate in Milestone D.

## 11. Automated testing

### Pure geometry tests

Test without React/WebGL where practical:

- normalized PDF coordinate -> same calibrated plan coordinate used by 2D;
- slab polygon/holes -> correct vertices;
- 12 in thickness -> exactly 1.0 ft extrusion;
- governed elevation/reference -> correct top/bottom Y;
- footing run + width/profile -> correct continuous footprint/extrusion;
- pad location/dimensions/orientation -> correct box transform.

### Identity/synchronization tests

Verify stable ID mapping:

- mesh A selects measurement A;
- mesh B selects measurement B;
- no color/name/index matching;
- sheet change updates scene scope;
- invalid stale selection clears cleanly;
- source quantity references are not mutated by renderer actions.

### Camera tests

Test pure constraint utilities where practical:

- Home camera stays above plan;
- minimum pitch prevents unusable edge-on view;
- camera cannot flip below plan;
- Top is exact plan view;
- Home frames full sheet;
- elevation/property change does not trigger automatic camera refit.

### Existing repo validation

At each milestone run targeted tests plus `pnpm typecheck`. Before acceptance run `pnpm check` because this is a broad/high-risk renderer replacement.

Source/build success is not browser acceptance.

## 12. Browser/visual acceptance

The R3F viewer does not pass because it compiles.

Use a real authenticated staging Takeoff sheet containing at least two supported elements, different Condition colors, and different elevations.

Capture/inspect at minimum:

- 2D active sheet;
- 3D Home;
- 3D rotated;
- selected slab;
- selected footing;
- changed elevation with fixed camera;
- 3D -> 2D return state.

Hard rejection criteria:

- blurry or unreadable PDF;
- stretched/sheared plan;
- concrete misregistered from its 2D footprint/run;
- translucent-markup appearance;
- camera can get lost, flip under, or collapse edge-on;
- ambiguous selection;
- property/elevation change silently refits the camera;
- quantities change because 3D rendered or was selected;
- scene looks like floating SVG polygons rather than a construction takeoff model.

Passing visual criteria:

- primary PDF notes/dimensions remain visibly readable at Home angle;
- concrete sits exactly over the source 2D Takeoff;
- Condition colors remain recognizable;
- thickness/depth reads immediately from shading/edges;
- elevation differences are visible relative to the PDF plane;
- selection is obvious within one glance;
- navigation behaves like a restrained construction/CAD viewer;
- overall result matches the approved Style A intent: clean white plan surface plus crisp colored concrete volumes.

## 13. Issue #41 acceptance workflow

A browser pass must demonstrate:

1. Open a real sheet in 2D.
2. Select one Takeoff element.
3. Switch to 3D; the same element is selected.
4. All other supported Takeoff elements on the active sheet render automatically.
5. Click a different object in 3D; exact 2D/Properties/worksheet selection changes to that measurement.
6. Return to 2D; exact source measurement remains selected.
7. Change sheets; both views follow the new sheet without stale-selection jump-back.
8. Change a governed elevation/reference or dimension and Save & recalculate.
9. Confirm the corresponding mesh regenerates while authoritative 2D plan geometry and server/domain quantity authority remain intact.
10. Confirm camera does not automatically recenter after an elevation change.
11. Confirm unsupported/incomplete elements are disclosed without blocking valid siblings.
12. Confirm switching views or selecting 3D objects does not change worksheet quantities.

## 14. Execution workflow

Implementation should be handed to Codex in an isolated worktree and executed milestone-by-milestone.

Recommended model/process:

- GPT-6 Astra for the visual/graphics-heavy implementation and browser judgment;
- Superpowers `using-git-worktrees` before implementation;
- Superpowers `writing-plans` after this written spec is approved;
- Superpowers `test-driven-development` for renderer utilities/behavior changes;
- Superpowers `systematic-debugging` for coordinate/camera/rendering defects;
- Superpowers `verification-before-completion` before any completion claim;
- code review before merge/promotion.

Codex must follow current `CODEX.md` read-scope discipline: start from the implementation-plan files and direct dependencies rather than broad repository scans.

## 15. Deferred follow-on

After Milestones A–D are accepted, a separate design may add direct 3D authoring/editing that writes through the same authoritative Carez Takeoff commands.

That follow-on may include:

- move existing supported geometry;
- edit endpoints/vertices/locations;
- create a supported Takeoff element from a 3D work plane;
- write back the same normalized measurement geometry 2D would write;
- use the normal recalculation/history/versioning/RLS/lineage path.

It must not turn the viewer into freeform BIM modeling or introduce mesh-derived quantity authority.

## Decision summary

The approved architectural rule is:

> **Carez owns the Takeoff. Three.js only renders it.**

The new renderer may display, select, orbit around, and later provide an editing interface to Carez Takeoff elements, but it never becomes an independent source of geometry quantity truth.
