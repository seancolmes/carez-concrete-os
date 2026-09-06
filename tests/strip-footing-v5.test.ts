import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateStripFootingV5,
  STRIP_FOOTING_V5_CONTRACT_VERSION,
  STRIP_FOOTING_V5_DEFINITION,
  STRIP_FOOTING_V5_RESOURCE_MODEL,
} from '../lib/takeoff/conditions/stripFootingV5.ts';
import { STRIP_FOOTING_V4_ENDPOINT_ROLE } from '../lib/takeoff/conditions/stripFootingV4.ts';
import type {
  ConditionCalculationRequest,
  ConditionInputGroup,
  ConditionInputGroups,
  ConditionMeasurementRole,
  ConditionModuleConfiguration,
  ConditionScalar,
} from '../lib/takeoff/conditions/types.ts';

const value = (input: ConditionScalar) => ({ value: input, mode: 'project_value' as const, sourceLabel: 'fixture' });
const inputs = (groups: Partial<Record<ConditionInputGroup, Record<string, ConditionScalar>>>): ConditionInputGroups => Object.fromEntries(
  Object.entries(groups).map(([group, values]) => [group, Object.fromEntries(Object.entries(values || {}).map(([key, input]) => [key, value(input)]))]),
);
const role = (
  roleKey: string,
  measurementId: string,
  quantity: number,
  unit: ConditionMeasurementRole['unit'],
  geometryType: ConditionMeasurementRole['geometryType'],
): ConditionMeasurementRole => ({ roleKey, measurementId, sheetId: 'S1', quantity, unit, geometryType });
const module = (
  moduleKey: string,
  enabled: boolean,
  inputValues: Record<string, ConditionScalar> = {},
): ConditionModuleConfiguration => ({ moduleKey, instanceKey: 'default', enabled, inputValues, label: moduleKey, sortOrder: 10 });
const closeTo = (actual: number | null, expected: number, epsilon = 0.001) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(Number(actual) - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};

function request(options: {
  run?: number;
  width?: number;
  depth?: number;
  board?: string;
  customCourseHeight?: number;
  formSystem?: string;
  track?: boolean;
} = {}): ConditionCalculationRequest {
  const forms: Record<string, ConditionScalar> = {
    form_method: 'two_sides',
    formed_sides: 2,
    bulkhead_count_source: 'run_endpoints',
    form_system: options.formSystem || 'wood_lumber',
    resource_tracking: options.track ?? true,
    form_resource_model: STRIP_FOOTING_V5_RESOURCE_MODEL,
    stakes_enabled: false,
  };
  if (options.board !== undefined) forms.form_board_size = options.board;
  if (options.customCourseHeight !== undefined) forms.form_board_custom_course_height_in = options.customCourseHeight;
  return {
    archetypeKey: 'strip_wall_footing',
    conditionVersionId: 'strip-v5-fixture',
    measurementRoles: [
      role('run', 'run-1', options.run ?? 100, 'LF', 'polyline'),
      role(STRIP_FOOTING_V4_ENDPOINT_ROLE, 'run-1', 2, 'EA', 'count'),
    ],
    inputs: inputs({
      planFacts: { width_ft: options.width ?? 2, depth_ft: options.depth ?? 1 },
      commercial: { concrete_waste_pct: 0 },
      production: {
        place_concrete_labor_method: 'factor',
        place_concrete_mh_per_unit: 0,
        forms_labor_method: 'factor',
        forms_mh_per_unit: 0.04,
      },
    }),
    modules: [
      module('concrete', true, { profile: 'rectangular' }),
      module('forms', true, forms),
      module('reinforcing', false),
      module('anchors_embeds', false),
      module('excavation_backfill', false),
      module('placement_equipment', false),
      module('finish_cure_protection', false),
      module('labor', true),
      module('miscellaneous', false),
    ],
  };
}

const output = (calculation: ReturnType<typeof calculateStripFootingV5>, key: string) => calculation.outputs.find(item => item.outputKey === key);

test('Strip Footing v5 replaces generic LF/LF factor with a physical board choice', () => {
  assert.equal(STRIP_FOOTING_V5_CONTRACT_VERSION, 5);
  assert.equal(STRIP_FOOTING_V5_DEFINITION.contractVersion, 5);
  const forms = STRIP_FOOTING_V5_DEFINITION.modules?.find(item => item.key === 'forms');
  assert.ok(forms);
  assert.equal(forms?.inputs.some(item => item.key === 'form_material_factor_lf_per_lf'), false);
  assert.equal(forms?.inputs.find(item => item.key === 'resource_tracking')?.label, 'Track form boards');
  assert.deepEqual(forms?.inputs.find(item => item.key === 'form_board_size')?.options, ['2x4', '2x6', '2x8', '2x10', '2x12', 'custom']);
});

test('Strip Footing v5 derives installed 2x12 board LF from authoritative formed-edge geometry', () => {
  const calculation = calculateStripFootingV5(request({ board: '2x12' }));
  closeTo(output(calculation, 'forms.side_contact_sf')?.quantity ?? null, 200);
  closeTo(output(calculation, 'forms.end_contact_sf')?.quantity ?? null, 4);
  closeTo(output(calculation, 'forms.form_material_lf')?.quantity ?? null, 204);
  assert.equal(output(calculation, 'forms.form_material_lf')?.label, 'Form boards — installed');
  assert.equal(output(calculation, 'forms.form_material_lf')?.trace.algorithm, 'strip-form-board-installed-v5');
  assert.ok(output(calculation, 'forms.form_material_lf')?.trace.values.some(item => item.key === 'forms.form_board_courses' && Number(item.value) === 1));
  assert.ok(output(calculation, 'forms.form_material_lf')?.trace.values.some(item => item.key === 'forms.formed_edge_lf' && Number(item.value) === 204));
});

test('Strip Footing v5 derives board courses from footing depth and selected board', () => {
  const twoBySix = calculateStripFootingV5(request({ board: '2x6', depth: 1 }));
  closeTo(output(twoBySix, 'forms.form_material_lf')?.quantity ?? null, 408);
  assert.ok(output(twoBySix, 'forms.form_material_lf')?.trace.values.some(item => item.key === 'forms.form_board_courses' && Number(item.value) === 2));

  const twoByEight = calculateStripFootingV5(request({ board: '2x8', depth: 1.5 }));
  closeTo(output(twoByEight, 'forms.form_material_lf')?.quantity ?? null, 612);
  assert.ok(output(twoByEight, 'forms.form_material_lf')?.trace.values.some(item => item.key === 'forms.form_board_courses' && Number(item.value) === 3));
});

test('Strip Footing v5 supports estimator-entered custom board course height', () => {
  const calculation = calculateStripFootingV5(request({ board: 'custom', customCourseHeight: 7 }));
  closeTo(output(calculation, 'forms.form_material_lf')?.quantity ?? null, 408);
  assert.ok(output(calculation, 'forms.form_material_lf')?.trace.values.some(item => item.key === 'forms.default.form_board_course_height_in' && Number(item.value) === 7));
});

test('Strip Footing v5 holds board demand until a tracked wood form board is selected', () => {
  const calculation = calculateStripFootingV5(request());
  assert.equal(output(calculation, 'forms.side_contact_sf')?.status, 'ready');
  assert.equal(output(calculation, 'forms.end_contact_sf')?.status, 'ready');
  assert.equal(output(calculation, 'labor.forms_mh')?.status, 'ready');
  assert.equal(output(calculation, 'forms.form_material_lf')?.status, 'held');
  assert.ok(output(calculation, 'forms.form_material_lf')?.holds.some(item => item.message.includes('Form board')));
});

test('Strip Footing v5 does not fabricate board LF for panel form systems', () => {
  const calculation = calculateStripFootingV5(request({ formSystem: 'panel', board: '2x12' }));
  assert.equal(output(calculation, 'forms.form_material_lf')?.status, 'inactive');
  closeTo(output(calculation, 'forms.form_material_lf')?.quantity ?? null, 0);
  closeTo(output(calculation, 'forms.side_contact_sf')?.quantity ?? null, 200);
});

test('Strip Footing v5 responds to changed takeoff LF without a second length input', () => {
  const calculation = calculateStripFootingV5(request({ run: 125, board: '2x12' }));
  closeTo(output(calculation, 'forms.form_material_lf')?.quantity ?? null, 254);
});
