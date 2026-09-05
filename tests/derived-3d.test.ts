import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDerived3DScene } from '../lib/takeoff/conditions/derived3d.ts';

const sheet = {
  id: 'sheet-1',
  page_width: 1000,
  page_height: 800,
  calibration: { ft_per_pdf_unit: 0.1 },
};

function slabCondition(overrides: Record<string, unknown> = {}) {
  return {
    conditionId: 'condition-slab',
    conditionVersionId: 'version-slab',
    code: 'SOG-A',
    name: 'Slab Area A',
    archetypeKey: 'slab_on_grade' as const,
    color: '#60a5fa',
    planFacts: { thickness_in: 4, ...(overrides.planFacts as object || {}) },
    drawingInputs: { elevation_ft: 100, elevation_reference: 'top', ...(overrides.drawingInputs as object || {}) },
    roles: [{ roleKey: 'area', measurementId: 'measurement-slab' }],
  };
}

const slabMeasurement = {
  id: 'measurement-slab',
  sheet_id: 'sheet-1',
  name: 'Slab Area A',
  location: 'Area A',
  raw_quantity: 720,
  raw_unit: 'SF',
  geometry: {
    type: 'polygon',
    points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }, { x: 0.1, y: 0.4 }],
    holes: [[{ x: 0.2, y: 0.2 }, { x: 0.25, y: 0.2 }, { x: 0.25, y: 0.25 }, { x: 0.2, y: 0.25 }]],
  },
};

test('derived 3D scene is deterministic and invalidates when governed dimensions change', () => {
  const input = { conditions: [slabCondition()], measurements: [slabMeasurement], sheets: [sheet] };
  const first = buildDerived3DScene(input);
  const second = buildDerived3DScene(input);
  const changed = buildDerived3DScene({ conditions: [slabCondition({ planFacts: { thickness_in: 6 } })], measurements: [slabMeasurement], sheets: [sheet] });

  assert.equal(first.hash, second.hash);
  assert.notEqual(first.hash, changed.hash);
  assert.equal(first.solids.length, 1);
  assert.equal(first.solids[0].shape.kind, 'prism');
  if (first.solids[0].shape.kind === 'prism') {
    assert.equal(first.solids[0].shape.holes.length, 1);
    assert.equal(Number((first.solids[0].shape.top - first.solids[0].shape.bottom).toFixed(6)), Number((4 / 12).toFixed(6)));
  }
  assert.deepEqual(first.solids[0].sourceQuantity, { value: 720, unit: 'SF' });
  assert.equal('volume' in first.solids[0], false);
});

test('strip footing projects one deterministic box per authoritative run segment', () => {
  const scene = buildDerived3DScene({
    conditions: [{
      conditionId: 'condition-strip', conditionVersionId: 'version-strip', code: 'FTG-1', name: 'Strip Footing',
      archetypeKey: 'strip_wall_footing', color: '#34d399',
      planFacts: { width_ft: 2, depth_ft: 1 }, drawingInputs: { elevation_ft: 10, elevation_reference: 'bottom' },
      roles: [{ roleKey: 'run', measurementId: 'measurement-strip' }],
    }],
    measurements: [{
      id: 'measurement-strip', sheet_id: 'sheet-1', name: 'Strip Footing', raw_quantity: 20, raw_unit: 'LF',
      geometry: { type: 'polyline', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.2, y: 0.2 }] },
    }],
    sheets: [sheet],
  });

  assert.equal(scene.solids.length, 2);
  assert.ok(scene.solids.every(solid => solid.shape.kind === 'box'));
  assert.equal(scene.solids[0].shape.bottom, 10);
  assert.equal(scene.solids[0].shape.top, 11);
});

test('pad footing count points project independently without becoming quantity authority', () => {
  const scene = buildDerived3DScene({
    conditions: [{
      conditionId: 'condition-pad', conditionVersionId: 'version-pad', code: 'PAD-1', name: 'Pad Footings',
      archetypeKey: 'pad_column_footing', color: '#f59e0b',
      planFacts: { width_ft: 4, length_ft: 5, depth_ft: 1.5 }, drawingInputs: { elevation_ft: 50, elevation_reference: 'centerline' },
      roles: [{ roleKey: 'locations', measurementId: 'measurement-pad' }],
    }],
    measurements: [{
      id: 'measurement-pad', sheet_id: 'sheet-1', name: 'Pad Footings', raw_quantity: 2, raw_unit: 'EA',
      geometry: { type: 'count', points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }] },
    }],
    sheets: [sheet],
  });

  assert.equal(scene.solids.length, 2);
  assert.deepEqual(scene.solids.map(solid => solid.sourceQuantity.value), [2, 2]);
  assert.equal(scene.solids[0].shape.bottom, 49.25);
  assert.equal(scene.solids[0].shape.top, 50.75);
});

test('missing 3D governance inputs create explicit holds instead of invented geometry', () => {
  const noElevation = buildDerived3DScene({
    conditions: [slabCondition({ drawingInputs: { elevation_ft: '', elevation_reference: 'top' } })],
    measurements: [slabMeasurement],
    sheets: [sheet],
  });
  assert.equal(noElevation.solids.length, 0);
  assert.ok(noElevation.issues.some(entry => entry.code === '3d_input_required' && /elevation/i.test(entry.message)));

  const noScale = buildDerived3DScene({
    conditions: [slabCondition()],
    measurements: [slabMeasurement],
    sheets: [{ ...sheet, calibration: null }],
  });
  assert.equal(noScale.solids.length, 0);
  assert.ok(noScale.issues.some(entry => entry.code === '3d_input_required' && /scale/i.test(entry.message)));
});

test('invalid slab cutouts and cross-condition physical overlaps surface verification issues', () => {
  const badSlab = {
    ...slabMeasurement,
    geometry: {
      ...slabMeasurement.geometry,
      holes: [[{ x: 0.35, y: 0.35 }, { x: 0.45, y: 0.35 }, { x: 0.45, y: 0.45 }, { x: 0.35, y: 0.45 }]],
    },
  };
  const secondCondition = {
    ...slabCondition(),
    conditionId: 'condition-slab-2', conditionVersionId: 'version-slab-2', code: 'SOG-B', name: 'Slab Area B',
    roles: [{ roleKey: 'area', measurementId: 'measurement-slab-2' }],
  };
  const secondMeasurement = { ...slabMeasurement, id: 'measurement-slab-2', name: 'Slab Area B', geometry: { ...slabMeasurement.geometry, holes: [] } };
  const scene = buildDerived3DScene({ conditions: [slabCondition(), secondCondition], measurements: [badSlab, secondMeasurement], sheets: [sheet] });

  assert.ok(scene.issues.some(entry => entry.code === 'cutout_inconsistency'));
  assert.ok(scene.issues.some(entry => entry.code === 'potential_overlap'));
});
