import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GeometryCommandHistory, type GeometryMutationCommand } from '../lib/takeoff/commandHistory.ts';
import {
  arcPdfLength,
  calculateSlabArea,
  measureDrawingGeometry,
  type DrawingGeometry,
  type TakeoffPath,
} from '../lib/takeoff/geometry.ts';
import { evaluateTakeoffFormula, takeoffFormulaVariables } from '../lib/takeoff/formula.ts';
import { buildTakeoffPropertyContext, resolveAssemblyPropertyValues } from '../lib/takeoff/assemblyContext.ts';
import { evaluateRule, validateRuleExpression } from '../lib/takeoff/rules.ts';
import { linearFootprint } from '../lib/takeoff/physicalGeometry.ts';

const calibration = { known_distance_ft: 10, pdf_distance: 100 };

test('linear takeoff converts stable PDF coordinates through sheet calibration', () => {
  const result = measureDrawingGeometry({ type: 'polyline', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, 100, 100, calibration);
  assert.equal(result.unit, 'LF');
  assert.equal(result.quantity, 10);
});

test('area takeoff subtracts cutouts and includes every formed edge', () => {
  const geometry: DrawingGeometry = {
    type: 'polygon',
    points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    holes: [[{ x: .4, y: .4 }, { x: .6, y: .4 }, { x: .6, y: .6 }, { x: .4, y: .6 }]],
  };
  const result = measureDrawingGeometry(geometry, 100, 100, calibration);
  assert.equal(result.unit, 'SF');
  assert.ok(Math.abs((result.grossQuantity || 0) - 100) < 1e-10);
  assert.ok(Math.abs((result.cutoutQuantity || 0) - 4) < 1e-10);
  assert.ok(Math.abs(result.quantity - 96) < 1e-10);
  assert.ok(Math.abs(result.perimeterLf - 48) < 1e-10);
});

test('invalid and overlapping area rings are rejected before persistence', () => {
  const outer = [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }];
  assert.throws(() => measureDrawingGeometry({
    type: 'polygon', points: outer,
    holes: [[{ x: .8, y: .8 }, { x: 1, y: .8 }, { x: 1, y: 1 }]],
  }, 100, 100, calibration), /strictly inside/);
  assert.throws(() => measureDrawingGeometry({
    type: 'polygon', points: outer,
    holes: [
      [{ x: .2, y: .2 }, { x: .6, y: .2 }, { x: .6, y: .6 }, { x: .2, y: .6 }],
      [{ x: .4, y: .4 }, { x: .7, y: .4 }, { x: .7, y: .7 }, { x: .4, y: .7 }],
    ],
  }, 100, 100, calibration), /overlaps/);
});

test('arc length and signed slab path rules remain deterministic', () => {
  const arc = {
    type: 'Arc' as const,
    start: { x: .25, y: .5 },
    end: { x: .75, y: .5 },
    center: { x: .5, y: .5 },
    clockwise: true,
  };
  assert.ok(Math.abs(arcPdfLength(arc, 100, 100) - Math.PI * 25) < 1e-10);

  const square: TakeoffPath = {
    closed: true,
    segments: [
      { type: 'Line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
      { type: 'Line', start: { x: 1, y: 0 }, end: { x: 1, y: 1 } },
      { type: 'Line', start: { x: 1, y: 1 }, end: { x: 0, y: 1 } },
      { type: 'Line', start: { x: 0, y: 1 }, end: { x: 0, y: 0 } },
    ],
  };
  assert.equal(calculateSlabArea([square], 100, 100, calibration), 100);
});

test('assembly formulas remain deterministic, expose dependencies and reject unsafe division', () => {
  const formula = {
    op: 'mul',
    args: [
      { var: 'area_sf' },
      { op: 'div', args: [{ var: 'thickness_in' }, { const: 12 }] },
      { op: 'div', args: [{ const: 1 }, { const: 27 }] },
    ],
  };
  assert.deepEqual(new Set(takeoffFormulaVariables(formula)), new Set(['area_sf', 'thickness_in']));
  assert.ok(Math.abs(evaluateTakeoffFormula(formula, { area_sf: 1080, thickness_in: 4 }) - 13.333333333333334) < 1e-10);
  assert.throws(() => evaluateTakeoffFormula({ op: 'div', args: [{ const: 1 }, { const: 0 }] }, {}), /divide by zero/);
});

test('custom assembly properties resolve deterministic namespace bindings and preserve explicit authority rules', () => {
  const variables = [
    { id: 'thickness', variable_key: 'thickness_in', label: 'Thickness', value_type: 'number', unit: 'IN', default_value: 6, required: true, allow_override: true },
    { id: 'psi', variable_key: 'concrete_psi', label: 'Concrete PSI', value_type: 'number', unit: 'PSI', required: true, allow_override: false },
    { id: 'waste', variable_key: 'waste_pct', label: 'Waste', value_type: 'number', unit: '%', default_value: 3, required: false, allow_override: true },
  ];
  const bindings = [
    { variable_id: 'psi', source_namespace: 'plan_fact', source_key: 'concrete.compressive_strength_psi', precedence: 200 },
  ];
  const takeoff = buildTakeoffPropertyContext(24, 'LF', { perimeter_lf: 50 });
  const resolved = resolveAssemblyPropertyValues({
    variables,
    bindings,
    explicitInputs: { concrete_psi: 3000 },
    context: { takeoff, planFact: { 'concrete.compressive_strength_psi': 4000 } },
  });

  assert.equal(resolved.storedValues.thickness_in, 6);
  assert.equal(resolved.storedValues.concrete_psi, 4000);
  assert.equal(resolved.sources.concrete_psi, 'PlanFact.concrete.compressive_strength_psi');
  assert.equal(resolved.formulaValues['Takeoff.Length'], 24);
  assert.equal(resolved.formulaValues['Takeoff.Perimeter'], 50);
  assert.equal(resolved.formulaValues['Properties.concrete_psi'], 4000);
  assert.equal(evaluateTakeoffFormula({ op: 'mul', args: [{ var: 'Takeoff.Length' }, { var: 'Properties.thickness_in' }] }, resolved.formulaValues), 144);
});

test('intelligent takeoff typed properties support dimensions, percentages, booleans and enums', () => {
  const result = resolveAssemblyPropertyValues({
    variables: [
      { id: 'width', variable_key: 'width_in', label: 'Width', value_type: 'dimension', min_value: 12, max_value: 36, required: true },
      { id: 'waste', variable_key: 'waste_pct', label: 'Waste', value_type: 'percentage', default_value: 5 },
      { id: 'formed', variable_key: 'formed', label: 'Formed', value_type: 'boolean', required: true },
      { id: 'method', variable_key: 'method', label: 'Method', value_type: 'enum', options: ['EARTH_FORMED', 'LUMBER_FORM'], required: true },
    ], bindings: [], explicitInputs: { width_in: '24', formed: 'false', method: 'EARTH_FORMED' }, context: {},
  });
  assert.equal(result.storedValues.width_in, 24);
  assert.equal(result.storedValues.waste_pct, 5);
  assert.equal(result.storedValues.formed, false);
  assert.equal(result.storedValues.method, 'EARTH_FORMED');
  assert.throws(() => resolveAssemblyPropertyValues({ variables: [{ id: 'method', variable_key: 'method', label: 'Method', value_type: 'enum', options: ['A'], required: true }], bindings: [], explicitInputs: { method: 'B' }, context: {} }), /invalid selection/);
});

test('typed activation rules are deterministic and reject executable expressions', () => {
  const context = { quantity: 40, element: { width_in: 24 }, methods: { formwork: { code: 'EARTH_FORMED' } } };
  assert.equal(evaluateRule({ op: 'and', args: [{ op: 'eq', left: { var: 'methods.formwork.code' }, right: { const: 'EARTH_FORMED' } }, { op: 'gte', left: { var: 'element.width_in' }, right: { const: 24 } }] }, context), true);
  assert.equal(evaluateRule({ op: 'or', args: [{ op: 'neq', left: { var: 'methods.formwork.code' }, right: { const: 'LUMBER_FORM' } }, { op: 'not', arg: { op: 'gt', left: { var: 'quantity' }, right: { const: 40 } } }] }, context), true);
  assert.equal(evaluateRule({ op: 'in', value: { var: 'methods.formwork.code' }, values: [{ const: 'LUMBER_FORM' }, { const: 'EARTH_FORMED' }] }, context), true);
  assert.equal(evaluateRule({ op: 'lte', left: { var: 'quantity' }, right: { const: 40 } }, context), true);
  assert.equal(evaluateRule({ op: 'lt', left: { var: 'quantity' }, right: { const: 40 } }, context), false);
  assert.equal(evaluateRule({ op: 'exists', value: { var: 'methods.placement.code' } }, context), false);
  assert.throws(() => validateRuleExpression({ op: 'eval', source: 'alert(1)' }), /Unsupported/);
});

test('physical linear footprints preserve source geometry and calibrated width', () => {
  const source = [{ x: .1, y: .5 }, { x: .9, y: .5 }];
  const original = JSON.stringify(source);
  const center = linearFootprint(source, 100, 100, .1, 24);
  const left = linearFootprint(source, 100, 100, .1, 24, 'left');
  const wider = linearFootprint(source, 100, 100, .1, 30);
  assert.equal(JSON.stringify(source), original);
  assert.ok(Math.abs((center[0].y - center[3].y) * 100 - 20) < 1e-8);
  assert.notEqual(left[0].y, center[0].y);
  assert.ok(Math.abs(wider[0].y - wider[3].y) > Math.abs(center[0].y - center[3].y));
  const corner = linearFootprint([{ x: .1, y: .1 }, { x: .5, y: .1 }, { x: .5, y: .5 }], 100, 100, .1, 24);
  assert.equal(corner.length, 6);
});

test('custom assembly property-to-property cycles are rejected', () => {
  assert.throws(() => resolveAssemblyPropertyValues({
    variables: [
      { id: 'a', variable_key: 'a', label: 'A', value_type: 'number', required: true },
      { id: 'b', variable_key: 'b', label: 'B', value_type: 'number', required: true },
    ],
    bindings: [
      { variable_id: 'a', source_namespace: 'property', source_key: 'b', precedence: 100 },
      { variable_id: 'b', source_namespace: 'property', source_key: 'a', precedence: 100 },
    ],
    explicitInputs: {},
    context: {},
  }), /binding cycle/);
});

test('committed command history branches safely and confirms durable undo/redo', () => {
  const history = new GeometryCommandHistory(3);
  const before: DrawingGeometry = { type: 'count', points: [{ x: .1, y: .1 }] };
  const after: DrawingGeometry = { type: 'count', points: [{ x: .2, y: .2 }] };
  const command: GeometryMutationCommand = {
    id: 'move-1', kind: 'MoveMeasurementCommand', measurementId: 'measurement-1', before, after, committedAt: '2026-08-28T00:00:00.000Z',
  };
  history.record(command);
  assert.equal(history.snapshot().canUndo, true);
  assert.equal(history.undoCandidate()?.before.points[0].x, .1);
  history.confirmUndo('move-1');
  assert.equal(history.snapshot().canRedo, true);
  assert.equal(history.redoCandidate()?.after.points[0].x, .2);
  history.confirmRedo('move-1');
  assert.equal(history.snapshot().canRedo, false);

  history.confirmUndo('move-1');
  history.record({ ...command, id: 'move-2', kind: 'MoveVertexCommand' });
  assert.equal(history.snapshot().size, 1);
  assert.equal(history.snapshot().canRedo, false);
});

test('migration contract preserves takeoff-to-estimate-to-budget lineage', () => {
  const readMigration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
  const commit = readMigration('20260829_takeoff_atomic_hardening.sql');
  const award = readMigration('20260829_award_to_operations_03_award_boundary.sql');
  const foundation = readMigration('20260829_takeoff_assembly_foundation.sql');
  const geometryUpdate = readMigration('20260829_takeoff_pro_geometry_update_hardening.sql');
  const inputHolds = readMigration('20260829200913_takeoff_missing_input_holds.sql');
  const customAssemblies = readMigration('20260830063109_custom_assembly_authoring_foundation.sql');
  const nestedAssemblies = readMigration('20260830063312_nested_assembly_runtime_lineage.sql');

  assert.match(commit, /source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id/);
  assert.match(award, /i\.source_takeoff_output_id,i\.source_takeoff_measurement_id/);
  assert.match(foundation, /source_takeoff_output_id uuid references public\.takeoff_measurement_outputs\(id\)/);
  assert.match(foundation, /source_takeoff_measurement_id uuid references public\.takeoff_measurements\(id\)/);
  assert.match(geometryUpdate, /v_output\.pricing_status='manual_override'/);
  assert.match(geometryUpdate, /source_takeoff_measurement_id=v_measurement\.id/);
  assert.match(inputHolds, /missing_input/);
  assert.match(inputHolds, /security_invoker = true/);
  assert.match(customAssemblies, /create table public\.concrete_assembly_folders/);
  assert.match(customAssemblies, /create table public\.concrete_assembly_property_bindings/);
  assert.match(customAssemblies, /create table public\.concrete_assembly_children/);
  assert.match(customAssemblies, /carez_create_custom_assembly/);
  assert.match(customAssemblies, /carez_create_assembly_revision/);
  assert.match(customAssemblies, /carez_publish_assembly_version/);
  assert.match(nestedAssemblies, /carez_assembly_component_paths/);
  assert.match(nestedAssemblies, /component_path_key/);
  assert.match(nestedAssemblies, /v_path_key/);
});
