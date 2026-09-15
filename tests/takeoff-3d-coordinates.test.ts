import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPagePointToWorld, planPointToWorld, sheetPlaneFrame } from '../lib/takeoff/3d/coordinates.ts';

const plane = { sheetId: 'A4', pageWidth: 1000, pageHeight: 800, scaleFtPerPdfUnit: 0.1, worldWidth: 100, worldHeight: 80 };

test('R3F consumes derived plan feet without rescaling', () => {
  assert.deepEqual(planPointToWorld({ x: 12.5, z: 24 }, -3), { x: 12.5, y: -3, z: 24 });
});

test('PDF corners preserve page-right/page-down coordinates', () => {
  for (const [u, v, x, z] of [[0, 0, 0, 0], [1, 0, 100, 0], [0, 1, 0, 80], [1, 1, 100, 80]]) {
    assert.deepEqual(normalizedPagePointToWorld(u, v, plane), { x, y: 0, z });
  }
});

test('sheet frame preserves exact extents and maps local top toward page top', () => {
  const frame = sheetPlaneFrame(plane);
  assert.deepEqual(frame, { width: 100, height: 80, center: [50, 0, 40], rotation: [-Math.PI / 2, 0, 0] });
  assert.equal(frame.center[2] + Math.sin(frame.rotation[0]) * frame.height / 2, 0);
});

test('missing or invalid calibration never produces a broken plane', () => {
  for (const worldWidth of [null, 0, -1, NaN, Infinity]) {
    assert.throws(() => sheetPlaneFrame({ ...plane, worldWidth }), /calibrated 3D dimensions/);
  }
});
