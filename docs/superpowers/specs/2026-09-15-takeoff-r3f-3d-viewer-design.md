# Takeoff R3F 3D Viewer Design

**Date:** 2026-09-15  
**Issue:** #41 — P0.5D — Unified synchronized 2D/3D Takeoff workstation  
**Status:** Approved architecture; pending written-spec review before implementation planning

## Goal

Replace the current SVG pseudo-3D presentation with a real React Three Fiber / Three.js construction-model viewer. Clicking **3D** must show the active PDF sheet as the spatial reference plane with supported Carez Takeoff elements rendered as physical concrete volumes using the same geometry, colors, elevations, dimensions, and stable IDs already owned by Carez.

## Non-goals

No second 3D database, mesh-derived quantity authority, freeform BIM modeling, photorealistic rendering, cross-sheet stacking without registration, per-Condition “make this 3D” workflow, estimator-facing Split view, or direct 3D geometry editing in this replacement.

## Governing invariants

1. Persisted normalized 2D/vector Takeoff geometry remains stored geometry and quantity authority.
2. Server/domain outputs remain quantity, cost, and pricing authority; Three.js never calculates authoritative quantities.
3. 2D and 3D use the same `measurementId`, `conditionVersionId`, and `sheetId`.
4. PDF and derived solids share one calibrated plan coordinate system.
5. One unsupported/incomplete projection must not block valid sibling solids or normal 2D Takeoff work.
6. Current replacement is visualization/selection only. Direct 3D geometry editing requires a separate design/governance decision because current `CODEX.md` defines derived 3D as verification only.

## 1. Architecture and authority

```text
Carez Takeoff authority
├── PDF sheet/page
├── normalized measurement geometry
├── calibration
├── governed Condition inputs
├── color/elevation/profile
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
R3F / Three.js renderer
```

`buildDerived3DScene()` remains physical projection authority. The renderer consumes its output; it does not re-derive business geometry or quantities.

### Coordinate contract

`Derived3DSolid.shape` is already calibrated plan-space feet: X = plan horizontal, Z = plan page-down, Y = elevation. R3F consumes those coordinates directly and must not apply another measurement scale.

`Derived3DSheetPlane.worldWidth/worldHeight` define the PDF plane in the same units:

```text
PDF top-left     -> (0, 0, 0)
PDF top-right    -> (worldWidth, 0, 0)
PDF bottom-left  -> (0, 0, worldHeight)
PDF bottom-right -> (worldWidth, 0, worldHeight)
```

PDF/Three.js UV orientation must be handled explicitly so the sheet cannot render vertically flipped while solids remain unchanged.

## 2. Workstation and synchronization

The center viewport exposes only **2D | 3D**.

- 2D: existing PDF.js plan + Takeoff overlays.
- 3D: R3F Canvas with the same active PDF as the plan plane plus derived solids.

Sheets, Condition Properties, and Quantity Worksheet remain in place.

### Selection

2D selection carries the exact `measurementId` into 3D. 3D raycasting returns the mesh `measurementId` through the existing Carez selection path. No matching by color, name, array position, or approximate geometry.

### Sheets

The active sheet is the scene boundary. Switching A4 -> A5 swaps both PDF and solids to A5. Invalid stale selection clears; it must not jump the user back to A4.

### View switching preserves

Active sheet, selected measurement/Condition, Properties context, worksheet state, calculation state, and authoritative quantities.

### Property editing

Properties remains the editing surface in this replacement. Selecting from either view may edit governed elevation/reference, width, depth/thickness/height, profile/type, etc. through existing **Save & recalculate**. The mesh then regenerates from updated domain data. Elevation changes must be visible relative to the fixed PDF plane without camera auto-refit.

## 3. Style A visual target

Professional construction takeoff model: clean white plan surface, crisp colored concrete volumes, restrained shading, stable CAD-like navigation.

Scene:

```text
OrthographicCamera
OrbitControls
restrained ambient/hemisphere light
one soft directional light
active PDF plan plane
derived Takeoff meshes
crisp edges
selection/hover treatment
subtle contact shadow
```

No skybox, terrain, decorative grid, environment map, concrete texture, dramatic light, or translucent-markup look.

### PDF plane

The existing drawing workspace already receives `pdfUrl` and tracks active page. The 3D integration must pass that same `pdfUrl` plus active sheet `page_number` to the R3F plan loader.

Render the page directly through PDF.js, not by screenshotting the existing 2D canvas. Target about 2x displayed resolution with a 4096 px longest-side cap initially, correct color space/filtering, opaque white sheet, exact proportions, thin neutral edge, restrained shadow, and correct texture orientation.

### Meshes

- Slab: render the existing derived prism polygon/holes and top/bottom elevations.
- Strip/wall footing: render the existing derived footing prism/profile; do not recompute the raw centerline in R3F.
- Pad footing: render the existing derived box/prism at its governed dimensions, rotation, and elevation.

The renderer may not guess steps, slopes, returns, transitions, or offsets.

### Materials

Use existing Condition color. Bright readable tops, darker sides, thin dark edges, opaque normal geometry. Selected mesh gets stronger edge and small brightness/emissive lift; hover gets temporary edge emphasis. No pulsing/glow animation.

## 4. Camera

Use an orthographic CAD-style camera.

Home: about 45° yaw, 35–40° above plan, target sheet center, full PDF framed with margin. The PDF sheet—not concrete extents—controls initial framing.

Controls: orbit, pan, zoom, Home/Reset, Top, Focus Selected.

Horizontal orbit may be unrestricted; vertical orbit remains above the plan and stops before an unusable edge-on view. Never flip below the sheet.

Camera memory is per sheet and sanitized on restore. Property/elevation changes do not auto-refit.

## 5. Component boundaries

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

- `Takeoff3DViewport`: integration only; no quantities.
- `Takeoff3DScene`: Canvas/camera/lights/plan/meshes.
- `Takeoff3DPlan`: direct PDF.js page -> Three texture/plane.
- `Takeoff3DSolid`: one `Derived3DSolid`, material/edges/hover/select.
- `meshGeometry`: pure `Derived3DShape -> THREE.BufferGeometry`.
- controls/camera hook: navigation and per-sheet memory only.

R3F/WebGL must be client-only and dynamically loaded with SSR disabled (or repo-equivalent) so Next.js server rendering never instantiates browser/WebGL APIs.

## 6. Dependencies and governance precondition

Approved new dependencies are limited to:

```text
three
@react-three/fiber
@react-three/drei
```

Use stable versions compatible with current React 19 / Next.js 15 and pin through `pnpm-lock.yaml`. No prerelease unless unavoidable and documented.

Current `CODEX.md` says no new dependency. Therefore implementation Milestone 0 must first make a narrow governance change allowing dependencies that are explicitly approved by the task/spec, while continuing to prohibit unrelated dependency additions. Do not silently violate `CODEX.md`.

## 7. Existing state integration

`IntegratedTakeoffConditionWorkspace` remains owner of active sheet, selected measurement/Condition, view mode, derived scene, and Condition workflow state. Do not add another global store.

Conceptually:

```tsx
viewMode === '2d'
  ? <TakeoffDrawingWorkspace ... />
  : <Takeoff3DViewport
      scene={derivedScene}
      pdfUrl={workspaceProps.pdfUrl}
      activeSheetId={activeSheetId}
      activePageNumber={activeSheet.page_number}
      selectedMeasurementId={selectedMeasurementId}
      onSelectMeasurement={requestMeasurementSelection}
    />
```

Exact names may follow current repo conventions; stable-ID state ownership is fixed.

## 8. Performance and failure behavior

- one active PDF texture;
- active-sheet meshes only;
- rebuild geometry only for relevant geometry/physical-property changes;
- selection/hover do not rebuild geometry;
- camera motion avoids React state churn per frame;
- cap DPR at a practical maximum (initial target 2);
- dispose textures/geometries/materials;
- no preloaded 3D scenes for all sheets.

If one element cannot project, valid siblings still render and Carez explains the exact missing/unsupported input. If WebGL/renderer fails: **3D unavailable — 2D Takeoff and quantities remain available.**

## 9. Migration milestones

### Milestone 0 — governance/dependencies

Adjust `CODEX.md` narrowly, add only the three approved renderer packages, preserve current SVG renderer.

### Milestone A — R3F foundation

Client-only Canvas, orthographic camera, direct PDF.js texture plane, Home/Top/orbit/pan/zoom. No concrete yet.

**Gate:** real plan alone is readable, correctly oriented, stable, and professional.

### Milestone B — physical meshes

Slab, strip/wall footing, pad footing, Style A materials/lighting/edges/selection.

**Gate:** exact registration and clearly physical concrete volume.

### Milestone C — synchronization

2D->3D selection, 3D->2D selection, sheet sync, property-driven regeneration, per-sheet camera memory, partial-model issue disclosure.

**Gate:** Issue #41 Parts 1–2 real-browser workflow passes.

### Milestone D — legacy retirement

Only after A–C browser acceptance: remove SVG renderer/CSS, temporary renderer gate, obsolete renderer-only helpers/tests; final regression and Issue #41 update.

During A–C, an internal developer-only `legacy-svg | r3f` gate may exist for comparison/rollback. It must never be estimator-facing and must be removed in D.

## 10. Testing

### Pure tests

- derived plan coordinates are not re-scaled;
- PDF plane dimensions equal `worldWidth/worldHeight`;
- texture orientation matches page top-left/page-down convention;
- slab polygon/holes -> correct Three geometry;
- 12 in thickness -> 1.0 ft vertical extrusion;
- top/bottom/centerline reference -> correct Y range;
- footing prism/profile -> continuous geometry;
- pad -> correct dimensions/rotation/elevation.

### Identity/camera tests

- mesh A selects measurement A; mesh B selects B;
- no name/color/index matching;
- sheet switch scopes scene and clears stale selection;
- renderer actions do not mutate source quantity references;
- Home stays above plan and frames full sheet;
- camera cannot flip below plan or collapse edge-on;
- property/elevation change does not trigger refit.

At each milestone run targeted tests + `pnpm typecheck`. Before acceptance run `pnpm check`. Source/build success is not browser acceptance.

## 11. Browser visual acceptance

Use a real authenticated staging sheet with at least two supported elements, different Condition colors, and different elevations. Inspect 2D, 3D Home, rotated view, selected slab, selected footing, fixed-camera elevation change, and 3D->2D return.

Reject if PDF is blurry/stretched/sheared/flipped, solids are misregistered, geometry looks like translucent markup, camera can get lost/below/edge-on, selection is ambiguous, elevation change auto-refits, or quantities change because 3D rendered/selected.

Pass only when plan notes/dimensions remain readable at Home angle, solids sit exactly over source 2D locations, Condition colors are recognizable, thickness/depth reads clearly, elevation differences are visible, selection is obvious, and navigation feels like a restrained construction/CAD viewer.

## 12. Issue #41 acceptance workflow

1. Open real sheet in 2D and select an element.
2. Switch to 3D; same element selected and all supported active-sheet elements render.
3. Click another 3D mesh; exact 2D/Properties/worksheet record changes.
4. Return to 2D; exact source measurement remains selected.
5. Change sheets; both views follow without stale jump-back.
6. Edit governed property/elevation and Save & recalculate.
7. Mesh regenerates; authoritative 2D geometry and server/domain quantities remain intact.
8. Camera does not recenter after elevation change.
9. Unsupported elements are disclosed without blocking valid siblings.
10. Switching views/selecting meshes does not change worksheet quantities.

## 13. Execution workflow

After this written spec is approved, create the detailed implementation plan with Superpowers `writing-plans`, then execute milestone-by-milestone in an isolated Codex worktree from current `staging`. Use GPT-6 Astra for graphics-heavy implementation/visual judgment, TDD for pure geometry/camera/selection behavior, systematic debugging for registration/rendering defects, verification-before-completion, and code review before promotion.

## 14. Deferred direct 3D editing

Move/reshape/create operations are not part of this replacement. A later design may route 3D gestures through the same validated Carez Takeoff commands used by 2D, but it must first explicitly update the governing ADR/CODEX verification-only contract.

## Decision

> **Carez owns the Takeoff. Three.js only renders it.**
