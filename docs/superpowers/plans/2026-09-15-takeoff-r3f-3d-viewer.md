# Takeoff R3F 3D Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG pseudo-3D Takeoff renderer with a client-only React Three Fiber / Three.js construction-model viewer that uses the active PDF as the plan plane, renders existing `Derived3DScene` solids, and preserves Carez 2D/vector and server/domain quantity authority.

**Architecture:** Keep `buildDerived3DScene()` and its existing calibrated plan-space output as the physical projection contract. Add a narrow R3F presentation layer that consumes `Derived3DScene`, the active PDF URL/page, and stable Carez IDs; integrate it behind a temporary internal renderer gate until Milestones A–C pass browser acceptance, then remove the legacy SVG renderer.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5.9, `pdfjs-dist` 4.10, Three.js, React Three Fiber, Drei, Node test runner, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-09-15-takeoff-r3f-3d-viewer-design.md`

## Global Constraints

- Start from the current `staging` head and read the approved spec plus direct target files before editing.
- Use an isolated Codex worktree and temporary task branch. Milestones 0–D stay on that branch; do not merge implementation into `staging` until the final R3F branch has passed browser acceptance and code review.
- `staging` remains the rollback/reference baseline while R3F is being built. Use the task-branch Vercel preview for Milestone A–C visual acceptance.
- Persisted normalized page-coordinate 2D/vector geometry remains Takeoff geometry and quantity authority.
- `buildDerived3DScene()` remains physical projection authority. The renderer consumes `Derived3DSolid.shape` directly in calibrated feet and must not re-scale or recompute business geometry.
- Server/domain outputs remain quantity, cost, and pricing authority. Never derive authoritative quantity from Three.js geometry.
- No database or migration changes are part of this plan.
- Approved new dependencies are exactly `three`, `@react-three/fiber`, and `@react-three/drei`. No other dependency additions.
- No estimator-facing Split mode. The center workspace is `2D | 3D` only.
- No direct 3D geometry editing/creation in this plan. Properties remains the edit surface.
- Keep the legacy SVG renderer available through Milestones A–C for rollback/comparison. Remove it only after Milestone C browser acceptance.
- Every production-code behavior change follows RED → GREEN → REFACTOR. Run the named failing test before writing that production implementation.
- For targeted Node tests, use the repository runner directly so the package-level `tests/*.test.ts` glob does not turn a targeted command into a full-suite run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test <explicit-test-files>
```

- At every milestone run targeted tests plus `pnpm typecheck`; before each browser gate run `pnpm check`.
- Source/build success is not browser acceptance. Stop at each visual gate and obtain authenticated browser acceptance before advancing.
- When a visual defect occurs, use systematic debugging: identify whether the defect originates in PDF texture orientation, plan/world coordinates, derived-shape geometry, camera state, material/render ordering, or stable-ID selection before changing presentation values.

---

## Milestone 0 — Governance and approved renderer dependencies

### Task 1: Narrow the dependency rule and install the approved stack

**Files:**
- Modify: `CODEX.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the approved spec dependency list.
- Produces: repository governance permitting explicitly approved task/spec dependencies while continuing to forbid unrelated packages; installed R3F/Three runtime packages.

- [ ] **Step 1: Narrow the dependency rule in `CODEX.md`**

Replace Execute item 2:

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

Expected: `package.json` gains exactly these three runtime dependencies and `pnpm-lock.yaml` pins stable compatible releases. If pnpm resolves a prerelease, stop and select stable compatible versions explicitly.

- [ ] **Step 3: Verify the dependency-only change**

```bash
pnpm typecheck
pnpm test
```

Expected: both PASS with no application behavior change.

- [ ] **Step 4: Commit**

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

Create `tests/takeoff-3d-coordinates.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPagePointToWorld, planPointToWorld, sheetPlaneFrame } from '../lib/takeoff/3d/coordinates.ts';

const plane = {
  sheetId: 'A4', pageWidth: 1000, pageHeight: 800,
  scaleFtPerPdfUnit: 0.1, worldWidth: 100, worldHeight: 80,
};

test('R3F coordinates consume derived plan feet without rescaling', () => {
  assert.deepEqual(planPointToWorld({ x: 12.5, z: 24 }, -3), { x: 12.5, y: -3, z: 24 });
});

test('normalized PDF corners preserve page-right/page-down world coordinates', () => {
  assert.deepEqual(normalizedPagePointToWorld(0, 0, plane), { x: 0, y: 0, z: 0 });
  assert.deepEqual(normalizedPagePointToWorld(1, 0, plane), { x: 100, y: 0, z: 0 });
  assert.deepEqual(normalizedPagePointToWorld(0, 1, plane), { x: 0, y: 0, z: 80 });
  assert.deepEqual(normalizedPagePointToWorld(1, 1, plane), { x: 100, y: 0, z: 80 });
});

test('sheet plane is centered on exact derived world extents', () => {
  assert.deepEqual(sheetPlaneFrame(plane), {
    width: 100,
    height: 80,
    center: [50, 0, 40],
    rotation: [-Math.PI / 2, 0, 0],
  });
});
```

The `-Math.PI / 2` rotation is intentional: Three `PlaneGeometry` local +Y is the page top, so after rotation the local top maps toward world Z=0 and local bottom maps toward positive page-down Z.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-coordinates.test.ts
```

Expected: FAIL because `lib/takeoff/3d/coordinates.ts` does not exist.

- [ ] **Step 3: Implement the minimal helpers**

Create `lib/takeoff/3d/coordinates.ts`:

```ts
import type { Derived3DPlanPoint, Derived3DSheetPlane } from '@/lib/takeoff/conditions/derived3d/contracts';

export const PLAN_DATUM_Y = 0;
export type WorldPoint3 = { x: number; y: number; z: number };
export type SheetPlaneFrame = {
  width: number;
  height: number;
  center: [number, number, number];
  rotation: [number, number, number];
};

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

Do not import/call `toPlanPoint()` here. That normalized-PDF-to-feet conversion already occurred upstream in `buildDerived3DScene()`.

- [ ] **Step 4: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-coordinates.test.ts
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

```ts
export type Takeoff3DCameraMemory = {
  azimuth: number;
  polar: number;
  zoom: number;
  target: [number, number, number];
};
export const HOME_AZIMUTH: number;
export const HOME_POLAR: number;
export const MIN_POLAR: number;
export const MAX_POLAR: number;
export function sanitizeCameraMemory(value: Takeoff3DCameraMemory): Takeoff3DCameraMemory;
export function homeCameraMemory(width: number, height: number, viewportWidth: number, viewportHeight: number): Takeoff3DCameraMemory;
export function topCameraMemory(width: number, height: number, viewportWidth: number, viewportHeight: number): Takeoff3DCameraMemory;
export function cameraPositionForMemory(memory: Takeoff3DCameraMemory, width: number, height: number): [number, number, number];
export function shouldInitializeCamera(previousSheetId: string | null, nextSheetId: string | null, hasMemory: boolean): boolean;
```

- [ ] **Step 1: Write failing camera tests**

Use:

```ts
export const MIN_POLAR = Math.PI / 90;            // 2° from vertical
export const MAX_POLAR = 5 * Math.PI / 12;       // 75° from vertical = 15° above plan
export const HOME_AZIMUTH = -Math.PI / 4;
export const HOME_POLAR = 53 * Math.PI / 180;     // ~37° above plan
```

Test:

```ts
assert.equal(sanitizeCameraMemory({ azimuth: 0, polar: Math.PI, zoom: 0, target: [1,2,3] }).polar, MAX_POLAR);
assert.deepEqual(homeCameraMemory(100, 80, 1200, 800).target, [50, 0, 40]);
assert.deepEqual(topCameraMemory(100, 80, 1200, 800).target, [50, 0, 40]);
assert.equal(topCameraMemory(100, 80, 1200, 800).polar, MIN_POLAR);
assert.ok(homeCameraMemory(100, 80, 1200, 800).zoom > 0);
assert.ok(cameraPositionForMemory(homeCameraMemory(100,80,1200,800),100,80)[1] > 0);
assert.equal(shouldInitializeCamera('A4','A4',true), false);
assert.equal(shouldInitializeCamera('A4','A5',false), true);
assert.equal(shouldInitializeCamera('A4','A5',true), false);
```

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-camera.test.ts
```

Expected: FAIL because the camera module does not exist.

- [ ] **Step 3: Implement camera helpers**

Home framing must be governed by the PDF sheet, never by concrete extents:

```ts
const margin = 1.22;
const diagonal = Math.hypot(width, height) * margin;
const fitPixels = Math.min(viewportWidth, viewportHeight);
const zoom = Math.max(0.05, Math.min(40, fitPixels / diagonal));
```

Clamp restored `polar` to `[MIN_POLAR, MAX_POLAR]`, `zoom` to `[0.05, 40]`, and non-finite target coordinates to a safe sheet-center target.

For camera position use a radius independent of orthographic zoom:

```ts
const radius = Math.max(100, Math.hypot(width, height) * 2);
const sinPolar = Math.sin(memory.polar);
const offset: [number, number, number] = [
  radius * sinPolar * Math.sin(memory.azimuth),
  radius * Math.cos(memory.polar),
  radius * sinPolar * Math.cos(memory.azimuth),
];
return [memory.target[0] + offset[0], memory.target[1] + offset[1], memory.target[2] + offset[2]];
```

- [ ] **Step 4: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-camera.test.ts
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

```ts
const size = computePlanTextureSize(1000, 800, 1200, 800);
assert.equal(Math.max(size.width, size.height) <= 4096, true);
assert.equal(Number((size.width / size.height).toFixed(6)), 1.25);
assert.equal(size.width >= 2000, true);
```

Also verify a very large viewport caps the longest side at 4096 and a portrait page preserves its source aspect ratio.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-plan.test.ts
```

Expected: FAIL because `planTexture.ts` does not exist.

- [ ] **Step 3: Implement texture sizing and direct PDF.js rendering**

`computePlanTextureSize()` targets about 2× displayed resolution, caps the longest texture dimension at 4096, and preserves page ratio.

`renderPdfPageCanvas()` follows the existing Carez PDF.js worker convention:

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

Honor `AbortSignal` before/after asynchronous work. On abort/error, cancel/destroy the loading task/document when those objects have been created.

- [ ] **Step 4: Implement `Takeoff3DPlan`**

Create a `THREE.CanvasTexture` from the rendered page and configure:

```ts
texture.colorSpace = THREE.SRGBColorSpace;
texture.flipY = true;
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.generateMipmaps = true;
texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
```

Use `sheetPlaneFrame(plane)` and exact `worldWidth × worldHeight` `planeGeometry`. Render the plan as a visualization reference rather than an opaque depth occluder:

```tsx
<mesh position={frame.center} rotation={frame.rotation} renderOrder={-20}>
  <planeGeometry args={[frame.width, frame.height]} />
  <meshBasicMaterial
    map={texture}
    color="#ffffff"
    side={THREE.DoubleSide}
    depthWrite={false}
    depthTest={false}
    transparent={false}
  />
</mesh>
```

This ordering is deliberate: below-datum footing/slab geometry must remain visible to the estimator instead of disappearing behind the PDF plane. Add a thin neutral `<Edges>` border. A second slightly enlarged dark plane at `y=-0.03`, `renderOrder={-21}`, low opacity, `depthWrite={false}`, and `depthTest={false}` may provide the approved restrained sheet shadow; it must not obscure plan content.

Dispose the texture on replacement/unmount. Do not query/capture the existing 2D `<canvas>`.

If the async PDF render fails, store the error in component state and throw it during render so the viewer error boundary can provide the normal 2D-safe fallback.

- [ ] **Step 5: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-plan.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/takeoff/3d/planTexture.ts tests/takeoff-3d-plan.test.ts components/takeoff/3d/Takeoff3DPlan.tsx
git commit -m "feat(takeoff): add direct pdf texture plane"
```

### Task 5: Build the shared view state, client-only R3F scene, controls, toolbar, and error boundary

**Files:**
- Create: `lib/takeoff/3d/viewState.ts`
- Create: `components/takeoff/3d/Takeoff3DViewport.tsx`
- Create: `components/takeoff/3d/Takeoff3DScene.tsx`
- Create: `components/takeoff/3d/Takeoff3DControls.tsx`
- Create: `components/takeoff/3d/Takeoff3DToolbar.tsx`
- Create: `components/takeoff/3d/Takeoff3DErrorBoundary.tsx`
- Create: `components/takeoff/3d/useTakeoff3DCamera.ts`
- Create: `components/takeoff/3d/Takeoff3DViewport.module.css`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:**

`lib/takeoff/3d/viewState.ts`:

```ts
export type Derived3DViewState = {
  hidden: string[];
  isolated: string | null;
  zone: string;
  elevation: string;
};

export const DEFAULT_DERIVED_3D_VIEW_STATE: Derived3DViewState = {
  hidden: [], isolated: null, zone: 'all', elevation: 'all',
};
```

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

- [ ] **Step 1: Make the existing source-contract test expect R3F foundation files**

Update `tests/qa-condition-workstation.test.ts` to read the new files and require:

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

Keep legacy-viewer assertions only where they intentionally protect fallback behavior through Milestone C; remove assertions that require SVG/canvas capture as the target implementation.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

Expected: FAIL because R3F scene/viewport components are missing.

- [ ] **Step 3: Implement the scene foundation**

`Takeoff3DScene` renders:

```tsx
<Canvas
  orthographic
  dpr={[1, 2]}
  gl={{ antialias: true, alpha: false }}
  camera={{ near: 0.1, far: 10000 }}
>
  <color attach="background" args={['#090d12']} />
  <hemisphereLight intensity={0.9} groundColor="#111827" />
  <directionalLight position={[40, 80, -30]} intensity={1.15} />
  <Takeoff3DPlan ... />
  <Takeoff3DControls ... />
</Canvas>
```

No concrete solids render yet. If real sheet dimensions/elevations show that `far:10000` is insufficient, compute a larger far plane from sheet diagonal/elevation span rather than hardcoding an unrelated global value.

- [ ] **Step 4: Implement camera controls and per-sheet memory**

`useTakeoff3DCamera` owns `Map<string, Takeoff3DCameraMemory>` in a ref. Camera position is derived with `cameraPositionForMemory()`. Write memory on OrbitControls `end`, not on every animation frame.

`Takeoff3DControls` uses Drei `OrbitControls`:

```tsx
<OrbitControls
  minPolarAngle={MIN_POLAR}
  maxPolarAngle={MAX_POLAR}
  enableDamping
  dampingFactor={0.08}
  makeDefault
/>
```

Implement explicit `home()`, `top()`, and `focusSelected()` actions. Only first load without memory, active-sheet change without memory, or these explicit commands may reframe. Changes to `scene.hash`, geometry keys, Conditions, or selection must not invoke Home.

- [ ] **Step 5: Implement toolbar and error UI outside the Canvas**

Primary controls: `Home`, `Top`, `Focus`, Filters, and `3D checks N`. Reuse Carez `Button` and Lucide icons.

Error fallback text is exactly:

```text
3D unavailable
Your 2D Takeoff and quantities remain available.
```

Include `Retry 3D`, which remounts only the 3D viewer.

- [ ] **Step 6: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts tests/takeoff-3d-coordinates.test.ts tests/takeoff-3d-camera.test.ts tests/takeoff-3d-plan.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/takeoff/3d/viewState.ts components/takeoff/3d tests/qa-condition-workstation.test.ts
git commit -m "feat(takeoff): add r3f pdf viewer foundation"
```

### Task 6: Integrate the R3F foundation behind an internal renderer gate

**Files:**
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.tsx`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.module.css`
- Modify: `components/takeoff/TakeoffDerived3DView.tsx`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:**
- Consumes: existing `derived3DScene`, `workspaceProps.pdfUrl`, `activeSheetId`, `activeSheet.page_number`, selected IDs, and existing selection/issue callbacks.
- Produces: developer-only `legacy-svg | r3f` renderer choice. Estimator UI remains `2D | 3D`.
- Shared `Derived3DViewState` now comes from `lib/takeoff/3d/viewState.ts`, so legacy deletion in Milestone D cannot remove the state contract.

- [ ] **Step 1: Add failing integration assertions**

Require:

```ts
assert.match(workstation, /NEXT_PUBLIC_CAREZ_3D_RENDERER/);
assert.match(workstation, /dynamic\(/);
assert.match(workstation, /ssr:\s*false/);
assert.match(workstation, /pdfUrl=\{workspaceProps\.pdfUrl\}/);
assert.match(workstation, /activePageNumber=\{Number\(activeSheet\?\.page_number\|\|1\)\}/);
assert.doesNotMatch(workstation, /\['2d','3d','split'\]/);
```

Also require the workstation to import `Derived3DViewState` / `DEFAULT_DERIVED_3D_VIEW_STATE` from `@/lib/takeoff/3d/viewState` rather than from the legacy component.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Share the view-state type with legacy during migration**

In `TakeoffDerived3DView.tsx`, remove its local exported `Derived3DViewState` declaration and import the shared type:

```ts
import type { Derived3DViewState } from '@/lib/takeoff/3d/viewState';
```

Keep `Derived3DViewMemory` legacy-local until Milestone D.

In `IntegratedTakeoffConditionWorkspace.tsx`, initialize:

```ts
const [derivedViewState,setDerivedViewState] = useState<Derived3DViewState>(DEFAULT_DERIVED_3D_VIEW_STATE);
```

- [ ] **Step 4: Add the client-only dynamic R3F import and developer gate**

```ts
import dynamic from 'next/dynamic';

const Takeoff3DViewport = dynamic(
  () => import('./3d/Takeoff3DViewport').then(module => module.Takeoff3DViewport),
  { ssr: false },
);

const rendererMode = process.env.NEXT_PUBLIC_CAREZ_3D_RENDERER === 'legacy-svg' ? 'legacy-svg' : 'r3f';
```

Change `ViewMode` to exactly `'2d'|'3d'`. The estimator-facing tabs map only `['2d','3d']`.

When `viewMode === '3d'`, render either legacy or R3F according to the internal gate. Pass `scene`, exact `workspaceProps.pdfUrl`, `activeSheetId`, `Number(activeSheet?.page_number||1)`, selected IDs, shared view state, `selectDerivedSolid`, and `jumpToDerivedIssue`.

- [ ] **Step 5: Simplify overlay CSS for one full center viewport**

Keep the overlay anchored over the drawing center excluding the visible sheet navigator and quantity dock. Remove Split-specific selectors/classes. Preserve responsive `left:0` behavior when the navigator is hidden on narrow layouts.

- [ ] **Step 6: Verify integration**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
pnpm typecheck
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/takeoff/IntegratedTakeoffConditionWorkspace.tsx components/takeoff/IntegratedTakeoffConditionWorkspace.module.css components/takeoff/TakeoffDerived3DView.tsx tests/qa-condition-workstation.test.ts
git commit -m "feat(takeoff): gate r3f viewer in drawing workspace"
```

### Milestone A browser gate — STOP before concrete meshes

Run `pnpm check`, push the task branch, and use its authenticated Vercel preview. Do not merge into `staging`.

Verify the real A4 sheet:

1. `2D -> 3D` replaces only the center drawing viewport.
2. The actual A4 PDF is a crisp white plan plane.
3. Notes/dimensions are readable at Home angle.
4. PDF is not mirrored, upside-down, stretched, or sheared.
5. Home frames the complete sheet; Top is exact plan view.
6. Orbit cannot move below the sheet or collapse to an unusable edge-on view.
7. Pan/zoom remain stable.
8. Below-datum geometry would remain visible because the PDF reference plane does not write/test depth against solids.
9. `3D -> 2D -> 3D` restores a sane per-sheet camera.

Do not start Milestone B until the user explicitly accepts this gate.

---

## Milestone B — Real physical Takeoff meshes

### Task 7: Convert `Derived3DShape` to flat-shaded grouped Three geometry

**Files:**
- Create: `lib/takeoff/3d/meshGeometry.ts`
- Create: `tests/takeoff-3d-mesh-geometry.test.ts`

**Interfaces:**

```ts
export function buildTakeoffMeshGeometry(shape: Derived3DShape): THREE.BufferGeometry;
```

Material groups are fixed:

```text
group 0 = top
group 1 = sides
group 2 = bottom
```

- [ ] **Step 1: Write failing geometry tests**

Cover current contracts:

```ts
const slab = buildTakeoffMeshGeometry({
  kind:'prism',
  outer:[{x:0,z:0},{x:10,z:0},{x:10,z:8},{x:0,z:8}],
  holes:[], bottom:-1, top:0,
});
slab.computeBoundingBox();
assert.equal(slab.boundingBox?.min.y, -1);
assert.equal(slab.boundingBox?.max.y, 0);
assert.equal(slab.groups.some(group => group.materialIndex === 0), true);
assert.equal(slab.groups.some(group => group.materialIndex === 1), true);
assert.equal(slab.groups.some(group => group.materialIndex === 2), true);
```

Also verify:

- a rectangular slab hole is absent from top triangulation;
- `topOuter` trapezoid width can differ from bottom width while preserving exact `bottom` / `top` Y values;
- box dimensions and center are exact;
- a +90° domain yaw rotates the box long axis from +X toward +Z, matching the existing `boxCorners()` convention; therefore the Three Y rotation is `-shape.yawRad`;
- a shape with `top-bottom === 1` remains exactly one world foot high; renderer performs no unit conversion.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-mesh-geometry.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement prism geometry**

For prism top/bottom rings, use `THREE.ShapeUtils.triangulateShape()` on `THREE.Vector2(x,z)` coordinates. Normalize winding before triangulation: outer contour counter-clockwise and holes clockwise in the X/Z plane. Emit top triangles in upward-facing order and bottom triangles reversed.

Build vertical side quads explicitly for outer and hole rings. For `topOuter`, require `topOuter.length === outer.length` and connect corresponding bottom/top vertices. Current tapered strip shapes have no holes; if `topOuter` and `holes.length > 0`, throw:

```text
Unsupported tapered prism with holes.
```

Do not invent topology.

- [ ] **Step 4: Implement box geometry with the same domain yaw convention**

Do not rely on `BoxGeometry` material groups. Build the eight transformed box corners and six faces explicitly so the same top/sides/bottom material-group contract is preserved.

For each unrotated local point `[x,z]`, apply the existing domain transform:

```ts
const cos = Math.cos(shape.yawRad);
const sin = Math.sin(shape.yawRad);
const worldX = shape.centerX + x * cos - z * sin;
const worldZ = shape.centerZ + x * sin + z * cos;
```

This is equivalent to Three Y rotation `-shape.yawRad` and must remain locked by the +90° test.

- [ ] **Step 5: Ensure flat physical faces**

Build face-local vertices or convert to non-indexed geometry before `computeVertexNormals()` so vertical corners do not receive smoothed normals. Keep material groups intact and verify them after conversion. Compute bounding box/sphere.

- [ ] **Step 6: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-mesh-geometry.test.ts tests/derived-3d.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

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
export function sheetSolidsForSelection(scene: Derived3DScene, activeSheetId: string | null): Derived3DSolid[];
export function selectedSolidForMeasurement(solids: Derived3DSolid[], measurementId: string | null): Derived3DSolid | null;
```

- [ ] **Step 1: Write failing stable-ID tests**

```ts
assert.deepEqual(solidSelectionIdentity(solidA), {
  solidId: solidA.id,
  measurementId: solidA.measurementId,
  conditionVersionId: solidA.conditionVersionId,
  sheetId: solidA.sheetId,
});
assert.notEqual(solidSelectionIdentity(solidA).measurementId, solidSelectionIdentity(solidB).measurementId);
assert.equal(selectedSolidForMeasurement(sheetSolidsForSelection(scene,'A5'),'measurement-on-A4'), null);
```

No test may select by color, label, array index, or approximate geometry.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-selection.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement selection helpers and solid rendering**

`Takeoff3DSolid` memoizes geometry by `solid.geometryKey` and disposes it on replacement/unmount.

Use three `MeshStandardMaterial`s matching geometry groups. Derive presentation colors from `solid.color` via `THREE.Color` HSL lightness adjustments:

- top: source color or a restrained lightness increase;
- sides: darker source color;
- bottom: darkest source color;
- `roughness`: 0.85;
- `metalness`: 0;
- `flatShading`: true;
- opaque normal geometry.

Use Drei `<Edges>` with thin dark edges. Selected state increases edge contrast and adds a small emissive/brightness lift. Hover only changes local hover/edge state and cursor; it must not select.

Set mesh `userData` to `solidSelectionIdentity(solid)`. `onClick` calls `event.stopPropagation()` and then `onSelect(solid)`.

- [ ] **Step 4: Render every valid active-sheet solid**

In `Takeoff3DScene`, derive active-sheet solids with `sheetSolidsForSelection()`, then apply existing `viewState.hidden`, `isolated`, `zone`, and `elevation` filters. Selection controls highlight only, never model existence.

A low-opacity Drei `ContactShadows` may be placed at the plan datum only if A4 browser review shows it improves depth without obscuring PDF linework. If it reduces plan readability, omit it; the approved visual requirement is restrained depth, not a mandatory shadow implementation.

- [ ] **Step 5: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-selection.test.ts tests/takeoff-3d-mesh-geometry.test.ts tests/derived-3d.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/takeoff/3d/Takeoff3DSolid.tsx components/takeoff/3d/Takeoff3DScene.tsx components/takeoff/3d/Takeoff3DViewport.tsx lib/takeoff/3d/selection.ts tests/takeoff-3d-selection.test.ts
git commit -m "feat(takeoff): render derived solids in r3f"
```

### Milestone B browser gate — STOP before synchronization work

Run `pnpm check`, push the task branch, and review its authenticated Vercel preview.

Verify the real A4 sheet:

1. Every supported A4 Takeoff appears automatically; selection is not required to render it.
2. Green footing and blue slab sit exactly over their 2D source locations.
3. Condition colors are recognizable; top/side depth is obvious without transparency.
4. Footing corners read as one continuous physical footing.
5. Slab holes/openings remain open.
6. Different elevations are visibly separated relative to the PDF plane, including below-datum solids.
7. Clicking a mesh visibly selects it in the R3F scene without moving/reframing the camera.
8. PDF remains readable and is not visually dominated by lighting/shadows.

Do not start Milestone C until the user explicitly accepts this gate.

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
- No new global store or parallel selection event system.

- [ ] **Step 1: Add failing synchronization assertions**

`qa-condition-workstation.test.ts` must require that R3F receives `selectedMeasurementId` and calls the existing `selectDerivedSolid` callback.

Extend `takeoff-3d-selection.test.ts` to verify A4 selection cannot resolve to an A5 mesh and two same-color solids remain distinguishable by IDs.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-selection.test.ts tests/qa-condition-workstation.test.ts
```

Expected: FAIL for the new synchronization contract.

- [ ] **Step 3: Implement exact stable-ID flow**

Use only:

```text
2D click -> existing requestMeasurementSelection -> selectedMeasurementId -> R3F highlight
3D click -> onSelectSolid(solid) -> existing requestConditionSelection(conditionVersionId,false,measurementId)
```

Do not dispatch a new parallel selection event from R3F.

When active sheet changes, R3F filters to that sheet immediately. If `selectedMeasurementId` does not exist among active-sheet solids, R3F renders no selected mesh. Existing workstation state remains responsible for authoritative selection/focus.

- [ ] **Step 4: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-selection.test.ts tests/qa-condition-workstation.test.ts
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
- Camera resets only on explicit Home/Top/Focus or first load of a sheet with no saved memory.

- [ ] **Step 1: Add failing persistence tests**

Extend camera tests so `sanitizeCameraMemory()` clamps invalid polar/zoom but preserves a finite target exactly, and `shouldInitializeCamera()` has the A4/A5 behavior defined in Task 3.

- [ ] **Step 2: Verify RED for any missing behavior**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-camera.test.ts
```

Expected: FAIL if the integration-required behavior is not yet implemented.

- [ ] **Step 3: Implement camera initialization rules**

Do not include `scene.hash`, `solid.geometryKey`, selected ID, Condition revision, or derived issue count in any effect that triggers Home fitting. Updating elevation/thickness/profile regenerates geometry while camera position/target/zoom remain unchanged.

Persist camera only on OrbitControls `end` and explicit toolbar actions.

- [ ] **Step 4: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-camera.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/takeoff/3d/useTakeoff3DCamera.ts components/takeoff/3d/Takeoff3DControls.tsx lib/takeoff/3d/camera.ts tests/takeoff-3d-camera.test.ts
git commit -m "fix(takeoff): preserve r3f camera across recalculation"
```

### Task 11: Port partial-model holds, filters, and 3D checks

**Files:**
- Modify: `components/takeoff/3d/Takeoff3DViewport.tsx`
- Modify: `components/takeoff/3d/Takeoff3DToolbar.tsx`
- Modify: `components/takeoff/3d/Takeoff3DViewport.module.css`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:**
- Shared `Derived3DViewState` remains in `lib/takeoff/3d/viewState.ts`.
- Preserve `onJumpToIssue(issue)` so `Resolve input` continues routing into existing Properties tabs.

- [ ] **Step 1: Add failing source-contract assertions**

Require R3F viewport to:

- compute `sheetIssues` from `scene.issues` scoped to `activeSheetId`;
- find selected `3d_input_required` / `unsupported_projection` issue by `selectedMeasurementId`;
- keep valid sibling solids visible when selected element is held;
- expose `Resolve input` and `3D checks N` in normal DOM;
- preserve filters/hide/isolate without mutating `scene.sourceQuantities`.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement issue/filter UI**

Use distinct copy:

```text
3D input required
```

for missing governed data, and:

```text
3D unavailable for this Takeoff
```

for unsupported projection.

If at least one sibling solid is valid, keep Canvas visible and overlay only the selected issue notice. If no solids are valid, keep the PDF plan visible where possible and show a centered issue state rather than a blank dark screen.

- [ ] **Step 4: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts tests/derived-3d.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/takeoff/3d/Takeoff3DViewport.tsx components/takeoff/3d/Takeoff3DToolbar.tsx components/takeoff/3d/Takeoff3DViewport.module.css tests/qa-condition-workstation.test.ts
git commit -m "feat(takeoff): port 3d checks and filters to r3f"
```

### Task 12: Run the complete Milestone C automated regression

**Files:**
- Production files: none expected.
- Test files may change only when a reproduced failing regression proves the test or implementation contract is incomplete.

- [ ] **Step 1: Run targeted renderer/domain tests**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test \
  tests/derived-3d.test.ts \
  tests/qa-condition-workstation.test.ts \
  tests/takeoff-3d-coordinates.test.ts \
  tests/takeoff-3d-camera.test.ts \
  tests/takeoff-3d-plan.test.ts \
  tests/takeoff-3d-mesh-geometry.test.ts \
  tests/takeoff-3d-selection.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broad repository gate**

```bash
pnpm check
```

Expected: typecheck, full domain tests, and production build all PASS.

- [ ] **Step 3: Audit renderer files for quantity-authority leakage**

```bash
grep -R "raw_quantity\|production_quantity\|direct_cost\|sourceQuantities" components/takeoff/3d lib/takeoff/3d || true
```

Expected: no arithmetic or persistence involving authoritative quantities. `sourceQuantities` may appear only for read-only integrity/display if explicitly necessary.

- [ ] **Step 4: Commit only reproduced regression fixes**

If Task 12 produced a real test/implementation fix:

```bash
git add tests components/takeoff/3d lib/takeoff/3d
git commit -m "test(takeoff): verify r3f workstation regression"
```

If no files changed, do not create an empty commit.

### Milestone C authenticated browser gate — STOP before deleting legacy

Push the task branch and use its authenticated Vercel preview.

Acceptance sequence:

1. Open A4 in 2D and select the blue slab.
2. Switch to 3D; A4 remains the PDF plane, every supported A4 solid renders, blue slab is selected.
3. Click the green footing in 3D; Properties and Quantity Worksheet switch to that exact footing.
4. Return to 2D; the exact source footing measurement is selected.
5. Select A5; both views follow A5 and do not jump back to A4.
6. Return to A4; its prior sane camera restores.
7. Change a governed elevation/reference in Properties, Save & recalculate, leave camera untouched, and confirm the solid moves vertically relative to the fixed PDF plane.
8. Confirm view switching/selection alone never changes worksheet quantity. A legitimate domain input edit may change server/domain outputs only through normal recalculation.
9. Clear one required 3D physical input on a QA draft; valid sibling solids still render and the selected held element shows the exact resolution message. Restore the value.
10. Orbit/pan/zoom/Home/Top/Focus remain stable and plan text remains readable.

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

**Interfaces:**
- R3F becomes the only 3D renderer.
- `Derived3DViewState` remains in `lib/takeoff/3d/viewState.ts`.
- R3F camera memory remains in the new camera module/hook; legacy `Derived3DViewMemory` disappears with the legacy component.
- `Derived3DScene`, stable selection callbacks, and authoritative domain contracts remain unchanged.

- [ ] **Step 1: Make the test fail for any remaining legacy reference**

Update `qa-condition-workstation.test.ts`:

```ts
assert.doesNotMatch(workstation, /NEXT_PUBLIC_CAREZ_3D_RENDERER/);
assert.doesNotMatch(workstation, /TakeoffDerived3DView/);
assert.doesNotMatch(workspaceStyles, /derivedOverlaySplit/);
```

Remove the test’s reads/assertions for deleted `TakeoffDerived3DView.tsx` and `.module.css`.

- [ ] **Step 2: Verify RED before deletion**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

Expected: FAIL while legacy references still exist.

- [ ] **Step 3: Delete legacy and make R3F unconditional in 3D mode**

Remove the environment renderer gate, legacy imports, `Derived3DViewMemory` ref, SVG-specific CSS, and Split compatibility selectors. Keep the client-only dynamic R3F import.

Do not delete `lib/takeoff/conditions/derived3d.ts`, `derived3d/contracts.ts`, `derived3d/checks.ts`, `derived3d/coordinates.ts`, or source-resolution code. Those remain domain projection authority.

- [ ] **Step 4: Verify GREEN and broad regression**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test \
  tests/qa-condition-workstation.test.ts \
  tests/derived-3d.test.ts \
  tests/takeoff-3d-coordinates.test.ts \
  tests/takeoff-3d-camera.test.ts \
  tests/takeoff-3d-plan.test.ts \
  tests/takeoff-3d-mesh-geometry.test.ts \
  tests/takeoff-3d-selection.test.ts
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A components/takeoff tests lib/takeoff/3d
git commit -m "refactor(takeoff): retire svg 3d renderer"
```

### Task 14: Final branch verification, review, and promotion checkpoint

**Files:**
- Modify only when current-state docs are proven stale by the accepted implementation: `docs/concrete-condition-3d-workstation-target.md`, `docs/modules/takeoff.md`.
- GitHub: implementation PR targeting `staging`; Issue #41 acceptance comment after promotion.

- [ ] **Step 1: Run exact-head verification on the task branch**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 2: Run legacy-reference audit**

```bash
grep -R "TakeoffDerived3DView\|derivedOverlaySplit\|NEXT_PUBLIC_CAREZ_3D_RENDERER" components tests lib || true
```

Expected: zero results.

- [ ] **Step 3: Invoke code review before promotion**

Use `superpowers:requesting-code-review`. Resolve only technically verified review findings; if feedback is unclear or questionable, use `superpowers:receiving-code-review` before changing code.

- [ ] **Step 4: Push final task-branch head and obtain final browser acceptance**

Use the exact branch SHA and its authenticated Vercel preview. Repeat the complete Milestone C browser sequence after legacy removal. Record video/screenshots of Home, rotated view, selected slab, selected footing, fixed-camera elevation change, and return to 2D.

- [ ] **Step 5: Open a PR to `staging` and stop for user approval**

PR body must include:

- final task-branch SHA;
- `pnpm check` PASS;
- targeted R3F test PASS;
- exact preview deployment/URL and READY state;
- browser acceptance result;
- explicit 2D/vector + server/domain authority statement;
- explicit statement that direct 3D geometry editing remains deferred.

Do not merge until the user explicitly approves promotion.

- [ ] **Step 6: After approval, merge to `staging` and verify the exact staging SHA**

Confirm the staging Vercel deployment is READY for the exact merged SHA. Perform a short staging smoke: A4 `2D -> 3D -> 2D`, one 3D selection, one sheet switch, and quantity worksheet unchanged by view switching.

- [ ] **Step 7: Update Issue #41 acceptance record**

Record:

- exact staging SHA;
- `pnpm check` result;
- Vercel READY deployment for exact SHA;
- authenticated browser PASS for Issue #41 Parts 1–2;
- persisted 2D/vector geometry and server/domain quantity authority remain unchanged;
- direct 3D geometry editing remains a separate future design/governance task.

- [ ] **Step 8: Commit current-state documentation only if it actually changed**

If either current-state document is stale, update it before the final PR and commit:

```bash
git add docs/concrete-condition-3d-workstation-target.md docs/modules/takeoff.md
git commit -m "docs(takeoff): record accepted r3f 3d viewer"
```

If neither document is stale, do not create a documentation commit.

---

## Visual execution instructions for Codex + GPT-6 Astra

At every browser gate, compare the rendered result to the approved **Style A construction-model** target. The implementation is not accepted merely because WebGL works.

Reject and debug before advancing if any of these occur:

- PDF plan is blurry, mirrored, flipped, stretched, sheared, washed out, or unreadable at Home angle;
- concrete looks like translucent markup rather than opaque physical volume;
- footing/slab registration differs from the source 2D Takeoff location;
- below-datum concrete disappears behind the PDF reference plane;
- camera can move beneath the plan or become effectively edge-on;
- selecting one mesh activates another measurement/Condition;
- sheet changes jump backward because of stale selection;
- elevation/property recalculation recenters the camera and hides spatial movement;
- one held element blocks valid sibling solids;
- 3D rendering/selection changes authoritative quantity values.

For a registration/rendering defect, reproduce it first and identify the failing boundary—PDF texture orientation, page/world coordinate mapping, `Derived3DShape -> BufferGeometry`, camera state, render/depth ordering, or stable-ID selection. Fix that root cause only; do not stack visual tweaks over an unidentified defect.
