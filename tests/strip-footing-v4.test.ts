import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStripFootingV4, STRIP_FOOTING_V4_DEFINITION, STRIP_FOOTING_V4_ENDPOINT_ROLE } from '../lib/takeoff/conditions/stripFootingV4.ts';
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

function request(source: 'run_endpoints' | 'explicit_count' | 'none' | '' = 'run_endpoints', explicitCount?: number): ConditionCalculationRequest {
  const forms: Record<string, ConditionScalar> = {
    form_method: 'two_sides',
    formed_sides: 2,
    resource_tracking: true,
    form_material_factor_lf_per_lf: 1,
    stakes_enabled: false,
  };
  if (source) forms.bulkhead_count_source = source;
  if (explicitCount !== undefined) forms.bulkhead_explicit_count = explicitCount;
  return {
    archetypeKey: 'strip_wall_footing',
    conditionVersionId: 'strip-v4-fixture',
    measurementRoles: [
      role('run', 'run-1', 100, 'LF', 'polyline'),
      role(STRIP_FOOTING_V4_ENDPOINT_ROLE, 'run-1', 2, 'EA', 'count'),
    ],
    inputs: inputs({
      planFacts: { width_ft: 2, depth_ft: 1 },
      commercial: { concrete_waste_pct: 0 },
      production: {
        place_concrete_labor_method: 'factor',
        place_concrete_mh_per_unit: 0,
        forms_labor_method: 'crew_rate',
        forms_crew_size: 4,
        forms_production_per_crew_hr: 100,
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

const output = (calculation: ReturnType<typeof calculateStripFootingV4>, key: string) => calculation.outputs.find(item => item.outputKey === key);

test('Strip Footing v4 removes drawable End forms and exposes estimator-controlled bulkhead inputs', () => {
  assert.equal(STRIP_FOOTING_V4_DEFINITION.contractVersion, 4);
  assert.equal(STRIP_FOOTING_V4_DEFINITION.roles.some(item => item.key === 'end_forms'), false);
  const forms = STRIP_FOOTING_V4_DEFINITION.modules?.find(item => item.key === 'forms');
  const source = forms?.inputs.find(item => item.key === 'bulkhead_count_source');
  assert.equal(source?.label, 'End bulkheads / pour stops');
  assert.deepEqual(source?.options, ['run_endpoints', 'explicit_count', 'none']);
  assert.ok(forms?.inputs.some(item => item.key === 'bulkhead_explicit_count' && item.unit === 'EA'));
});

test('Strip Footing v4 derives approved bulkheads from run endpoints', () => {
  const calculation = calculateStripFootingV4(request('run_endpoints'));
  closeTo(output(calculation, 'forms.side_contact_sf')?.quantity ?? null, 200);
  closeTo(output(calculation, 'forms.end_contact_sf')?.quantity ?? null, 4);
  closeTo(output(calculation, 'forms.form_material_lf')?.quantity ?? null, 204);
  closeTo(output(calculation, 'labor.forms_mh')?.quantity ?? null, 8.16);
  assert.equal(output(calculation, 'forms.end_contact_sf')?.label, 'End bulkhead contact area');
  assert.equal(output(calculation, 'forms.end_contact_sf')?.trace.algorithm, 'strip-end-bulkhead-v4');
  assert.ok(output(calculation, 'forms.end_contact_sf')?.trace.values.some(item => item.key === 'geometry.run_open_endpoints' && Number(item.value) === 2));
});

test('Strip Footing v4 uses an explicit estimator bulkhead count when selected', () => {
  const calculation = calculateStripFootingV4(request('explicit_count', 3));
  closeTo(output(calculation, 'forms.end_contact_sf')?.quantity ?? null, 6);
  closeTo(output(calculation, 'forms.form_material_lf')?.quantity ?? null, 206);
  assert.ok(output(calculation, 'forms.end_contact_sf')?.trace.values.some(item => item.key === 'forms.default.bulkhead_explicit_count' && Number(item.value) === 3));
});

test('Strip Footing v4 supports explicitly excluding end bulkheads', () => {
  const calculation = calculateStripFootingV4(request('none'));
  closeTo(output(calculation, 'forms.end_contact_sf')?.quantity ?? null, 0);
  closeTo(output(calculation, 'forms.form_material_lf')?.quantity ?? null, 200);
  closeTo(output(calculation, 'labor.forms_mh')?.quantity ?? null, 8);
});

test('Strip Footing v4 holds only bulkhead-dependent form outputs until the estimator chooses a count source', () => {
  const calculation = calculateStripFootingV4(request(''));
  assert.equal(output(calculation, 'forms.side_contact_sf')?.status, 'ready');
  assert.equal(output(calculation, 'forms.end_contact_sf')?.status, 'held');
  assert.equal(output(calculation, 'forms.form_material_lf')?.status, 'held');
  assert.equal(output(calculation, 'labor.forms_mh')?.status, 'held');
  assert.ok(output(calculation, 'forms.end_contact_sf')?.holds.some(item => item.message.includes('End bulkheads / pour stops')));
});

test('Strip Footing v4 accepts a closed run endpoint candidate of zero', () => {
  const input = request('run_endpoints');
  input.measurementRoles = input.measurementRoles.map(item => item.roleKey === STRIP_FOOTING_V4_ENDPOINT_ROLE ? { ...item, quantity: 0 } : item);
  const calculation = calculateStripFootingV4(input);
  closeTo(output(calculation, 'forms.end_contact_sf')?.quantity ?? null, 0);
  closeTo(output(calculation, 'forms.form_material_lf')?.quantity ?? null, 200);
});

test('Strip Footing v4 rejects persisted legacy end_forms roles', () => {
  const input = request('run_endpoints');
  input.measurementRoles.push(role('end_forms', 'ends-legacy', 2, 'EA', 'count'));
  assert.throws(() => calculateStripFootingV4(input), /persisted end_forms roles are not supported/i);
});
