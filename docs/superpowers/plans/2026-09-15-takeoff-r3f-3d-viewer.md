# Takeoff R3F 3D Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG pseudo-3D Takeoff renderer with a client-only React Three Fiber / Three.js construction-model viewer that uses the active PDF as the plan plane, renders existing `Derived3DScene` solids, and preserves Carez 2D/vector and server/domain quantity authority.

**Architecture:** Keep `buildDerived3DScene()` and its existing calibrated plan-space output as the physical projection contract. Add a narrow R3F presentation layer that consumes `Derived3DScene`, the active PDF URL/page, and stable Carez IDs; integrate it behind a temporary internal renderer gate until Milestones A–C pass browser acceptance, then remove the legacy SVG renderer.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5.9, `pdfjs-dist` 4.10, Three.js, React Three Fiber, Drei, Node test runner, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-09-15-takeoff-r3f-3d-viewer-design.md`

## Global Constraints

- Start from current `staging`; this plan was authored against `540cc8dcfcda50bfda48d1a6c9d288d81c622bf9`. If `staging` moved, read the spec and direct target files again before editing.
- Use an isolated worktree/temporary task branch. Target `staging`; do not touch `main`.
- Persisted normalized page-coordinate 2D/vector geometry remains Takeoff geometry and quantity authority.
- `buildDerived3DScene()` remains physical projection authority; the renderer consumes `Derived3DSolid.shape` directly in calibrated feet and must not re-scale or recompute business geometry.
- Server/domain outputs remain quantity, cost, and pricing authority. Never derive authoritative quantity from Three.js geometry.
- No database or migration changes are part of this plan.
- Approved new dependencies are exactly `three`, `@react-three/fiber`, and `@react-three/drei`. No other dependency additions.
- No estimator-facing Split mode. The center workspace is `2D | 3D` only.
- No direct 3D geometry editing/creation in this plan. Properties remains the edit surface.
- Keep the legacy SVG renderer available through Milestones A–C for rollback/comparison. Remove it only after browser acceptance of Milestone C.
- Every production-code behavior change follows RED → GREEN → REFACTOR. Run the named failing test before writing each production implementation.
- At every milestone run targeted tests plus `pnpm typecheck`; before browser acceptance run `pnpm check`.
- Source/build success is not browser acceptance. Stop at each visual gate and obtain authenticated browser acceptance before advancing to the next milestone.

---

## Milestone 0 — Governance and approved renderer dependencies

### Task 1: Narrow the dependency rule and install the approved stack

**Files:**
- Modify: `CODEX.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: approved spec dependency list.
- Produces: repository governance that permits only task/spec-approved dependency additions; installed R3F/Three packages for subsequent tasks.

- [ ] **Step 1: Update the dependency rule in `CODEX.md`**

Replace this sentence in Execute item 2:

```text
Make the smallest coherent diff; no unrelated refactor or new dependency.
```

with:

```text
Make the smallest coherent diff; no unrelated refactor or dependency. Add a dependency only when the task prompt or an approved repository spec explicitly authorizes it, and add only the authorized packages.
```

Do not change the 2D/vector authority rule or any other governance contract.

- [ ] **Step 2: Install only the approved renderer packages**

Run:

```bash
pnpm add three @react-three/fiber @react-three/drei
```

Expected: `package.json` gains exactly those three runtime dependencies and `pnpm-lock.yaml` pins their resolved versions. Reject prerelease versions; if pnpm resolves a prerelease, stop and select the latest stable compatible release explicitly.

- [ ] **Step 3: Verify the dependency-only change**

Run:

```bash
pnpm typecheck
pnpm test
```

Expected: both pass with no application behavior changes.

- [ ] **Step 4: Commit Milestone 0**

```bash
git add CODEX.md package.json pnpm-lock.yaml
git commit -m "chore(takeoff): authorize r3f viewer dependencies"
```

---

## Milestone A — R3F foundation and professional PDF construction viewer

### Task 2: Add pure plan-coordinate and sheet-plane helpers

**Files:**
- Create: `lib/takeoff/3d/coordinates.ts`
- Create: `tests/takeoff-3d-coordinates.test.ts`

**Interfaces:**
- Consumes: `Derived3DPlanPoint`, `Derived3DSheetPlane` from `lib/takeoff/conditions/derived3d/contracts.ts`.
- Produces:

```ts
export const PLAN_DATUM_Y = 0;
export type WorldPoint3 = { x: number; y: number; z: number };
export type SheetPlaneFrame = {
  width: number;
  height: number;
  center: [number, number, number];
  rotation: [number, number, number];
};
export function planPointToWorld(point: Derived3DPlanPoint, elevation?: number): WorldPoint3;
export function normalizedPagePointToWorld(u: number, v: number, plane: Derived3DSheetPlane): WorldPoint3;
export function sheetPlaneFrame(plane: Derived3DSheetPlane): SheetPlaneFrame;
```

- [ ] **Step 1: Write the failing coordinate-contract tests**

Create `tests/takeoff-3d-coordinates.test.ts` with tests equivalent to:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPagePointToWorld, planPointToWorld, sheetPlaneFrame } from '../lib/takeoff/3d/coordinates.ts';

const plane = { sheetId: 'A4', pageWidth: 1000, pageHeight: 800, scaleFtPerPdfUnit: 0.1, worldWidth: 100, worldHeight: 80 };

test('R3F coordinates consume derived plan feet without rescaling', () => {
  assert.deepEqual(planPointToWorld({ x: 12.5, z: 24 }, -3), { x: 12.5, y: -3, z: 24 });
});

test('normalized PDF corners map to the same page-right/page-down world convention', () => {
  assert.deepEqual(normalizedPagePointToWorld(0, 0, plane), { x: 0, y: 0, z: 0 });
  assert.deepEqual(normalizedPagePointToWorld(1, 0, plane), { x: 100, y: 0, z: 0 });
  assert.deepEqual(normalizedPagePointToWorld(0, 1, plane), { x: 0, y: 0, z: 80 });
  assert.deepEqual(normalizedPagePointToWorld(1, 1, plane), { x: 100, y: 0, z: 80 });
});

test('sheet plane is centered on the exact derived world extents', () => {
  assert.deepEqual(sheetPlaneFrame(plane), {
    width: 100,
    height: 80,
    center: [50, 0, 40],
    rotation: [-Math.PI / 2, 0, 0],
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm test -- tests/takeoff-3d-coordinates.test.ts
```

Expected: FAIL because `lib/takeoff/3d/coordinates.ts` does not exist.

- [ ] **Step 3: Implement the minimal coordinate helpers**

Create `lib/takeoff/3d/coordinates.ts`:

```ts
import type { Derived3DPlanPoint, Derived3DSheetPlane } from '@/lib/takeoff/conditions/derived3d/contracts';

export const PLAN_DATUM_Y = 0;
export type WorldPoint3 = { x: number; y: number; z: number };
export type SheetPlaneFrame = { width: number; height: number; center: [number, number, number]; rotation: [number, number, number] };

function requirePlaneSize(plane: Derived3DSheetPlane) {
  if (!(plane.worldWidth && plane.worldHeight)) throw new Error('The active sheet needs calibrated 3D dimensions.');
  return { width: plane.worldWidth, height: plane.worldHeight };
}

export function planPointToWorld(point: Derived3DPlanPoint, elevation = PLAN_DATUM_Y): WorldPoint3 {
  return { x: point.x, y: elevation, z: point.z };
}

export function normalizedPagePointToWorld(u: number, v: number, plane: Derived3DSheetPlane): WorldPoint3 {
  const { width, height } = requirePlaneSize(plane);
  return { x: u * width, y: PLAN_DATUM_Y, z: v * height };
}

export function sheetPlaneFrame(plane: Derived3DSheetPlane): SheetPlaneFrame {
  const { width, height } = requirePlaneSize(plane);
  return { width, height, center: [width / 2, PLAN_DATUM_Y, height / 2], rotation: [-Math.PI / 2, 0, 0] };
}
```

Do not import or call `toPlanPoint()` here; that conversion already occurred upstream.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- tests/takeoff-3d-coordinates.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/takeoff/3d/coordinates.ts tests/takeoff-3d-coordinates.test.ts
git commit -m "test(takeoff): lock r3f coordinate contract"
```

### Task 3: Add deterministic orthographic camera math

**Files:**
- Create: `lib/takeoff/3d/camera.ts`
- Create: `tests/takeoff-3d-camera.test.ts`

**Interfaces:**
- Produces:

```ts
export type Takeoff3DCameraMemory = { azimuth: number; polar: number; zoom: number; target: [number, number, number] };
export const HOME_AZIMUTH: number;
export const HOME_POLAR: number;
export const MIN_POLAR: number;
export const MAX_POLAR: number;
export function sanitizeCameraMemory(value: Takeoff3DCameraMemory): Takeoff3DCameraMemory;
export function homeCameraMemory(width: number, height: number, viewportWidth: number, viewportHeight: number): Takeoff3DCameraMemory;
export function topCameraMemory(width: number, height: number, viewportWidth: number, viewportHeight: number): Takeoff3DCameraMemory;
```

- [ ] **Step 1: Write failing camera tests**

Test these exact behaviors:

```ts
assert.equal(sanitizeCameraMemory({ azimuth: 0, polar: Math.PI, zoom: 0, target: [1,2,3] }).polar, MAX_POLAR);
assert.ok(homeCameraMemory(100, 80, 1200, 800).polar > 0 && homeCameraMemory(100, 80, 1200, 800).polar < MAX_POLAR);
assert.deepEqual(homeCameraMemory(100, 80, 1200, 800).target, [50, 0, 40]);
assert.deepEqual(topCameraMemory(100, 80, 1200, 800).target, [50, 0, 40]);
assert.ok(topCameraMemory(100, 80, 1200, 800).polar <= MIN_POLAR);
assert.ok(homeCameraMemory(100, 80, 1200, 800).zoom > 0);
```

Use `MIN_POLAR = Math.PI / 90` (2° from vertical), `MAX_POLAR = 5 * Math.PI / 12` (75° from vertical = 15° above horizon), `HOME_AZIMUTH = -Math.PI / 4`, and `HOME_POLAR = 53 * Math.PI / 180` (about 37° above the plan).

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/takeoff-3d-camera.test.ts
```

Expected: FAIL because camera helpers do not exist.

- [ ] **Step 3: Implement camera helpers**

Use a full-sheet fit based on sheet diagonal so concrete extents never determine Home framing:

```ts
const margin = 1.22;
const diagonal = Math.hypot(width, height) * margin;
const fitPixels = Math.min(viewportWidth, viewportHeight);
const zoom = Math.max(0.01, fitPixels / diagonal);
```

Clamp `polar` to `[MIN_POLAR, MAX_POLAR]`, clamp `zoom` to `[0.05, 40]`, preserve azimuth, and normalize non-finite target values back to `[width / 2, 0, height / 2]` when Home/Top is created.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- tests/takeoff-3d-camera.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/takeoff/3d/camera.ts tests/takeoff-3d-camera.test.ts
git commit -m "test(takeoff): define r3f camera constraints"
```

### Task 4: Render the active PDF page directly into a Three texture

**Files:**
- Create: `lib/takeoff/3d/planTexture.ts`
- Create: `tests/takeoff-3d-plan.test.ts`
- Create: `components/takeoff/3d/Takeoff3DPlan.tsx`

**Interfaces:**
- Produces:

```ts
export type PlanTextureSize = { width: number; height: number; scale: number };
export function computePlanTextureSize(pageWidth: number, pageHeight: number, viewportWidth: number, viewportHeight: number): PlanTextureSize;
export async function renderPdfPageCanvas(pdfUrl: string, pageNumber: number, target: PlanTextureSize, signal?: AbortSignal): Promise<HTMLCanvasElement>;
```

`Takeoff3DPlan` props:

```ts
{
  pdfUrl: string;
  pageNumber: number;
  plane: Derived3DSheetPlane;
  viewportSize: { width: number; height: number };
}
```

- [ ] **Step 1: Write failing pure sizing tests**

Verify:

```ts
const size = computePlanTextureSize(1000, 800, 1200, 800);
assert.equal(Math.max(size.width, size.height) <= 4096, true);
assert.equal(Number((size.width / size.height).toFixed(6)), 1.25);
assert.equal(size.width >= 2000, true);
```

Also test a very large viewport caps longest side at 4096 and a portrait page preserves aspect ratio.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/takeoff-3d-plan.test.ts
```

Expected: FAIL because `planTexture.ts` does not exist.

- [ ] **Step 3: Implement texture sizing and PDF.js canvas rendering**

`computePlanTextureSize()` must target approximately 2× the longest displayed viewport dimension, cap the longest texture side at 4096, and preserve page ratio.

`renderPdfPageCanvas()` must:

```ts
const pdfjs = await import('pdfjs-dist');
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
const loadingTask = pdfjs.getDocument({ url: pdfUrl });
const pdf = await loadingTask.promise;
const page = await pdf.getPage(pageNumber);
const viewport = page.getViewport({ scale: target.scale });
const canvas = document.createElement('canvas');
canvas.width = Math.max(1, Math.round(viewport.width));
canvas.height = Math.max(1, Math.round(viewport.height));
const context = canvas.getContext('2d', { alpha: false });
if (!context) throw new Error('PDF texture canvas is unavailable.');
context.fillStyle = '#ffffff';
context.fillRect(0, 0, canvas.width, canvas.height);
await page.render({ canvasContext: context, viewport }).promise;
page.cleanup();
await pdf.destroy();
return canvas;
```

Honor `AbortSignal` before and after the async render; abort cleanup must destroy the loading task/document when available.

- [ ] **Step 4: Implement `Takeoff3DPlan`**

Use `useThree()` for renderer capabilities and create a `THREE.CanvasTexture` from the returned canvas. Configure:

```ts
texture.colorSpace = THREE.SRGBColorSpace;
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.generateMipmaps = true;
texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
```

Use `sheetPlaneFrame(plane)` and a `planeGeometry` sized exactly `worldWidth × worldHeight`, rotated `-Math.PI / 2`, centered at `[worldWidth/2, 0, worldHeight/2]`. Keep the material opaque white and dispose texture on replacement/unmount.

Do not capture/query the existing 2D `<canvas>`.

- [ ] **Step 5: Verify tests and typecheck**

```bash
pnpm test -- tests/takeoff-3d-plan.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/takeoff/3d/planTexture.ts tests/takeoff-3d-plan.test.ts components/takeoff/3d/Takeoff3DPlan.tsx
git commit -m "feat(takeoff): add direct pdf texture plane"
```

### Task 5: Build the client-only R3F scene, controls, toolbar, and error boundary

**Files:**
- Create: `components/takeoff/3d/Takeoff3DViewport.tsx`
- Create: `components/takeoff/3d/Takeoff3DScene.tsx`
- Create: `components/takeoff/3d/Takeoff3DControls.tsx`
- Create: `components/takeoff/3d/Takeoff3DToolbar.tsx`
- Create: `components/takeoff/3d/Takeoff3DErrorBoundary.tsx`
- Create: `components/takeoff/3d/useTakeoff3DCamera.ts`
- Create: `components/takeoff/3d/Takeoff3DViewport.module.css`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:**

`Takeoff3DViewport`:

```ts
export type Takeoff3DViewportProps = {
  scene: Derived3DScene;
  pdfUrl: string;
  activeSheetId: string | null;
  activePageNumber: number;
  activeSheetLabel: string;
  selectedMeasurementId: string | null;
  selectedConditionVersionId: string | null;
  viewState: Derived3DViewState;
  onViewStateChange: (value: Derived3DViewState | ((current: Derived3DViewState) => Derived3DViewState)) => void;
  onSelectSolid: (solid: Derived3DSolid) => void;
  onJumpToIssue: (issue: Derived3DIssue) => void;
};
```

- [ ] **Step 1: Update the source-contract test first**

Change the current QA assertions so the new renderer contract requires:

```ts
const r3fViewport = readFileSync('components/takeoff/3d/Takeoff3DViewport.tsx', 'utf8');
const r3fPlan = readFileSync('components/takeoff/3d/Takeoff3DPlan.tsx', 'utf8');
const r3fScene = readFileSync('components/takeoff/3d/Takeoff3DScene.tsx', 'utf8');

assert.match(r3fScene, /<Canvas/);
assert.match(r3fScene, /orthographic/);
assert.match(r3fPlan, /renderPdfPageCanvas/);
assert.doesNotMatch(r3fPlan, /querySelector<HTMLCanvasElement>/);
assert.match(r3fViewport, /activeSheetId/);
```

Keep legacy viewer assertions only where they protect fallback behavior through Milestone C; remove assertions that require SVG/canvas-capture as the target behavior.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/qa-condition-workstation.test.ts
```

Expected: FAIL because R3F components are incomplete/missing.

- [ ] **Step 3: Implement the scene**

`Takeoff3DScene` must render:

```tsx
<Canvas orthographic dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
  <color attach="background" args={['#090d12']} />
  <hemisphereLight intensity={0.9} groundColor="#111827" />
  <directionalLight position={[40, 80, -30]} intensity={1.15} />
  <Takeoff3DPlan ... />
  <Takeoff3DControls ... />
</Canvas>
```

No solids are rendered in Milestone A.

- [ ] **Step 4: Implement camera controls**

`useTakeoff3DCamera` owns a `Map<sheetId, Takeoff3DCameraMemory>` in a ref. It may write memory on OrbitControls `end`, not every animation frame.

`Takeoff3DControls` uses Drei `OrbitControls` with:

```tsx
minPolarAngle={MIN_POLAR}
maxPolarAngle={MAX_POLAR}
enableDamping
dampingFactor={0.08}
makeDefault
```

Provide imperative actions for `home()`, `top()`, and `focusSelected()`. `home()` and `top()` explicitly update camera/controls. A scene/solid property change does not call them.

- [ ] **Step 5: Implement toolbar/error UI outside the Canvas**

Toolbar primary controls: `Home`, `Top`, `Focus`, filters trigger, and `3D checks N`. Reuse Carez `Button` and Lucide icons. Keep missing-input/issue disclosure in normal DOM above/below the Canvas so WebGL failure cannot hide the explanation.

Error boundary fallback copy is exactly:

```text
3D unavailable
Your 2D Takeoff and quantities remain available.
```

Include a `Retry 3D` action that remounts only the viewer.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm test -- tests/qa-condition-workstation.test.ts tests/takeoff-3d-coordinates.test.ts tests/takeoff-3d-camera.test.ts tests/takeoff-3d-plan.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/takeoff/3d tests/qa-condition-workstation.test.ts
git commit -m "feat(takeoff): add r3f pdf viewer foundation"
```

### Task 6: Integrate the R3F foundation behind an internal renderer gate

**Files:**
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.tsx`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.module.css`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:**
- Consumes: existing `derived3DScene`, `workspaceProps.pdfUrl`, `activeSheetId`, `activeSheet.page_number`, selected IDs, existing callbacks.
- Produces: developer-only `legacy-svg | r3f` renderer choice; estimator UI remains `2D | 3D`.

- [ ] **Step 1: Add a failing integration/source-contract assertion**

Require:

```ts
assert.match(workstation, /NEXT_PUBLIC_CAREZ_3D_RENDERER/);
assert.match(workstation, /dynamic\(/);
assert.match(workstation, /ssr:false/);
assert.match(workstation, /pdfUrl=\{workspaceProps\.pdfUrl\}/);
assert.match(workstation, /activePageNumber=\{Number\(activeSheet\?\.page_number\|\|1\)\}/);
assert.doesNotMatch(workstation, /\['2d','3d','split'\]/);
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/qa-condition-workstation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add the client-only dynamic import and gate**

Use:

```ts
import dynamic from 'next/dynamic';

const Takeoff3DViewport = dynamic(
  () => import('./3d/Takeoff3DViewport').then(module => module.Takeoff3DViewport),
  { ssr: false },
);

const rendererMode = process.env.NEXT_PUBLIC_CAREZ_3D_RENDERER === 'legacy-svg' ? 'legacy-svg' : 'r3f';
```

The estimator-facing tabs become exactly `(['2d','3d'] as const)`; remove `split` from `ViewMode` and `PendingSwitch` usage where it is only a presentation state.

When `viewMode === '3d'`, render either the legacy viewer or `Takeoff3DViewport` according to `rendererMode`. Pass the existing stable selection callbacks; do not create a second selection store.

- [ ] **Step 4: Simplify overlay CSS for one full center viewport**

Keep the existing overlay anchored over the drawing center excluding the sheet navigator width and quantity dock. Remove Split-specific selectors/classes. Preserve mobile behavior where the navigator is hidden and overlay starts at `left:0`.

- [ ] **Step 5: Verify integration**

```bash
pnpm test -- tests/qa-condition-workstation.test.ts
pnpm typecheck
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/takeoff/IntegratedTakeoffConditionWorkspace.tsx components/takeoff/IntegratedTakeoffConditionWorkspace.module.css tests/qa-condition-workstation.test.ts
git commit -m "feat(takeoff): gate r3f viewer in drawing workspace"
```

### Milestone A browser gate — STOP before concrete meshes

Run `pnpm check`, deploy the temporary branch/staging preview, and verify on the real A4 sheet:

1. `2D -> 3D` replaces only the center drawing viewport.
2. The actual A4 PDF is visible as a crisp white plane.
3. Text/dimensions are readable at Home angle.
4. PDF is not mirrored, upside-down, stretched, or sheared.
5. Home frames the complete sheet; Top is exact plan view.
6. Orbit cannot move below the sheet or collapse to an edge-on unusable view.
7. Pan/zoom remain stable.
8. `3D -> 2D -> 3D` restores a sane per-sheet camera.

Do not start Milestone B until this gate is accepted.

---

## Milestone B — Real physical Takeoff meshes

### Task 7: Convert `Derived3DShape` to grouped Three geometry

**Files:**
- Create: `lib/takeoff/3d/meshGeometry.ts`
- Create: `tests/takeoff-3d-mesh-geometry.test.ts`

**Interfaces:**
- Produces:

```ts
export type TakeoffMeshGeometry = THREE.BufferGeometry;
export function buildTakeoffMeshGeometry(shape: Derived3DShape): TakeoffMeshGeometry;
```

Material groups are fixed:

```text
group 0 = top
group 1 = sides
group 2 = bottom
```

- [ ] **Step 1: Write failing geometry tests**

Cover all current shape contracts:

```ts
const slab = buildTakeoffMeshGeometry({ kind:'prism', outer:[{x:0,z:0},{x:10,z:0},{x:10,z:8},{x:0,z:8}], holes:[], bottom:-1, top:0 });
slab.computeBoundingBox();
assert.equal(slab.boundingBox?.min.y, -1);
assert.equal(slab.boundingBox?.max.y, 0);
assert.equal(slab.groups.some(group => group.materialIndex === 0), true);
assert.equal(slab.groups.some(group => group.materialIndex === 1), true);
```

Also test:

- prism with one rectangular hole does not fill the hole in top triangulation;
- trapezoid prism with `topOuter` has top width different from bottom width and preserves the same top/bottom Y values;
- box shape honors `centerX`, `centerZ`, `width`, `length`, `yawRad`, `bottom`, `top`;
- 12-inch-equivalent depth already supplied as `top-bottom = 1` remains exactly 1 world foot; renderer does not convert units again.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/takeoff-3d-mesh-geometry.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement prism geometry**

For normal prisms, use `THREE.ShapeUtils.triangulateShape()` for top/bottom rings and build side quads explicitly so material groups are controllable. Convert `{x,z}` to Three `{x,y,z}` using the shape’s existing `bottom`/`top`; do not multiply by sheet scale.

For `topOuter`, require `topOuter.length === outer.length`; build side quads between corresponding bottom/top vertices. Current strip-footing tapered profiles have no holes; if `topOuter` and holes are both present, throw `Unsupported tapered prism with holes.` so the renderer fails visibly rather than inventing topology.

Call:

```ts
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setIndex(indices);
geometry.computeVertexNormals();
geometry.computeBoundingBox();
geometry.computeBoundingSphere();
```

Add material groups while emitting indices.

For `box`, use `THREE.BoxGeometry(width, top-bottom, length)`, translate to `[centerX,(top+bottom)/2,centerZ]`, rotate around Y by `-yawRad` or `yawRad` only after a test proves orientation matches the plan convention. Lock that sign in the test fixture.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- tests/takeoff-3d-mesh-geometry.test.ts tests/derived-3d.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/takeoff/3d/meshGeometry.ts tests/takeoff-3d-mesh-geometry.test.ts
git commit -m "feat(takeoff): build three geometry from derived solids"
```

### Task 8: Render Style A solids with exact stable-ID picking

**Files:**
- Create: `components/takeoff/3d/Takeoff3DSolid.tsx`
- Create: `lib/takeoff/3d/selection.ts`
- Create: `tests/takeoff-3d-selection.test.ts`
- Modify: `components/takeoff/3d/Takeoff3DScene.tsx`
- Modify: `components/takeoff/3d/Takeoff3DViewport.tsx`

**Interfaces:**

```ts
export function solidSelectionIdentity(solid: Derived3DSolid): {
  solidId: string;
  measurementId: string;
  conditionVersionId: string;
  sheetId: string;
};
```

`Takeoff3DSolid` receives `solid`, `selected`, and `onSelect(solid)`.

- [ ] **Step 1: Write failing stable-ID tests**

```ts
assert.deepEqual(solidSelectionIdentity(solidA), {
  solidId: solidA.id,
  measurementId: solidA.measurementId,
  conditionVersionId: solidA.conditionVersionId,
  sheetId: solidA.sheetId,
});
assert.notEqual(solidSelectionIdentity(solidA).measurementId, solidSelectionIdentity(solidB).measurementId);
```

The test must not inspect color/name/array index.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/takeoff-3d-selection.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement selection helper and solid rendering**

`Takeoff3DSolid`:

```tsx
const geometry = useMemo(() => buildTakeoffMeshGeometry(solid.shape), [solid.geometryKey, solid.shape]);
```

Dispose geometry on replacement/unmount.

Use three materials in the geometry-group order. Derive top/side/bottom colors from `solid.color` with `THREE.Color` HSL lightness adjustments, not opacity. Keep all normal materials opaque and `roughness` high (`0.82–0.9`) with restrained `metalness` (`0`).

Set mesh `userData` to `solidSelectionIdentity(solid)`. `onClick` must `stopPropagation()` and call `onSelect(solid)`. Hover only changes local hover state and cursor/edge emphasis; it must not select.

Use Drei `<Edges>` for crisp dark edges. Selected state increases edge contrast and a small emissive/brightness lift; no pulsing/glow animation.

- [ ] **Step 4: Render all valid active-sheet solids**

In `Takeoff3DScene`:

```ts
const sheetSolids = scene.solids.filter(solid => solid.sheetId === activeSheetId);
```

Apply existing `viewState.hidden`, `isolated`, `zone`, and `elevation` filters before mapping to `<Takeoff3DSolid>`. Selection never controls whether a solid exists.

Add a restrained contact shadow under the plan/solids only if it does not obscure plan readability; use Drei `ContactShadows` with low opacity and no environment map.

- [ ] **Step 5: Verify GREEN**

```bash
pnpm test -- tests/takeoff-3d-selection.test.ts tests/takeoff-3d-mesh-geometry.test.ts tests/derived-3d.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/takeoff/3d/Takeoff3DSolid.tsx components/takeoff/3d/Takeoff3DScene.tsx components/takeoff/3d/Takeoff3DViewport.tsx lib/takeoff/3d/selection.ts tests/takeoff-3d-selection.test.ts
git commit -m "feat(takeoff): render derived solids in r3f"
```

### Milestone B browser gate — STOP before synchronization work

Run `pnpm check`, deploy preview, and verify the real A4 sheet:

1. Every supported A4 Takeoff appears automatically; selection is not required to render it.
2. Green footing and blue slab sit exactly over their 2D source locations.
3. Condition colors are recognizable; top/side depth is obvious without transparency.
4. Footing corners read as one continuous physical footing.
5. Slab holes/openings, if present, remain open.
6. Different elevations are visibly separated relative to the PDF plane.
7. Clicking a mesh visibly selects it in the R3F scene without moving/reframing the camera.
8. PDF remains readable and is not visually dominated by lighting/shadows.

Do not start Milestone C until this gate is accepted.

---

## Milestone C — Exact workstation synchronization and issue behavior

### Task 9: Wire exact 2D ↔ 3D selection and active-sheet behavior

**Files:**
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.tsx`
- Modify: `components/takeoff/3d/Takeoff3DViewport.tsx`
- Modify: `components/takeoff/3d/Takeoff3DScene.tsx`
- Modify: `tests/qa-condition-workstation.test.ts`
- Modify: `tests/takeoff-3d-selection.test.ts`

**Interfaces:**
- Reuse existing `selectDerivedSolid`, `requestMeasurementSelection`, `requestConditionSelection`, `focusMeasurement`, and worksheet custom-event synchronization.
- No new global store.

- [ ] **Step 1: Write failing synchronization assertions**

`qa-condition-workstation.test.ts` must require that R3F receives `selectedMeasurementId` and calls the same existing `selectDerivedSolid` callback.

Add pure selection tests for sheet scoping:

```ts
export function sheetSolidsForSelection(scene: Derived3DScene, activeSheetId: string | null): Derived3DSolid[];
export function selectedSolidForMeasurement(solids: Derived3DSolid[], measurementId: string | null): Derived3DSolid | null;
```

Verify a stale measurement from A4 returns `null` when A5 is active.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/takeoff-3d-selection.test.ts tests/qa-condition-workstation.test.ts
```

Expected: FAIL for the new contract.

- [ ] **Step 3: Implement exact selection flow**

Use stable IDs only:

```text
2D click -> existing requestMeasurementSelection -> selectedMeasurementId -> R3F selected mesh
3D click -> onSelectSolid(solid) -> existing requestConditionSelection(conditionVersionId,false,measurementId)
```

Do not dispatch a new parallel selection event from the R3F layer.

When active sheet changes, `Takeoff3DViewport` filters to that sheet immediately. If `selectedMeasurementId` is absent from active-sheet solids, render no 3D selection; existing workstation logic remains responsible for clearing/focusing authoritative selection.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- tests/takeoff-3d-selection.test.ts tests/qa-condition-workstation.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/takeoff/IntegratedTakeoffConditionWorkspace.tsx components/takeoff/3d/Takeoff3DViewport.tsx components/takeoff/3d/Takeoff3DScene.tsx tests/qa-condition-workstation.test.ts tests/takeoff-3d-selection.test.ts
git commit -m "feat(takeoff): synchronize r3f selection with takeoff"
```

### Task 10: Preserve camera per sheet without hiding property/elevation changes

**Files:**
- Modify: `components/takeoff/3d/useTakeoff3DCamera.ts`
- Modify: `components/takeoff/3d/Takeoff3DControls.tsx`
- Modify: `lib/takeoff/3d/camera.ts`
- Modify: `tests/takeoff-3d-camera.test.ts`

**Interfaces:**
- Camera memory key is `activeSheetId` only.
- Camera resets only for explicit Home/Top/Focus or first load of a sheet with no saved memory.

- [ ] **Step 1: Add failing persistence tests**

Add a pure helper:

```ts
export function shouldInitializeCamera(previousSheetId: string | null, nextSheetId: string | null, hasMemory: boolean): boolean;
```

Verify:

```ts
assert.equal(shouldInitializeCamera('A4','A4',true), false);
assert.equal(shouldInitializeCamera('A4','A5',false), true);
assert.equal(shouldInitializeCamera('A4','A5',true), false);
```

Also test `sanitizeCameraMemory()` clamps old invalid pitch/zoom without changing target unless target is non-finite.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/takeoff-3d-camera.test.ts
```

Expected: FAIL for the new helper.

- [ ] **Step 3: Implement camera initialization rules**

Do not put `scene.hash`, `solid.geometryKey`, selected ID, or Condition revision in the camera-initialization effect dependencies that trigger Home fitting. Updating elevation/thickness/profile must regenerate geometry while camera remains unchanged.

Persist camera on OrbitControls `end` and on explicit toolbar actions.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- tests/takeoff-3d-camera.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/takeoff/3d/useTakeoff3DCamera.ts components/takeoff/3d/Takeoff3DControls.tsx lib/takeoff/3d/camera.ts tests/takeoff-3d-camera.test.ts
git commit -m "fix(takeoff): preserve r3f camera across recalculation"
```

### Task 11: Port partial-model holds, filters, and 3D checks to the R3F viewport

**Files:**
- Modify: `components/takeoff/3d/Takeoff3DViewport.tsx`
- Modify: `components/takeoff/3d/Takeoff3DToolbar.tsx`
- Modify: `components/takeoff/3d/Takeoff3DViewport.module.css`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:**
- Preserve current `Derived3DViewState = { hidden: string[]; isolated: string | null; zone: string; elevation: string }` until legacy retirement.
- Preserve `onJumpToIssue(issue)` so `Resolve input` continues routing to existing Properties tabs.

- [ ] **Step 1: Add failing source-contract assertions**

Require R3F viewport to:

- compute `sheetIssues` from `scene.issues` filtered by `activeSheetId`;
- identify a selected `3d_input_required` / `unsupported_projection` issue by `selectedMeasurementId`;
- render valid sibling solids even when selected element is held;
- expose `Resolve input` and `3D checks N` in normal DOM;
- preserve filters/hide/isolate without changing `scene.sourceQuantities`.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- tests/qa-condition-workstation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement DOM issue/filter UI**

Keep the message distinction:

```text
3D input required
```

for missing governed data, and:

```text
3D unavailable for this Takeoff
```

for unsupported projection contracts.

If at least one sibling solid is valid, keep Canvas visible and overlay only the selected issue notice. If no solids are valid, show the plan plane plus centered issue state where possible; do not fall back to a blank black screen.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- tests/qa-condition-workstation.test.ts tests/derived-3d.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/takeoff/3d/Takeoff3DViewport.tsx components/takeoff/3d/Takeoff3DToolbar.tsx components/takeoff/3d/Takeoff3DViewport.module.css tests/qa-condition-workstation.test.ts
git commit -m "feat(takeoff): port 3d checks and filters to r3f"
```

### Task 12: Full Milestone C automated regression

**Files:**
- Modify only if a failing regression proves necessary: `tests/derived-3d.test.ts`, `tests/qa-condition-workstation.test.ts`, or the new `tests/takeoff-3d-*.test.ts` files.

- [ ] **Step 1: Run all targeted renderer/domain tests**

```bash
pnpm test -- tests/derived-3d.test.ts tests/qa-condition-workstation.test.ts tests/takeoff-3d-coordinates.test.ts tests/takeoff-3d-camera.test.ts tests/takeoff-3d-plan.test.ts tests/takeoff-3d-mesh-geometry.test.ts tests/takeoff-3d-selection.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the repository broad gate**

```bash
pnpm check
```

Expected: typecheck, full domain tests, and production build all PASS.

- [ ] **Step 3: Confirm no quantity authority moved into renderer files**

Run:

```bash
grep -R "raw_quantity\|production_quantity\|direct_cost\|sourceQuantities" components/takeoff/3d lib/takeoff/3d
```

Expected: no calculations of those values. `sourceQuantities` may appear only for read-only invariants/display if required; no arithmetic or persistence calls are allowed.

- [ ] **Step 4: Commit only if Task 12 required a test/bug fix**

```bash
git add tests components/takeoff/3d lib/takeoff/3d
git commit -m "test(takeoff): verify r3f workstation regression"
```

If no files changed, do not create an empty commit.

### Milestone C authenticated browser gate — STOP before deleting legacy

Use the real multi-element A4/A5 QA set and record screenshots/video for review.

Acceptance sequence:

1. Open A4 in 2D and select the blue slab.
2. Switch to 3D; A4 remains the PDF plane, all supported A4 solids render, blue slab is selected.
3. Click the green footing in 3D; Properties and Quantity Worksheet switch to that exact footing.
4. Return to 2D; the exact source footing measurement is selected.
5. Select A5; 2D/3D both follow A5 and do not jump back to A4.
6. Return to A4; its previous sane camera restores.
7. Change a governed elevation/reference in Properties, Save & recalculate, and keep the camera untouched; the solid moves vertically relative to the fixed PDF plane.
8. Verify worksheet quantities remain exactly the same unless the authoritative domain recalculation itself changes them for a legitimate input change; view switching/selection alone never changes quantity.
9. Clear one required 3D physical input on a QA draft; valid sibling solids still render and the selected held element shows the exact resolution message. Restore the value.
10. Orbit/pan/zoom/Home/Top/Focus remain construction-viewer stable; plan stays readable.

Do not begin Milestone D until the user explicitly accepts this gate.

---

## Milestone D — Retire the SVG pseudo-3D renderer

### Task 13: Remove the temporary renderer gate and legacy SVG implementation

**Files:**
- Delete: `components/takeoff/TakeoffDerived3DView.tsx`
- Delete: `components/takeoff/TakeoffDerived3DView.module.css`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.tsx`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.module.css`
- Modify: `tests/qa-condition-workstation.test.ts`
- Modify as needed: imports/types that existed only for legacy `Derived3DViewMemory`.

**Interfaces:**
- R3F becomes the only 3D renderer.
- `Derived3DScene`, `Derived3DViewState`, stable selection callbacks, and authoritative domain contracts remain.

- [ ] **Step 1: Make the test fail for any remaining legacy renderer reference**

Update `qa-condition-workstation.test.ts` to assert:

```ts
assert.doesNotMatch(workstation, /NEXT_PUBLIC_CAREZ_3D_RENDERER/);
assert.doesNotMatch(workstation, /TakeoffDerived3DView/);
assert.doesNotMatch(workspaceStyles, /derivedOverlaySplit/);
```

Do not read deleted files in the test.

- [ ] **Step 2: Verify RED before deleting**

```bash
pnpm test -- tests/qa-condition-workstation.test.ts
```

Expected: FAIL while legacy references still exist.

- [ ] **Step 3: Delete legacy and make R3F unconditional for 3D mode**

Remove environment renderer gate, legacy imports, legacy memory type/ref, SVG-specific CSS, Split remnants, and compatibility assertions. Keep the client-only dynamic import for R3F.

Do not delete `lib/takeoff/conditions/derived3d.ts`, its contracts, checks, coordinates, or source-resolution layer; they remain domain projection authority.

- [ ] **Step 4: Verify GREEN and broad regression**

```bash
pnpm test -- tests/qa-condition-workstation.test.ts tests/derived-3d.test.ts tests/takeoff-3d-coordinates.test.ts tests/takeoff-3d-camera.test.ts tests/takeoff-3d-plan.test.ts tests/takeoff-3d-mesh-geometry.test.ts tests/takeoff-3d-selection.test.ts
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A components/takeoff tests lib/takeoff/3d
git commit -m "refactor(takeoff): retire svg 3d renderer"
```

### Task 14: Final verification and Issue #41 closeout checkpoint

**Files:**
- Modify only if accepted current-state documentation needs an update: `docs/concrete-condition-3d-workstation-target.md`, `docs/modules/takeoff.md`.
- Issue update: GitHub Issue #41.

- [ ] **Step 1: Run final repository verification from the exact branch head**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 2: Deploy the exact head and record the SHA**

Confirm the Vercel preview/staging deployment corresponds to the exact implementation head. Do not report browser acceptance from build status alone.

- [ ] **Step 3: Repeat the Milestone C browser acceptance on the exact final SHA**

Confirm A4/A5 selection sync, PDF registration, elevation visibility, camera behavior, partial holds, and unchanged quantity authority.

- [ ] **Step 4: Run a legacy-reference audit**

```bash
grep -R "TakeoffDerived3DView\|derivedOverlaySplit\|NEXT_PUBLIC_CAREZ_3D_RENDERER" components tests lib || true
```

Expected: zero legacy-renderer results.

- [ ] **Step 5: Update Issue #41 with the final acceptance record**

Record:

- exact final SHA;
- `pnpm check` result;
- Vercel READY state for exact SHA;
- authenticated browser PASS for the Issue #41 Parts 1–2 workflow;
- explicit statement that persisted 2D/vector geometry and server/domain quantities remain authoritative;
- explicit statement that direct 3D geometry editing remains deferred to a separate design/governance change.

- [ ] **Step 6: Commit any accepted current-state documentation update**

If docs changed:

```bash
git add docs
git commit -m "docs(takeoff): record accepted r3f 3d viewer"
```

If docs did not need changes, do not create an empty commit.

---

## Visual execution instructions for Codex + Astra

At each browser gate, compare the actual rendered result to the approved Style A target rather than merely checking controls/functionality.

Reject and debug before advancing if any of these occur:

- PDF plan is blurry, mirrored, flipped, stretched, sheared, washed out, or unreadable at Home angle;
- concrete is translucent markup rather than opaque physical volume;
- footing/slab registration differs from 2D source location;
- camera can move beneath the plan or become effectively edge-on;
- selecting one object highlights another measurement/Condition;
- sheet changes jump back because of stale selection;
- elevation/property recalculation recenters the camera and hides spatial movement;
- a held element blocks valid sibling solids;
- 3D rendering/selection changes authoritative quantity values.

When a visual defect appears, use systematic debugging: reproduce, identify whether the error is PDF texture orientation, plan transform, derived-shape geometry, camera state, material presentation, or selection mapping, then fix that root cause only. Do not stack visual tweaks over an unidentified registration/camera defect.
