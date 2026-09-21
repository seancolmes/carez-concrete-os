import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { cameraPositionForMemory, homeCameraMemory, topCameraMemory, sanitizeCameraMemory, shouldInitializeCamera, MIN_POLAR, MAX_POLAR } from '../lib/takeoff/3d/camera.ts';

test('restored camera clamps orbit and zoom and replaces non-finite values', () => {
  const fallback: [number, number, number] = [50, 0, 40];
  const sane = sanitizeCameraMemory({ azimuth: 0, polar: Math.PI, zoom: 0, target: [1, 2, 3] }, fallback);
  assert.equal(sane.polar, MAX_POLAR);
  assert.equal(sane.zoom, 0.05);
  assert.deepEqual(sane.target, [1, 2, 3]);
  const invalid = sanitizeCameraMemory({ azimuth: NaN, polar: NaN, zoom: Infinity, target: [NaN, 2, 3] }, fallback);
  assert.deepEqual(invalid.target, fallback);
  assert.ok([invalid.azimuth, invalid.polar, invalid.zoom].every(Number.isFinite));
});

test('Home and Top frame the sheet above its fixed datum', () => {
  for (const create of [homeCameraMemory, topCameraMemory]) {
    const memory = create(100, 80, 1200, 800);
    assert.deepEqual(memory.target, [50, 0, 40]);
    assert.ok(cameraPositionForMemory(memory, 100, 80)[1] > 0);
  }
  const home = homeCameraMemory(100, 80, 1200, 800);
  const top = topCameraMemory(100, 80, 1200, 800);
  assert.equal(top.polar, MIN_POLAR);
  assert.ok(MAX_POLAR < Math.PI / 2);
  // A true top view should fit the rectangular sheet to the viewport rather than
  // reuse the conservative diagonal fit needed by the oblique Home view.
  assert.ok(top.zoom > home.zoom * 1.4);
  assert.ok(100 * top.zoom <= 1200);
  assert.ok(80 * top.zoom <= 800);
  assert.ok(80 * top.zoom >= 800 * 0.75);
});

test('fit remains sheet-governed in portrait and wide viewports', () => {
  for (const [width, height, viewportWidth, viewportHeight] of [[80, 100, 400, 1000], [100, 80, 1600, 400]]) {
    const memory = homeCameraMemory(width, height, viewportWidth, viewportHeight);
    assert.ok(Math.hypot(width, height) * memory.zoom < Math.min(viewportWidth, viewportHeight));
  }
});

test('only a sheet without memory initializes; same-sheet updates never refit', () => {
  assert.equal(shouldInitializeCamera('A4', 'A4', true), false);
  assert.equal(shouldInitializeCamera('A4', 'A4', false), false);
  assert.equal(shouldInitializeCamera('A4', 'A5', false), true);
  assert.equal(shouldInitializeCamera('A4', 'A5', true), false);
  assert.equal(shouldInitializeCamera(null, 'A4', false), true);
});

test('camera integration stays domain-independent while spatial navigation is bounded and interruptible', () => {
  const controls = readFileSync('components/takeoff/3d/Takeoff3DControls.tsx', 'utf8');
  const viewport = readFileSync('components/takeoff/3d/Takeoff3DViewport.tsx', 'utf8');
  assert.doesNotMatch(controls, /scene\.hash|geometryKey|selectedMeasurementId|conditionRevision|issueCount/);
  assert.match(controls, /if \(previousSheetId\.current === sheetId\) return/);
  assert.match(controls, /SPATIAL_TRANSITION_MS/);
  assert.match(controls, /useFrame\(\(_, delta\) => \{/);
  assert.match(controls, /if \(!move\) return/);
  assert.match(controls, /onStart=\{\(\) => \{ transition\.current = null; \}\}/);
  assert.match(controls, /if \(!from \|\| reducedMotion\)/);
  assert.match(controls, /onEnd=\{save\}/);
  assert.match(controls, /mouseButtons=\{\{ LEFT: MOUSE\.ROTATE, MIDDLE: MOUSE\.PAN, RIGHT: MOUSE\.PAN \}\}/);
  assert.match(viewport, /key=\{\`\$\{activeSheetId\}:\$\{attempt\}\`\}/);
});
