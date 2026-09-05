import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStripFootingV3 } from '../lib/takeoff/conditions/stripFootingV3.ts';
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
  instanceKey = 'default',
  label?: string,
): ConditionModuleConfiguration => ({ moduleKey, instanceKey, enabled, inputValues, label: label || moduleKey, sortOrder: 10 });
const closeTo = (actual: number | null, expected: number, epsilon = 0.001) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(Number(actual) - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};

function request(): ConditionCalculationRequest {
  return {
    archetypeKey: 'strip_wall_footing',
    conditionVersionId: 'strip-v3-fixture',
    measurementRoles: [
      role('run', 'run-1', 100, 'LF', 'polyline'),
      role('end_forms', 'ends-1', 2, 'EA', 'count'),
      role('anchors_embeds', 'anchors-1', 10, 'EA', 'count'),
    ],
    inputs: inputs({
      planFacts: { width_ft: 2, depth_ft: 1 },
      production: {
        place_concrete_labor_method: 'factor',
        place_concrete_mh_per_unit: 0.5,
        forms_labor_method: 'crew_rate',
        forms_crew_size: 4,
        forms_production_per_crew_hr: 100,
        reinforcing_labor_method: 'factor',
        reinforcing_mh_per_unit: 0.02,
        anchors_embeds_labor_method: 'factor',
        anchors_embeds_mh_per_unit: 0.1,
        excavation_labor_method: 'factor',
        excavation_mh_per_unit: 0.1,
        backfill_labor_method: 'factor',
        backfill_mh_per_unit: 0.08,
        finish_labor_method: 'factor',
        finish_mh_per_unit: 0.01,
        cure_protection_labor_method: 'crew_rate',
        cure_protection_crew_size: 2,
        cure_protection_production_per_crew_hr: 200,
        misc_labor_method: 'factor',
        misc_mh_per_unit: 0.2,
      },
      commercial: { concrete_waste_pct: 5 },
    }),
    modules: [
      module('concrete', true, { profile: 'rectangular' }),
      module('forms', true, { form_method: 'two_sides', formed_sides: 2, resource_tracking: true, form_material_factor_lf_per_lf: 1, stakes_enabled: true, stake_spacing_ft: 4, stakes_per_location: 1 }),
      module('reinforcing', false),
      module('reinforcing', true, { kind: 'bottom_longitudinal', bar_size: '#5', bar_count: 2, splice_policy: 'stock_lap', stock_length_ft: 20, lap_length_in: 24, waste_pct: 5 }, 'reinforcing-1', 'Bottom longitudinal'),
      module('reinforcing', true, { kind: 'transverse', bar_size: '#4', spacing_in: 18, pieces_per_location: 1, piece_length_ft: 2, extra_locations: 0, waste_pct: 5 }, 'reinforcing-2', 'Transverse'),
      module('anchors_embeds', true, { kind: 'anchor_bolt', count_mode: 'measured_role' }),
      module('excavation_backfill', true, { excavation_method: 'machine_trench', bottom_width_mode: 'footing_plus_working_room', working_room_each_side_ft: 0.5, excavation_depth_ft: 2, side_slope_h_to_v: 0, swell_pct: 20, export_pct: 50, backfill_pct: 100, backfill_type: 'native' }),
      module('placement_equipment', true, { method: 'line_pump', placement_rate_cy_per_hr: 20, setup_hr: 1 }),
      module('finish_cure_protection', true, { finish_enabled: true, finish_type: 'float', cure_enabled: true, protection_type: 'curing_compound' }),
      module('labor', true),
      module('miscellaneous', false),
      module('miscellaneous', true, { category: 'hardware', description: 'Test item', quantity_ea: 5 }, 'miscellaneous-1', 'Test item'),
    ],
  };
}

test('Strip Footing v3 uses construction-native longitudinal counts without a faces multiplier', () => {
  const calculation = calculateStripFootingV3(request());
  const output = (key: string) => calculation.outputs.find(item => item.outputKey === key);
  closeTo(output('reinforcing.installed_lb')?.quantity ?? null, 316.136);
  closeTo(output('reinforcing.procurement_lb')?.quantity ?? null, 331.9428);
  closeTo(output('labor.reinforcing_mh')?.quantity ?? null, 6.3227);
});

test('Strip Footing v3 separates installed steel from procurement allowance', () => {
  const input = request();
  input.modules = input.modules?.map(item => item.moduleKey === 'reinforcing' && item.instanceKey !== 'default'
    ? { ...item, inputValues: { ...item.inputValues, waste_pct: 25 } }
    : item);
  const calculation = calculateStripFootingV3(input);
  const installed = calculation.outputs.find(item => item.outputKey === 'reinforcing.installed_lb');
  const procurement = calculation.outputs.find(item => item.outputKey === 'reinforcing.procurement_lb');
  const labor = calculation.outputs.find(item => item.outputKey === 'labor.reinforcing_mh');
  closeTo(installed?.quantity ?? null, 316.136);
  closeTo(procurement?.quantity ?? null, 395.17);
  closeTo(labor?.quantity ?? null, 6.3227);
});

test('Strip Footing v3 crew-rate productivity derives crew hours and total man-hours', () => {
  const calculation = calculateStripFootingV3(request());
  const forms = calculation.outputs.find(item => item.outputKey === 'labor.forms_mh');
  const finish = calculation.outputs.find(item => item.outputKey === 'labor.finish_mh');
  const cure = calculation.outputs.find(item => item.outputKey === 'labor.cure_protection_mh');
  closeTo(forms?.quantity ?? null, 8.16);
  closeTo(finish?.quantity ?? null, 2);
  closeTo(cure?.quantity ?? null, 2);
  assert.ok(forms?.trace.values.some(item => item.key === 'forms.crew_hours' && Number(item.value) === 2.04));
});

test('Strip Footing v3 scopes a missing productivity input to the dependent labor output', () => {
  const input = request();
  delete input.inputs?.production?.forms_production_per_crew_hr;
  const calculation = calculateStripFootingV3(input);
  const concrete = calculation.outputs.find(item => item.outputKey === 'concrete.installed_cy');
  const forms = calculation.outputs.find(item => item.outputKey === 'labor.forms_mh');
  const rebar = calculation.outputs.find(item => item.outputKey === 'labor.reinforcing_mh');
  assert.equal(concrete?.status, 'ready');
  assert.equal(forms?.status, 'held');
  assert.equal(rebar?.status, 'ready');
  assert.ok(forms?.holds.some(item => item.message.toLowerCase().includes('production per crew hour')));
});
