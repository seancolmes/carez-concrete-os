import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDerived3DScene } from '../lib/takeoff/conditions/derived3d.ts';

const sheet = {
  id: 'sheet-qc',
  page_width: 1000,
  page_height: 800,
  calibration: { ft_per_pdf_unit: 0.1 },
};

const rectangle = (x0 = 0.1, y0 = 0.1, x1 = 0.2, y1 = 0.2) => ({
  type: 'polygon',
  points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
});

function slabCondition(id: string, elevation: number, reference: 'top' | 'bottom' | 'centerline', drawing: Record<string, unknown> = {}) {
  return {
    conditionId: `condition-${id}`,
    conditionVersionId: `version-${id}`,
    code: id.toUpperCase(),
    name: id,
    archetypeKey: 'slab_on_grade' as const,
    color: '#60a5fa',
    planFacts: { thickness_in: 4 },
    drawingInputs: { elevation_ft: elevation, elevation_reference: reference, ...drawing },
    roles: [{ roleKey: 'area', measurementId: `measurement-${id}` }],
  };
}

function slabMeasurement(id: string) {
  return {
    id: `measurement-${id}`,
    sheet_id: sheet.id,
    name: id,
    raw_quantity: 100,
    raw_unit: 'SF',
    geometry: rectangle(),
  };
}

function stripCondition(id: string, drawing: Record<string, unknown>) {
  return {
    conditionId: `condition-${id}`,
    conditionVersionId: `version-${id}`,
    code: id.toUpperCase(),
    name: id,
    archetypeKey: 'strip_wall_footing' as const,
    contractVersion: 5,
    engineKey: 'concrete_condition_v1',
    color: '#34d399',
    planFacts: { width_ft: 1, depth_ft: 1 },
    concreteProfile: { enabled: true, profile: 'rectangular', topWidthFt: undefined },
    drawingInputs: { elevation_ft: 0, elevation_reference: 'top', ...drawing },
    roles: [{ roleKey: 'run', measurementId: `measurement-${id}` }],
  };
}

function stripMeasurement(id: string, y: number) {
  return {
    id: `measurement-${id}`,
    sheet_id: sheet.id,
    name: id,
    raw_quantity: 10,
    raw_unit: 'LF',
    geometry: { type: 'polyline', points: [{ x: 0.1, y }, { x: 0.2, y }] },
  };
}

test('configured elevation match groups flag top and bottom conflicts without changing quantities', () => {
  const scene = buildDerived3DScene({
    conditions: [
      slabCondition('level-a-1', 0, 'top', { qc_elevation_group: 'LEVEL-A', qc_elevation_tolerance_ft: 0.1 }),
      slabCondition('level-a-2', 1, 'top', { qc_elevation_group: 'LEVEL-A', qc_elevation_tolerance_ft: 0.1 }),
    ],
    measurements: [slabMeasurement('level-a-1'), slabMeasurement('level-a-2')],
    sheets: [sheet],
  });

  assert.ok(scene.issues.some(issue => issue.code === 'elevation_conflict'));
  assert.deepEqual(Object.values(scene.sourceQuantities).map(item => item.value).sort((a, b) => a - b), [100, 100]);
  assert.ok(scene.solids.every(solid => !('volume' in solid) && !('sourceQuantity' in solid)));
});

test('configured support groups flag a floating solid only from explicit support evidence', () => {
  const scene = buildDerived3DScene({
    conditions: [
      slabCondition('support-low', 0, 'top', { qc_support_group: 'STACK-A', qc_support_tolerance_ft: 0.25 }),
      slabCondition('support-high', 1, 'bottom', { qc_support_group: 'STACK-A', qc_support_tolerance_ft: 0.25 }),
    ],
    measurements: [slabMeasurement('support-low'), slabMeasurement('support-high')],
    sheets: [sheet],
  });

  const issue = scene.issues.find(entry => entry.code === 'floating_element');
  assert.ok(issue);
  assert.match(issue.message, /support group "STACK-A"/);
  assert.match(issue.message, /configured tolerance is 0\.250 FT/);
});

test('configured connection groups flag nearby disconnected strip footprints', () => {
  const drawing = { qc_connection_group: 'FOOTING-RUN', qc_connection_tolerance_ft: 1 };
  const scene = buildDerived3DScene({
    conditions: [stripCondition('strip-a', drawing), stripCondition('strip-b', drawing)],
    measurements: [stripMeasurement('strip-a', 0.1), stripMeasurement('strip-b', 0.12)],
    sheets: [sheet],
  });

  const issue = scene.issues.find(entry => entry.code === 'gap_disconnection');
  assert.ok(issue);
  assert.match(issue.message, /connection group "FOOTING-RUN"/);
  assert.match(issue.message, /configured tolerance is 1\.000 FT/);
  assert.deepEqual(Object.values(scene.sourceQuantities).map(item => item.value).sort((a, b) => a - b), [10, 10]);
});

test('unconfigured geometry does not invent elevation, support, or connection expectations', () => {
  const scene = buildDerived3DScene({
    conditions: [slabCondition('plain-low', 0, 'top'), slabCondition('plain-high', 3, 'bottom')],
    measurements: [slabMeasurement('plain-low'), slabMeasurement('plain-high')],
    sheets: [sheet],
  });

  assert.equal(scene.issues.some(issue => ['elevation_conflict', 'floating_element', 'gap_disconnection'].includes(issue.code)), false);
});
