# Takeoff R3F 3D Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG pseudo-3D Takeoff renderer with a client-only React Three Fiber / Three.js construction-model viewer that uses the active PDF as the plan plane, renders existing `Derived3DScene` solids, and preserves Carez 2D/vector and server/domain quantity authority.

**Architecture:** Keep `buildDerived3DScene()` and its calibrated plan-space output as physical projection authority. Add an R3F presentation layer consuming `Derived3DScene`, the active PDF URL/page, and stable Carez IDs; keep the existing SVG viewer only as an internal migration fallback until R3F passes the authenticated Milestone C gate, then remove it.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5.9, `pdfjs-dist` 4.10, Three.js, React Three Fiber, Drei, Node test runner, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-09-15-takeoff-r3f-3d-viewer-design.md`

## Global Constraints

- Start from current `staging`; read the approved spec and direct target files before editing.
- Use an isolated Codex worktree and temporary task branch. Keep Milestones 0–D on that branch; do not merge implementation into `staging` until final branch browser acceptance and code review pass.
- Use the task-branch Vercel preview for Milestone A–C visual gates. `staging` stays the rollback/reference baseline during the rebuild.
- Persisted normalized page-coordinate 2D/vector geometry remains Takeoff geometry and quantity authority.
- `buildDerived3DScene()` remains physical projection authority. `Derived3DSolid.shape` is already calibrated plan-space feet: X page-right, Z page-down, Y elevation. Never apply measurement scale again in R3F.
- Server/domain outputs remain quantity, cost, and pricing authority. Three.js does not calculate or persist authoritative quantities.
- No database/migration changes.
- Approved new dependencies are exactly `three`, `@react-three/fiber`, and `@react-three/drei`.
- No estimator-facing Split mode. Product UI is `2D | 3D` only.
- No direct 3D geometry editing/creation in this implementation. Properties remains the edit surface.
- Keep the legacy SVG renderer through Milestones A–C; delete it only after explicit Milestone C browser acceptance.
- Follow RED → GREEN → REFACTOR for production behavior changes. Run the named failing test before implementing the corresponding behavior.
- All targeted test commands below invoke Node directly with explicit test paths. Do not use `pnpm test -- <path>` because the package script already expands `tests/*.test.ts`.
- Before every browser gate run `pnpm check`.
- Build/source success is not visual acceptance.
- At Codex launch, attach the two user-approved reference images (2D source and desired 3D construction model) plus the latest bad-result comparison video. Do not commit those review assets to the repository.
- When a visual defect occurs, use systematic debugging and identify the failing boundary—PDF texture orientation, plan/world coordinates, derived-shape geometry, camera state, render/depth ordering, or stable-ID selection—before changing visual parameters.

---

## Milestone 0 — Governance and renderer dependencies

### Task 1: Authorize and install only the approved renderer stack

**Files:**
- Modify: `CODEX.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces repository governance permitting explicitly approved task/spec dependencies while still forbidding unrelated packages.

- [ ] **Step 1: Narrow `CODEX.md` dependency governance**

Replace Execute item 2:

```text
Make the smallest coherent diff; no unrelated refactor or new dependency.
```

with:

```text
Make the smallest coherent diff; no unrelated refactor or dependency. Add a dependency only when the task prompt or an approved repository spec explicitly authorizes it, and add only the authorized packages.
```

Do not alter the existing 2D/vector authority rule.

- [ ] **Step 2: Install the approved packages**

```bash
pnpm add three @react-three/fiber @react-three/drei
```

Expected: only those three runtime dependencies are added. Reject prerelease resolutions; use stable React-19-compatible releases.

- [ ] **Step 3: Verify no baseline regression**

```bash
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add CODEX.md package.json pnpm-lock.yaml
git commit -m "chore(takeoff): authorize r3f viewer dependencies"
```

---

## Milestone A — Professional PDF-backed R3F construction viewer

### Task 2: Lock the R3F coordinate contract

**Files:**
- Create: `lib/takeoff/3d/coordinates.ts`
- Create: `tests/takeoff-3d-coordinates.test.ts`

**Interfaces:**

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

- [ ] **Step 1: Write failing tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPagePointToWorld, planPointToWorld, sheetPlaneFrame } from '../lib/takeoff/3d/coordinates.ts';

const plane = {
  sheetId: 'A4', pageWidth: 1000, pageHeight: 800,
  scaleFtPerPdfUnit: 0.1, worldWidth: 100, worldHeight: 80,
};

test('R3F consumes derived plan feet without rescaling', () => {
  assert.deepEqual(planPointToWorld({ x: 12.5, z: 24 }, -3), { x: 12.5, y: -3, z: 24 });
});

test('PDF normalized corners preserve page-right/page-down coordinates', () => {
  assert.deepEqual(normalizedPagePointToWorld(0, 0, plane), { x: 0, y: 0, z: 0 });
  assert.deepEqual(normalizedPagePointToWorld(1, 0, plane), { x: 100, y: 0, z: 0 });
  assert.deepEqual(normalizedPagePointToWorld(0, 1, plane), { x: 0, y: 0, z: 80 });
  assert.deepEqual(normalizedPagePointToWorld(1, 1, plane), { x: 100, y: 0, z: 80 });
});

test('sheet plane uses exact derived world extents', () => {
  assert.deepEqual(sheetPlaneFrame(plane), {
    width: 100,
    height: 80,
    center: [50, 0, 40],
    rotation: [-Math.PI / 2, 0, 0],
  });
});
```

`-Math.PI/2` is intentional: Three `PlaneGeometry` local top (+Y) maps toward world Z=0 and local bottom maps toward positive page-down Z.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-coordinates.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement**

```ts
import type { Derived3DPlanPoint, Derived3DSheetPlane } from '@/lib/takeoff/conditions/derived3d/contracts';

export const PLAN_DATUM_Y = 0;
export type WorldPoint3 = { x: number; y: number; z: number };
export type SheetPlaneFrame = { width:number; height:number; center:[number,number,number]; rotation:[number,number,number] };

function requirePlaneSize(plane: Derived3DSheetPlane) {
  if (!(plane.worldWidth && plane.worldHeight)) throw new Error('The active sheet needs calibrated 3D dimensions.');
  return { width: plane.worldWidth, height: plane.worldHeight };
}

export function planPointToWorld(point: Derived3DPlanPoint, elevation = PLAN_DATUM_Y): WorldPoint3 {
  return { x: point.x, y: elevation, z: point.z };
}

export function normalizedPagePointToWorld(u:number,v:number,plane:Derived3DSheetPlane):WorldPoint3 {
  const {width,height}=requirePlaneSize(plane);
  return {x:u*width,y:PLAN_DATUM_Y,z:v*height};
}

export function sheetPlaneFrame(plane:Derived3DSheetPlane):SheetPlaneFrame {
  const {width,height}=requirePlaneSize(plane);
  return {width,height,center:[width/2,PLAN_DATUM_Y,height/2],rotation:[-Math.PI/2,0,0]};
}
```

Do not call upstream `toPlanPoint()` here.

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
  azimuth:number;
  polar:number;
  zoom:number;
  target:[number,number,number];
};
export const HOME_AZIMUTH:number;
export const HOME_POLAR:number;
export const MIN_POLAR:number;
export const MAX_POLAR:number;
export function sanitizeCameraMemory(value:Takeoff3DCameraMemory,fallbackTarget:[number,number,number]):Takeoff3DCameraMemory;
export function homeCameraMemory(width:number,height:number,viewportWidth:number,viewportHeight:number):Takeoff3DCameraMemory;
export function topCameraMemory(width:number,height:number,viewportWidth:number,viewportHeight:number):Takeoff3DCameraMemory;
export function cameraPositionForMemory(memory:Takeoff3DCameraMemory,width:number,height:number):[number,number,number];
export function shouldInitializeCamera(previousSheetId:string|null,nextSheetId:string|null,hasMemory:boolean):boolean;
```

Constants:

```ts
export const MIN_POLAR = 0.001;                  // effectively exact Top without spherical singularity
export const MAX_POLAR = 5 * Math.PI / 12;      // 15° above horizon
export const HOME_AZIMUTH = -Math.PI / 4;
export const HOME_POLAR = 53 * Math.PI / 180;    // about 37° above plan
```

- [ ] **Step 1: Write failing tests**

```ts
const fallback:[number,number,number]=[50,0,40];
assert.equal(sanitizeCameraMemory({azimuth:0,polar:Math.PI,zoom:0,target:[1,2,3]},fallback).polar,MAX_POLAR);
assert.deepEqual(sanitizeCameraMemory({azimuth:0,polar:1,zoom:1,target:[Number.NaN,2,3]},fallback).target,fallback);
assert.deepEqual(homeCameraMemory(100,80,1200,800).target,[50,0,40]);
assert.deepEqual(topCameraMemory(100,80,1200,800).target,[50,0,40]);
assert.equal(topCameraMemory(100,80,1200,800).polar,MIN_POLAR);
assert.ok(cameraPositionForMemory(homeCameraMemory(100,80,1200,800),100,80)[1]>0);
assert.equal(shouldInitializeCamera('A4','A4',true),false);
assert.equal(shouldInitializeCamera('A4','A5',false),true);
assert.equal(shouldInitializeCamera('A4','A5',true),false);
```

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-camera.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement camera helpers**

Home fit is sheet-governed:

```ts
const diagonal=Math.hypot(width,height)*1.22;
const fitPixels=Math.min(viewportWidth,viewportHeight);
const zoom=Math.max(0.05,Math.min(40,fitPixels/diagonal));
```

`sanitizeCameraMemory()` clamps polar/zoom, preserves finite azimuth/target, and substitutes `fallbackTarget` when any target component is non-finite.

Camera position uses a radius independent of orthographic zoom:

```ts
const radius=Math.max(100,Math.hypot(width,height)*2);
const sinPolar=Math.sin(memory.polar);
const offset:[number,number,number]=[
  radius*sinPolar*Math.sin(memory.azimuth),
  radius*Math.cos(memory.polar),
  radius*sinPolar*Math.cos(memory.azimuth),
];
return [memory.target[0]+offset[0],memory.target[1]+offset[1],memory.target[2]+offset[2]];
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
export type PlanTextureSize={width:number;height:number;scale:number};
export function computePlanTextureSize(pageWidth:number,pageHeight:number,viewportWidth:number,viewportHeight:number):PlanTextureSize;
export async function renderPdfPageCanvas(pdfUrl:string,pageNumber:number,target:PlanTextureSize,signal?:AbortSignal):Promise<HTMLCanvasElement>;
```

`Takeoff3DPlan` props:

```ts
{
  pdfUrl:string;
  pageNumber:number;
  plane:Derived3DSheetPlane;
  viewportSize:{width:number;height:number};
}
```

- [ ] **Step 1: Write failing sizing tests**

```ts
const size=computePlanTextureSize(1000,800,1200,800);
assert.equal(Math.max(size.width,size.height)<=4096,true);
assert.equal(Number((size.width/size.height).toFixed(6)),1.25);
assert.equal(size.width>=2000,true);
```

Also test a 6000px-wide display caps output at 4096 and a portrait source preserves its aspect ratio.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-plan.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement direct PDF.js rendering**

`computePlanTextureSize()` targets about 2× displayed resolution, caps longest side at 4096, and preserves source ratio.

Use the existing Carez PDF worker convention:

```ts
const pdfjs=await import('pdfjs-dist');
pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
const loadingTask=pdfjs.getDocument({url:pdfUrl});
const pdf=await loadingTask.promise;
const page=await pdf.getPage(pageNumber);
const viewport=page.getViewport({scale:target.scale});
const canvas=document.createElement('canvas');
canvas.width=Math.max(1,Math.round(viewport.width));
canvas.height=Math.max(1,Math.round(viewport.height));
const context=canvas.getContext('2d',{alpha:false});
if(!context)throw new Error('PDF texture canvas is unavailable.');
context.fillStyle='#ffffff';
context.fillRect(0,0,canvas.width,canvas.height);
await page.render({canvasContext:context,viewport}).promise;
page.cleanup();
await pdf.destroy();
return canvas;
```

Honor `AbortSignal`; cancel/destroy loading/document work on abort/error.

- [ ] **Step 4: Implement `Takeoff3DPlan`**

Create `THREE.CanvasTexture` and set:

```ts
texture.colorSpace=THREE.SRGBColorSpace;
texture.flipY=true;
texture.minFilter=THREE.LinearMipmapLinearFilter;
texture.magFilter=THREE.LinearFilter;
texture.generateMipmaps=true;
texture.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());
```

Use `sheetPlaneFrame(plane)` and exact `worldWidth × worldHeight` geometry. The PDF is a reference/backdrop and must not hide below-datum concrete:

```tsx
<mesh position={frame.center} rotation={frame.rotation} renderOrder={-20}>
  <planeGeometry args={[frame.width,frame.height]}/>
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

Add thin neutral `<Edges>` around the sheet. Add a second dark plane at `y=-0.03`, scaled to `1.01`, opacity `0.16`, `renderOrder={-21}`, `depthWrite={false}`, `depthTest={false}` to create the restrained sheet shadow without covering the PDF.

Dispose textures on replacement/unmount. Never query/capture the 2D canvas. If async PDF rendering fails, save the error and throw it during render so the R3F error boundary activates.

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

### Task 5: Create shared view state and the client-only R3F foundation

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

```ts
export type Derived3DViewState={hidden:string[];isolated:string|null;zone:string;elevation:string};
export const DEFAULT_DERIVED_3D_VIEW_STATE:Derived3DViewState={hidden:[],isolated:null,zone:'all',elevation:'all'};
```

```ts
export type Takeoff3DViewportProps={
  scene:Derived3DScene;
  pdfUrl:string;
  activeSheetId:string|null;
  activePageNumber:number;
  activeSheetLabel:string;
  selectedMeasurementId:string|null;
  selectedConditionVersionId:string|null;
  viewState:Derived3DViewState;
  onViewStateChange:(value:Derived3DViewState|((current:Derived3DViewState)=>Derived3DViewState))=>void;
  onSelectSolid:(solid:Derived3DSolid)=>void;
  onJumpToIssue:(issue:Derived3DIssue)=>void;
};
```

- [ ] **Step 1: Make QA source contracts expect R3F files**

Add reads/assertions in `tests/qa-condition-workstation.test.ts`:

```ts
const r3fViewport=readFileSync('components/takeoff/3d/Takeoff3DViewport.tsx','utf8');
const r3fPlan=readFileSync('components/takeoff/3d/Takeoff3DPlan.tsx','utf8');
const r3fScene=readFileSync('components/takeoff/3d/Takeoff3DScene.tsx','utf8');
assert.match(r3fScene,/<Canvas/);
assert.match(r3fScene,/orthographic/);
assert.match(r3fPlan,/renderPdfPageCanvas/);
assert.doesNotMatch(r3fPlan,/querySelector<HTMLCanvasElement>/);
assert.match(r3fViewport,/activeSheetId/);
```

Retain legacy assertions only where they deliberately protect migration fallback behavior through Milestone C.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement scene foundation**

```tsx
<Canvas
  orthographic
  dpr={[1,2]}
  gl={{antialias:true,alpha:false}}
  camera={{near:0.1,far:10000}}
>
  <color attach="background" args={['#090d12']}/>
  <hemisphereLight intensity={0.9} groundColor="#111827"/>
  <directionalLight position={[40,80,-30]} intensity={1.15}/>
  <Takeoff3DPlan .../>
  <Takeoff3DControls .../>
</Canvas>
```

Milestone A renders no concrete yet. If actual scene extents exceed the camera far plane, calculate far from sheet diagonal plus derived elevation span instead of increasing it arbitrarily.

- [ ] **Step 4: Implement camera control/memory**

`useTakeoff3DCamera` owns `Map<string,Takeoff3DCameraMemory>` in a ref. Use `cameraPositionForMemory()` and `sanitizeCameraMemory(memory,[sheetWidth/2,0,sheetHeight/2])`. Persist only on OrbitControls `end` and explicit toolbar actions.

```tsx
<OrbitControls
  minPolarAngle={MIN_POLAR}
  maxPolarAngle={MAX_POLAR}
  enableDamping
  dampingFactor={0.08}
  makeDefault
/>
```

Implement `home()`, `top()`, `focusSelected()`. First sheet load without memory or explicit actions may reframe; `scene.hash`, selection changes, and property recalculation may not trigger Home.

- [ ] **Step 5: Implement toolbar and error boundary**

Primary DOM controls: Home, Top, Focus, Filters, `3D checks N`. Reuse Carez Button/Lucide.

Fallback copy:

```text
3D unavailable
Your 2D Takeoff and quantities remain available.
```

`Retry 3D` remounts only the R3F viewer.

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

### Task 6: Integrate R3F behind a developer-only migration gate

**Files:**
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.tsx`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.module.css`
- Modify: `components/takeoff/TakeoffDerived3DView.tsx`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:**
- Shared `Derived3DViewState` lives in `lib/takeoff/3d/viewState.ts`.
- Legacy `Derived3DViewMemory` stays legacy-local until Milestone D.

- [ ] **Step 1: Add failing integration assertions**

```ts
assert.match(workstation,/NEXT_PUBLIC_CAREZ_3D_RENDERER/);
assert.match(workstation,/dynamic\(/);
assert.match(workstation,/ssr:\s*false/);
assert.match(workstation,/pdfUrl=\{workspaceProps\.pdfUrl\}/);
assert.match(workstation,/activePageNumber=\{Number\(activeSheet\?\.page_number\|\|1\)\}/);
assert.doesNotMatch(workstation,/\['2d','3d','split'\]/);
```

Require shared view-state imports from `@/lib/takeoff/3d/viewState`.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Move legacy viewer onto shared view-state type**

In legacy viewer:

```ts
import type {Derived3DViewState} from '@/lib/takeoff/3d/viewState';
```

Remove its local exported `Derived3DViewState`. Keep legacy camera-memory type there.

In workstation initialize from `DEFAULT_DERIVED_3D_VIEW_STATE`.

- [ ] **Step 4: Add dynamic R3F import and migration gate**

```ts
import dynamic from 'next/dynamic';
const Takeoff3DViewport=dynamic(
  ()=>import('./3d/Takeoff3DViewport').then(module=>module.Takeoff3DViewport),
  {ssr:false},
);
const rendererMode=process.env.NEXT_PUBLIC_CAREZ_3D_RENDERER==='legacy-svg'?'legacy-svg':'r3f';
```

Change `ViewMode` to `'2d'|'3d'`. UI maps only `['2d','3d']`.

Pass R3F the existing scene, `workspaceProps.pdfUrl`, active sheet/page, selected IDs, shared view state, `selectDerivedSolid`, and `jumpToDerivedIssue`. Do not add a second selection store.

- [ ] **Step 5: Remove Split presentation CSS**

Keep a single overlay over the drawing center. Desktop left offset still excludes visible sheet navigator; narrow layout remains `left:0`. Remove `.derivedOverlaySplit` and Split-specific `data-view-mode` selectors.

- [ ] **Step 6: Verify GREEN**

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

### Milestone A browser gate — STOP

Run `pnpm check`, push the task branch, and use its authenticated Vercel preview. Do not merge to staging.

Accept only if:

1. A4 `2D -> 3D` replaces only the center viewport.
2. Actual A4 PDF is crisp/readable at Home angle.
3. PDF is not mirrored, inverted, stretched, or sheared.
4. Home frames full sheet; Top is visually plan-orthographic.
5. Orbit cannot go below sheet or effectively edge-on.
6. Pan/zoom are stable.
7. `3D -> 2D -> 3D` restores a sane per-sheet camera.
8. PDF plane depth behavior is ready to show below-datum concrete rather than occlude it.

User must explicitly accept before Milestone B.

---

## Milestone B — Physical Takeoff meshes

### Task 7: Convert `Derived3DShape` to flat grouped Three geometry

**Files:**
- Create: `lib/takeoff/3d/meshGeometry.ts`
- Create: `tests/takeoff-3d-mesh-geometry.test.ts`

**Interface:**

```ts
export function buildTakeoffMeshGeometry(shape:Derived3DShape):THREE.BufferGeometry;
```

Material groups:

```text
0 = top
1 = sides
2 = bottom
```

- [ ] **Step 1: Write failing geometry tests**

```ts
const slab=buildTakeoffMeshGeometry({
  kind:'prism',outer:[{x:0,z:0},{x:10,z:0},{x:10,z:8},{x:0,z:8}],
  holes:[],bottom:-1,top:0,
});
slab.computeBoundingBox();
assert.equal(slab.boundingBox?.min.y,-1);
assert.equal(slab.boundingBox?.max.y,0);
assert.equal(slab.groups.some(group=>group.materialIndex===0),true);
assert.equal(slab.groups.some(group=>group.materialIndex===1),true);
assert.equal(slab.groups.some(group=>group.materialIndex===2),true);
```

Also test:

- rectangular slab hole is absent from top triangulation;
- `topOuter` can taper while preserving exact bottom/top Y;
- box dimensions and center are exact;
- +90° domain yaw rotates long axis from +X toward +Z, matching existing domain convention;
- one-foot derived height remains exactly one world foot with no unit conversion.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-mesh-geometry.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement prism geometry**

Use `THREE.ShapeUtils.triangulateShape()` on X/Z `Vector2`s. Normalize outer contour counter-clockwise and holes clockwise. Emit upward top triangles and reversed bottom triangles. Build outer/hole vertical quads explicitly.

For `topOuter`, require equal outer/top vertex counts and connect corresponding rings. If tapered `topOuter` and holes coexist, throw exactly:

```text
Unsupported tapered prism with holes.
```

- [ ] **Step 4: Implement box geometry using domain yaw**

Build eight corners and six faces explicitly; do not rely on `BoxGeometry` material grouping. For local X/Z:

```ts
const cos=Math.cos(shape.yawRad);
const sin=Math.sin(shape.yawRad);
const worldX=shape.centerX+x*cos-z*sin;
const worldZ=shape.centerZ+x*sin+z*cos;
```

This is equivalent to Three Y rotation `-shape.yawRad` and is locked by the +90° test.

- [ ] **Step 5: Preserve flat physical faces**

Use face-local vertices or convert to non-indexed geometry before computing normals, and verify material groups survive. Compute bounding box/sphere.

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

### Task 8: Render Style A solids and stable-ID picking

**Files:**
- Create: `components/takeoff/3d/Takeoff3DSolid.tsx`
- Create: `lib/takeoff/3d/selection.ts`
- Create: `tests/takeoff-3d-selection.test.ts`
- Modify: `components/takeoff/3d/Takeoff3DScene.tsx`
- Modify: `components/takeoff/3d/Takeoff3DViewport.tsx`

**Interfaces:**

```ts
export function solidSelectionIdentity(solid:Derived3DSolid):{
  solidId:string;measurementId:string;conditionVersionId:string;sheetId:string;
};
export function sheetSolidsForSelection(scene:Derived3DScene,activeSheetId:string|null):Derived3DSolid[];
export function selectedSolidForMeasurement(solids:Derived3DSolid[],measurementId:string|null):Derived3DSolid|null;
```

- [ ] **Step 1: Write failing identity tests**

```ts
assert.deepEqual(solidSelectionIdentity(solidA),{
  solidId:solidA.id,
  measurementId:solidA.measurementId,
  conditionVersionId:solidA.conditionVersionId,
  sheetId:solidA.sheetId,
});
assert.notEqual(solidSelectionIdentity(solidA).measurementId,solidSelectionIdentity(solidB).measurementId);
assert.equal(selectedSolidForMeasurement(sheetSolidsForSelection(scene,'A5'),'measurement-on-A4'),null);
```

Do not match by color/name/index.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-selection.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `Takeoff3DSolid`**

Memoize geometry by `solid.geometryKey`; dispose on replacement/unmount. Use three `MeshStandardMaterial`s in top/sides/bottom group order. Derive colors from `solid.color` with restrained HSL lightness changes.

Use:

```text
roughness 0.85
metalness 0
flatShading true
opaque geometry
```

Add thin dark Drei `<Edges>`. Selection strengthens edges and adds a small emissive/lightness lift. Hover only affects local visual state/cursor.

Set `mesh.userData=solidSelectionIdentity(solid)`. Click stops propagation and calls `onSelect(solid)`.

- [ ] **Step 4: Render every valid active-sheet solid**

Use `sheetSolidsForSelection(scene,activeSheetId)`, then existing hidden/isolate/zone/elevation filters. Selection controls highlight only.

Add Drei `ContactShadows` at the plan datum with `opacity={0.12}` and restrained blur. If the A4 gate shows plan text is darkened, reduce shadow opacity/blur; do not remove plan readability to preserve shadow styling.

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

### Milestone B browser gate — STOP

Run `pnpm check`; use task-branch Vercel preview.

Accept only if:

1. Every supported A4 Takeoff renders automatically.
2. Green footing and blue slab register exactly over 2D sources.
3. Colors are recognizable; top/side depth is clear without transparency.
4. Footing corners read continuously.
5. Slab holes remain open.
6. Elevations—including below datum—are visibly distinguishable relative to PDF.
7. Mesh click visibly selects without camera refit.
8. PDF remains readable and shadows/lighting stay restrained.

User must explicitly accept before Milestone C.

---

## Milestone C — Exact synchronization, camera persistence, and issue behavior

### Task 9: Wire exact 2D ↔ 3D selection

**Files:**
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.tsx`
- Modify: `components/takeoff/3d/Takeoff3DViewport.tsx`
- Modify: `components/takeoff/3d/Takeoff3DScene.tsx`
- Modify: `tests/qa-condition-workstation.test.ts`
- Modify: `tests/takeoff-3d-selection.test.ts`

**Interfaces:** Reuse existing `selectDerivedSolid`, `requestMeasurementSelection`, `requestConditionSelection`, `focusMeasurement`, and worksheet synchronization. No new global store/event layer.

- [ ] **Step 1: Add failing synchronization assertions**

Require R3F to receive `selectedMeasurementId`, use `selectDerivedSolid`, keep A4 selection from resolving to A5, and distinguish same-color solids by stable IDs.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-selection.test.ts tests/qa-condition-workstation.test.ts
```

Expected: FAIL for new assertions.

- [ ] **Step 3: Implement the existing stable-ID flow**

```text
2D click -> requestMeasurementSelection -> selectedMeasurementId -> R3F highlight
3D click -> onSelectSolid(solid) -> requestConditionSelection(conditionVersionId,false,measurementId)
```

R3F emits no parallel selection event. On sheet change, filter scene immediately; if selected measurement is absent, show no selected 3D mesh.

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

### Task 10: Preserve per-sheet camera through recalculation

**Files:**
- Modify: `components/takeoff/3d/useTakeoff3DCamera.ts`
- Modify: `components/takeoff/3d/Takeoff3DControls.tsx`
- Modify: `tests/takeoff-3d-camera.test.ts`

- [ ] **Step 1: Add failing persistence assertions**

Verify a finite target survives `sanitizeCameraMemory()`, invalid polar/zoom clamp, A4 same-sheet state does not initialize, and A5 without memory does initialize.

- [ ] **Step 2: Verify RED if behavior is absent**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-camera.test.ts
```

Expected: FAIL only for behavior not already completed in Task 3/5.

- [ ] **Step 3: Implement integration rule**

No effect that calls Home may depend on `scene.hash`, `solid.geometryKey`, selected ID, Condition revision, or issue count. Elevation/thickness/profile changes regenerate meshes while camera position/target/zoom remain unchanged.

Persist camera only on OrbitControls `end` and explicit Home/Top/Focus.

- [ ] **Step 4: Verify GREEN**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/takeoff-3d-camera.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/takeoff/3d/useTakeoff3DCamera.ts components/takeoff/3d/Takeoff3DControls.tsx tests/takeoff-3d-camera.test.ts
git commit -m "fix(takeoff): preserve r3f camera across recalculation"
```

### Task 11: Port partial-model holds, filters, and 3D checks

**Files:**
- Modify: `components/takeoff/3d/Takeoff3DViewport.tsx`
- Modify: `components/takeoff/3d/Takeoff3DToolbar.tsx`
- Modify: `components/takeoff/3d/Takeoff3DViewport.module.css`
- Modify: `tests/qa-condition-workstation.test.ts`

- [ ] **Step 1: Add failing source-contract assertions**

Require:
- `scene.issues` scoped to active sheet;
- selected missing/unsupported issue found by measurement ID;
- valid siblings remain visible;
- DOM `Resolve input` and `3D checks N`;
- filter/hide/isolate state does not mutate source quantities.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement issue/filter UI**

Use:

```text
3D input required
```

for missing governed inputs, and:

```text
3D unavailable for this Takeoff
```

for unsupported projection.

If valid siblings exist, keep Canvas visible with selected issue overlay. If no solid can render but the sheet plane is calibrated, keep PDF visible with centered issue. If sheet itself lacks required calibration, show the exact derived input issue without blank/black failure.

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

### Task 12: Run complete Milestone C automated regression

**Files:** No production-file change is expected. Change tests/implementation only for a reproduced regression with a defined failing case.

- [ ] **Step 1: Run targeted tests**

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

- [ ] **Step 2: Run broad gate**

```bash
pnpm check
```

Expected: typecheck, full tests, production build PASS.

- [ ] **Step 3: Audit quantity-authority leakage**

```bash
grep -R "raw_quantity\|production_quantity\|direct_cost\|sourceQuantities" components/takeoff/3d lib/takeoff/3d || true
```

Expected: no arithmetic/persistence involving authoritative quantities. `sourceQuantities` may only be read for integrity/display if necessary.

- [ ] **Step 4: Commit only a reproduced regression fix**

If files changed because a failing test proved a defect:

```bash
git add tests components/takeoff/3d lib/takeoff/3d
git commit -m "test(takeoff): verify r3f workstation regression"
```

If no files changed, create no commit.

### Milestone C authenticated browser gate — STOP

Use exact task-branch Vercel preview SHA.

1. A4 2D: select blue slab.
2. Switch 3D: A4 PDF remains plane; all supported A4 solids render; slab selected.
3. Click green footing in 3D: exact Properties + worksheet record changes.
4. Return 2D: exact source footing selected.
5. Go A5: both views follow; no stale jump to A4.
6. Return A4: prior sane camera restores.
7. Change governed elevation/reference, Save & recalculate, leave camera untouched: solid moves relative to fixed PDF plane.
8. View switching/selection alone does not alter worksheet quantity.
9. Clear one required 3D physical input on QA draft: valid siblings stay; selected hold gives exact resolution. Restore value.
10. Orbit/pan/zoom/Home/Top/Focus remain stable; plan stays readable.

User must explicitly accept before Milestone D.

---

## Milestone D — Legacy retirement and promotion

### Task 13: Delete SVG pseudo-3D and migration gate

**Files:**
- Delete: `components/takeoff/TakeoffDerived3DView.tsx`
- Delete: `components/takeoff/TakeoffDerived3DView.module.css`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.tsx`
- Modify: `components/takeoff/IntegratedTakeoffConditionWorkspace.module.css`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:** `Derived3DViewState` stays in `lib/takeoff/3d/viewState.ts`; R3F camera memory stays in new camera code; `Derived3DScene` domain projection modules remain.

- [ ] **Step 1: Make QA test fail for legacy references**

```ts
assert.doesNotMatch(workstation,/NEXT_PUBLIC_CAREZ_3D_RENDERER/);
assert.doesNotMatch(workstation,/TakeoffDerived3DView/);
assert.doesNotMatch(workspaceStyles,/derivedOverlaySplit/);
```

Remove test reads of legacy viewer/CSS.

- [ ] **Step 2: Verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

Expected: FAIL while legacy remains.

- [ ] **Step 3: Remove legacy implementation**

Delete SVG component/CSS; remove env renderer gate, legacy imports/memory, and Split compatibility. Keep client-only dynamic R3F import.

Do not delete `lib/takeoff/conditions/derived3d.ts` or its contracts/checks/coordinates/source-resolution code.

- [ ] **Step 4: Verify GREEN**

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

### Task 14: Final review and promotion checkpoint

**Files:**
- Modify only if implementation makes them stale: `docs/concrete-condition-3d-workstation-target.md`, `docs/modules/takeoff.md`.
- GitHub: implementation PR targeting `staging`; Issue #41 acceptance record after promotion.

- [ ] **Step 1: Verify exact task-branch head**

```bash
pnpm check
grep -R "TakeoffDerived3DView\|derivedOverlaySplit\|NEXT_PUBLIC_CAREZ_3D_RENDERER" components tests lib || true
```

Expected: check PASS and grep zero results.

- [ ] **Step 2: Run code review**

Invoke `superpowers:requesting-code-review`. Resolve verified findings. Use `superpowers:receiving-code-review` before implementing unclear/questionable feedback.

- [ ] **Step 3: Obtain final branch browser acceptance after legacy deletion**

Push exact branch SHA. On its authenticated Vercel preview repeat Milestone C, and record Home, rotated view, selected slab, selected footing, fixed-camera elevation change, and return to 2D.

- [ ] **Step 4: Open PR to `staging` and stop for explicit promotion approval**

PR body records:
- exact task-branch SHA;
- targeted tests + `pnpm check` PASS;
- exact preview deployment and READY state;
- authenticated browser PASS;
- 2D/vector + server/domain authority unchanged;
- direct 3D geometry editing deferred.

Do not merge without explicit user approval.

- [ ] **Step 5: After approval, merge to `staging` and verify exact merged SHA**

Confirm Vercel READY for exact staging SHA. Short staging smoke: A4 `2D -> 3D -> 2D`, one 3D selection, one sheet switch, quantity worksheet unchanged by view switching.

- [ ] **Step 6: Update Issue #41**

Record exact staging SHA, `pnpm check`, Vercel READY, authenticated browser PASS for Parts 1–2, unchanged 2D/domain authority, and deferred direct 3D geometry editing.

- [ ] **Step 7: Update current-state docs only if stale**

If either named document is stale, update it before PR finalization and commit:

```bash
git add docs/concrete-condition-3d-workstation-target.md docs/modules/takeoff.md
git commit -m "docs(takeoff): record accepted r3f 3d viewer"
```

If neither is stale, do not create a docs commit.

---

## Visual execution rules for Codex + GPT-6 Astra

The visual target is the user-approved **Style A construction model**. Passing WebGL or CI is insufficient.

Reject before advancing if:

- PDF is blurry, mirrored, flipped, stretched, sheared, washed out, or unreadable at Home angle;
- concrete resembles translucent markup rather than opaque physical volume;
- footing/slab registration differs from authoritative 2D source location;
- below-datum concrete disappears behind the PDF reference plane;
- camera can move below plan or become effectively edge-on;
- one mesh selects the wrong measurement/Condition;
- sheet navigation jumps because of stale selection;
- elevation/property recalculation auto-reframes and hides movement;
- one held element blocks valid sibling solids;
- 3D rendering/selection changes authoritative quantity values.

For any defect: reproduce it, identify the failing boundary, create/extend a failing test where the boundary is testable, then fix that root cause. Do not stack presentation tweaks on an unidentified geometry/camera/selection defect.
