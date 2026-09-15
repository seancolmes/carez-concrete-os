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
  raw_quantity: 700,
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
  assert.equal(first.sourceQuantities[first.solids[0].sourceQuantityKey].value, 700);
  assert.equal('volume' in first.solids[0], false);
});

test('strip footing projects the shared continuous run footprint', () => {
  const scene = buildDerived3DScene({
    conditions: [{
      conditionId: 'condition-strip', conditionVersionId: 'version-strip', code: 'FTG-1', name: 'Strip Footing',
      archetypeKey: 'strip_wall_footing', color: '#34d399',
      planFacts: { width_ft: 2, depth_ft: 1 }, drawingInputs: { elevation_ft: 10, elevation_reference: 'bottom' },
      roles: [{ roleKey: 'run', measurementId: 'measurement-strip' }],
    }],
    measurements: [{
      id: 'measurement-strip', sheet_id: 'sheet-1', name: 'Strip Footing', raw_quantity: 18, raw_unit: 'LF',
      geometry: { type: 'polyline', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.2, y: 0.2 }] },
    }],
    sheets: [sheet],
  });

  assert.equal(scene.solids.length, 1);
  assert.equal(scene.solids[0].shape.kind, 'prism');
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
  assert.equal(Object.keys(scene.sourceQuantities).length, 1);
  assert.equal(Object.values(scene.sourceQuantities)[0].value, 2);
  assert.ok(scene.solids.every(solid => !('sourceQuantity' in solid)));
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
  const valid = buildDerived3DScene({ conditions: [slabCondition(), secondCondition], measurements: [slabMeasurement, secondMeasurement], sheets: [sheet] });
  assert.ok(valid.issues.some(entry => entry.code === 'geometric_overlap' || entry.code === 'duplicate_placement'));
  assert.equal(scene.solids.length, 1);
});


import { resolvedPhysicalInputs, prepareDerived3DSources } from '../lib/takeoff/conditions/derived3d/sources.ts';
import { footprintsOverlap } from '../lib/takeoff/conditions/derived3d/checks.ts';
import { elevationRange } from '../lib/takeoff/conditions/derived3d/coordinates.ts';
import type { Derived3DGeometryCache } from '../lib/takeoff/conditions/derived3d.ts';

test('effective physical inputs preserve template defaults and explicit project zero', () => {
  const result = resolvedPhysicalInputs({ companyDefaults: { planFacts: { thickness_in: 6 }, drawing: { elevation_ft: 100, elevation_reference: 'top' } }, projectValues: { drawing: { elevation_ft: 0 } } });
  assert.equal(result.planFacts.thickness_in, 6);
  assert.equal(result.drawingInputs.elevation_ft, 0);
  assert.equal(result.drawingInputs.elevation_reference, 'top');
  assert.deepEqual(elevationRange(-2, 2, 'top'), { bottom: -4, top: -2 });
  assert.deepEqual(elevationRange(0, 2, 'bottom'), { bottom: 0, top: 2 });
  assert.deepEqual(elevationRange(0, 2, 'centerline'), { bottom: -1, top: 1 });
});

test('missing assigned scale region cannot silently inherit the sheet scale', () => {
  const prepared = prepareDerived3DSources('company', 'set', { conditions: [] }, [{ ...slabMeasurement, scale_region_id: 'missing-region' }], [sheet], []);
  const scene = buildDerived3DScene({ ...prepared, conditions: [slabCondition()] });
  assert.equal(scene.solids.length, 0);
  assert.match(scene.issues[0].message, /scale/);
});

test('all primary assignments project with sheet scope and deduplicated source references', () => {
  const scene = buildDerived3DScene({ scopeKey: 'tenant:set', conditions: [{ ...slabCondition(), roles: [{ roleKey: 'area', roleInstanceKey: 'area-1', measurementId: slabMeasurement.id }, { roleKey: 'area', roleInstanceKey: 'area-2', measurementId: 'second' }] }], measurements: [slabMeasurement, { ...slabMeasurement, id: 'second', sheet_id: 'sheet-2' }], sheets: [sheet, { ...sheet, id: 'sheet-2' }] });
  assert.equal(scene.solids.length, 2);
  assert.equal(scene.coverage.projected, 2);
  assert.equal(scene.issues.length, 0, 'unregistered sheets must not be tested as coincident');
  assert.equal(Object.keys(scene.sourceQuantities).length, 2);
  assert.ok(scene.solids.every(s => s.id.includes('tenant:set') && s.calibrationKey));
});

test('cache reuses unchanged shapes and evicts removed placements', () => {
  const cache: Derived3DGeometryCache = new Map();
  const input = { conditions: [slabCondition()], measurements: [slabMeasurement], sheets: [sheet] };
  const first = buildDerived3DScene(input, cache);
  const second = buildDerived3DScene(input, cache);
  assert.equal(second.solids[0].shape, first.solids[0].shape);
  const changed = buildDerived3DScene({ ...input, conditions: [slabCondition({ planFacts: { thickness_in: 8 } })], state: 'preview' }, cache);
  assert.equal(changed.solids[0].id, first.solids[0].id);
  assert.notEqual(changed.solids[0].shape, first.solids[0].shape);
  assert.equal(changed.state, 'preview');
  buildDerived3DScene({ ...input, conditions: [] }, cache);
  assert.equal(cache.size, 0);
});

const rectangle = (x: number, z: number, width: number, depth: number) => [{ x, z }, { x: x + width, z }, { x: x + width, z: z + depth }, { x, z: z + depth }];
test('material intersection excludes holes, touching faces and empty concave bounds', () => {
  const ring = { outer: rectangle(0, 0, 10, 10), holes: [rectangle(2, 2, 6, 6)] };
  assert.equal(footprintsOverlap(ring, { outer: rectangle(3, 3, 2, 2), holes: [] }), false);
  assert.equal(footprintsOverlap(ring, { outer: rectangle(10, 0, 2, 2), holes: [] }), false);
  assert.equal(footprintsOverlap(ring, { outer: rectangle(1, 3, 2, 2), holes: [] }), true);
  const concave = { outer: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 10 }, { x: 0, z: 10 }], holes: [] };
  assert.equal(footprintsOverlap(concave, { outer: rectangle(3, 3, 2, 2), holes: [] }), false);
});

test('unsupported contracts, segment overrides and source discrepancies are explicit holds', () => {
  const input = { conditions: [slabCondition()], measurements: [slabMeasurement], sheets: [sheet] };
  for (const [scene, code] of [
    [buildDerived3DScene({ ...input, conditions: [{ ...slabCondition(), contractVersion: 99 }] }), 'unsupported_projection'],
    [buildDerived3DScene({ ...input, measurements: [{ ...slabMeasurement, geometry: { ...slabMeasurement.geometry, steps: [{}] } }] }), 'unsupported_projection'],
    [buildDerived3DScene({ ...input, measurements: [{ ...slabMeasurement, sourceIssue: 'Quantity is stale' }] }), 'quantity_mismatch'],
  ] as const) {
    assert.equal(scene.solids.length, 0);
    assert.equal(scene.issues[0].code, code);
    assert.equal(scene.coverage.held, 1);
  }
});

test('modern strip contracts project governed trapezoid profiles', () => {
  for (const contractVersion of [2, 3, 4, 5]) {
    const scene = buildDerived3DScene({ conditions: [{ ...slabCondition(), archetypeKey: 'strip_wall_footing', contractVersion, engineKey: 'concrete_condition_v1', planFacts: { width_ft: 4, depth_ft: 2 }, concreteProfile: { enabled: true, profile: 'trapezoid', topWidthFt: 2 }, roles: [{ roleKey: 'run', measurementId: 'strip' }] }], measurements: [{ id: 'strip', sheet_id: sheet.id, name: 'Strip', raw_quantity: 10, raw_unit: 'LF', geometry: { type: 'polyline', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }] } }], sheets: [sheet] });
    assert.equal(scene.issues.length, 0);
    const shape = scene.solids[0].shape;
    assert.equal(shape.kind, 'prism');
    if (shape.kind === 'prism') {
      assert.ok(shape.topOuter);
      assert.equal(Math.max(...shape.outer.map(p => p.z)) - Math.min(...shape.outer.map(p => p.z)), 4);
      assert.equal(Math.max(...shape.topOuter!.map(p => p.z)) - Math.min(...shape.topOuter!.map(p => p.z)), 2);
    }
  }
});

test('strip footing v5 projects from 2D geometry while preserving authoritative LF', () => {
  const scene = buildDerived3DScene({
    conditions: [{
      conditionId: 'condition-strip-v5', conditionVersionId: 'version-strip-v5', code: 'FTG-V5', name: '3D Test Strip Footing',
      archetypeKey: 'strip_wall_footing', contractVersion: 5, engineKey: 'concrete_condition_v1', color: '#34d399',
      planFacts: { width_ft: 2, depth_ft: 1 }, concreteProfile: { enabled: true, profile: 'rectangular', topWidthFt: undefined },
      drawingInputs: { elevation_ft: 0, elevation_reference: 'top' }, roles: [{ roleKey: 'run', measurementId: 'measurement-strip-v5' }],
    }],
    measurements: [{
      id: 'measurement-strip-v5', sheet_id: sheet.id, name: '3D Test Strip Footing', raw_quantity: 17.19, raw_unit: 'LF',
      geometry: { type: 'polyline', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.2, y: 0.18 }] },
    }],
    sheets: [sheet],
  });

  assert.equal(scene.issues.length, 0);
  assert.equal(scene.solids.length, 1);
  assert.equal(scene.solids[0].shape.kind, 'prism');
  assert.deepEqual(Object.values(scene.sourceQuantities), [{ measurementId: 'measurement-strip-v5', value: 17.19, unit: 'LF', revision: null }]);
  assert.equal('volume' in scene.solids[0], false);
  assert.equal('sourceQuantity' in scene.solids[0], false);
});

test('strip footing v5 still holds unsupported step geometry instead of inventing a solid', () => {
  const scene = buildDerived3DScene({
    conditions: [{
      conditionId: 'condition-strip-v5-step', conditionVersionId: 'version-strip-v5-step', code: 'FTG-V5-STEP', name: 'Stepped Strip Footing',
      archetypeKey: 'strip_wall_footing', contractVersion: 5, engineKey: 'concrete_condition_v1', color: '#34d399',
      planFacts: { width_ft: 2, depth_ft: 1 }, concreteProfile: { enabled: true, profile: 'rectangular', topWidthFt: undefined },
      drawingInputs: { elevation_ft: 0, elevation_reference: 'top' }, roles: [{ roleKey: 'run', measurementId: 'measurement-strip-v5-step' }],
    }],
    measurements: [{
      id: 'measurement-strip-v5-step', sheet_id: sheet.id, name: 'Stepped Strip Footing', raw_quantity: 20, raw_unit: 'LF',
      geometry: { type: 'polyline', points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.1 }], steps: [{ at: 0.5 }] },
    }],
    sheets: [sheet],
  });

  assert.equal(scene.solids.length, 0);
  assert.equal(scene.issues[0].code, 'unsupported_projection');
  assert.match(scene.issues[0].message, /segment or instance overrides/i);
});
