import assert from 'node:assert/strict';
import test from 'node:test';
import { solidSelectionIdentity, sheetSolidsForSelection, selectedSolidForMeasurement } from '../lib/takeoff/3d/selection.ts';
import type { Derived3DScene, Derived3DSolid } from '../lib/takeoff/conditions/derived3d/contracts.ts';

function solid(id: string, sheetId: string): Derived3DSolid {
  return { id, sheetId, measurementId: `measurement-${id}`, conditionVersionId: `version-${id}`, conditionId: 'condition', roleKey: 'area', roleInstanceKey: '', templateVersionId: null, archetypeVersionId: null, measurementRevision: null, conditionRevision: null, sheetRevision: null, calibrationKey: 'scale', geometryKey: id, conditionCode: 'same', conditionName: 'same', measurementName: 'same', archetypeKey: 'slab_on_grade', zone: null, color: '#60a5fa', sourceQuantityKey: id, shape: { kind: 'box', centerX: 1, centerZ: 1, width: 1, length: 1, yawRad: 0, bottom: -1, top: 0 } };
}
const a = solid('a', 'A4'), b = solid('b', 'A4'), c = solid('c', 'A5');
const scene: Derived3DScene = { hash: 'hash', scopeKey: 'scope', solids: [a, b, c], issues: [], sourceQuantities: { a: { measurementId: a.measurementId, value: 99, unit: 'SF', revision: null } }, sheetPlanes: {}, coverage: { requested: 3, projected: 3, held: 0, checksComplete: true }, state: 'saved' };

test('picking uses exact stable IDs even for identical colors and names', () => {
  assert.deepEqual(solidSelectionIdentity(a), { solidId: a.id, measurementId: a.measurementId, conditionVersionId: a.conditionVersionId, sheetId: a.sheetId });
  assert.notEqual(solidSelectionIdentity(a).measurementId, solidSelectionIdentity(b).measurementId);
  assert.equal(selectedSolidForMeasurement(scene.solids, b.measurementId), b);
});

test('active-sheet scope never falls back to stale selection or all sheets', () => {
  assert.deepEqual(sheetSolidsForSelection(scene, 'A4'), [a, b]);
  assert.equal(selectedSolidForMeasurement(sheetSolidsForSelection(scene, 'A5'), a.measurementId), null);
  assert.deepEqual(sheetSolidsForSelection(scene, null), []);
  assert.equal(selectedSolidForMeasurement(scene.solids, null), null);
});

test('selection does not mutate source geometry or quantity references', () => {
  const before = JSON.stringify(scene);
  const quantities = scene.sourceQuantities;
  solidSelectionIdentity(a);
  selectedSolidForMeasurement(sheetSolidsForSelection(scene, 'A4'), a.measurementId);
  assert.equal(JSON.stringify(scene), before);
  assert.equal(scene.sourceQuantities, quantities);
});
