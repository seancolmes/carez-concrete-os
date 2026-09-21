import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { solidSelectionIdentity, sheetSolidsForSelection, selectedSolidForMeasurement, focusFrameForSolids } from '../lib/takeoff/3d/selection.ts';
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

test('selected 3d solid uses a dark high-contrast outline stronger than hover', () => {
  const source = readFileSync('components/takeoff/3d/Takeoff3DSolid.tsx', 'utf8');
  assert.match(source, /selected \? '#020617' : hovered \? '#64748b' : '#18212c'/);
  assert.match(source, /lineWidth=\{selected \? 2\.5 : hovered \? 1\.5 : 0\.75\}/);
  assert.match(source, /emissiveIntensity=\{selected \? 0\.16 : 0\}/);
  assert.doesNotMatch(source, /selected \? '#e2e8f0'/);
});

test('R3F uses the workstation selection path without a parallel selection store', () => {
  const workstation = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
  const viewport = readFileSync('components/takeoff/3d/Takeoff3DViewport.tsx', 'utf8');
  const scene = readFileSync('components/takeoff/3d/Takeoff3DScene.tsx', 'utf8');
  assert.match(workstation, /<Takeoff3DViewport[^>]*selectedMeasurementId=\{selectedMeasurementId\}[^>]*selectedConditionVersionId=\{selectedVersionId\}[^>]*onSelectSolid=\{selectDerivedSolid\}/);
  assert.match(viewport, /selectedMeasurementId=\{selectedMeasurementId\} selectedConditionVersionId=\{selectedConditionVersionId\}[^>]*onSelectSolid=\{onSelectSolid\}/);
  assert.match(scene, /selected=\{selectedMeasurementId \? solid\.measurementId === selectedMeasurementId : solid\.conditionVersionId === selectedConditionVersionId\}/);
  assert.doesNotMatch(viewport + scene, /dispatchEvent|setSelectedMeasurementId/);
});
test('Condition loading and recalculation cannot overwrite exact selected assignment or revive its sheet', () => {
  const workstation = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
  const loadEffect = workstation.slice(workstation.indexOf('useEffect(()=>{if(!selectedVersion)return;'), workstation.indexOf('useEffect(()=>{if(!availableTabs'));
  assert.doesNotMatch(loadEffect, /focusMeasurement|setActiveSheetId|setSelectedMeasurementId/);
  const sheetListener = workstation.slice(workstation.indexOf('useEffect(()=>{const sheet='), workstation.indexOf('useEffect(()=>{\n    const pending='));
  assert.match(sheetListener, /setSelectedMeasurementId/);
  assert.match(sheetListener, /sheet_id===sheetId/);
});

test('Focus includes every selected placement and governed elevation, skipping unsupported geometry', () => {
  const second = { ...a, shape: { ...a.shape, centerX: 11, bottom: 4, top: 6 } } as Derived3DSolid;
  const frame = focusFrameForSolids([a, second]);
  assert.deepEqual(frame?.target, [6, 2.5, 1]);
  assert.ok((frame?.width ?? 0) >= 11);
  assert.equal(frame?.height, 7);
  assert.equal(focusFrameForSolids([]), null);
  assert.deepEqual(focusFrameForSolids([a, { ...a, shape: { ...a.shape, top: NaN } }]), focusFrameForSolids([a]));
});
