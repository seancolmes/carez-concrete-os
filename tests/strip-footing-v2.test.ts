import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStripFootingV2 } from '../lib/takeoff/conditions/stripFootingV2.ts';
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

function fullRequest(): ConditionCalculationRequest {
  return {
    archetypeKey: 'strip_wall_footing',
    conditionVersionId: 'strip-v2-fixture',
    measurementRoles: [
      role('run', 'run-1', 100, 'LF', 'polyline'),
      role('end_forms', 'ends-1', 2, 'EA', 'count'),
      role('anchors_embeds', 'anchors-1', 10, 'EA', 'count'),
    ],
    inputs: inputs({
      planFacts: { width_ft: 2, depth_ft: 1 },
      production: {
        place_concrete_mh_per_cy: 0.5,
        form_mh_per_sf: 0.05,
        rebar_mh_per_lb: 0.02,
        anchor_embed_mh_per_ea: 0.1,
        excavation_mh_per_cy: 0.1,
        backfill_mh_per_cy: 0.08,
        misc_mh_per_ea: 0.2,
      },
      commercial: { concrete_waste_pct: 5 },
    }),
    modules: [
      module('concrete', true, { profile: 'rectangular', placement_method: 'line_pump', top_finish: 'float' }),
      module('forms', true, { formed_sides: 2, resource_tracking: true, form_material_factor_lf_per_lf: 1, stakes_enabled: true, stake_spacing_ft: 4, stakes_per_location: 1 }),
      module('reinforcing', false),
      module('reinforcing', true, { kind: 'continuous', bar_size: '#5', bars_per_run: 3, layers: 1, faces: 1, splice_policy: 'stock_lap', stock_length_ft: 20, lap_length_in: 24, waste_pct: 5 }, 'reinforcing-1', 'Continuous #5'),
      module('reinforcing', true, { kind: 'transverse', bar_size: '#4', spacing_in: 18, pieces_per_location: 1, piece_length_ft: 2, extra_locations: 0, layers: 1, faces: 1, waste_pct: 5 }, 'reinforcing-2', 'Transverse #4'),
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

test('Strip Footing v2 calculates concrete, forms, repeatable reinforcing, excavation, equipment, misc, and labor', () => {
  const calculation = calculateStripFootingV2(fullRequest());
  const output = (key: string) => {
    const found = calculation.outputs.find(item => item.outputKey === key);
    assert.ok(found, `Missing ${key}`);
    return found;
  };

  closeTo(output('concrete.installed_cy').quantity, 7.4074);
  closeTo(output('concrete.procurement_cy').quantity, 7.7778);
  assert.equal(output('forms.side_contact_sf').quantity, 200);
  assert.equal(output('forms.end_contact_sf').quantity, 4);
  assert.equal(output('forms.form_material_lf').quantity, 204);
  assert.equal(output('forms.stakes_ea').quantity, 52);
  closeTo(output('reinforcing.steel_lb').quantity, 450.219);
  assert.equal(output('anchors_embeds.anchor_ea').quantity, 10);
  closeTo(output('excavation_backfill.excavation_cy').quantity, 22.2222);
  closeTo(output('excavation_backfill.loose_cy').quantity, 26.6667);
  closeTo(output('excavation_backfill.export_cy').quantity, 13.3333);
  closeTo(output('excavation_backfill.backfill_cy').quantity, 14.8148);
  closeTo(output('placement_equipment.equipment_hr').quantity, 1.3704);
  assert.equal(output('finish_cure_protection.finish_sf').quantity, 200);
  assert.equal(output('finish_cure_protection.protection_sf').quantity, 200);
  assert.equal(output('miscellaneous.item_ea').quantity, 5);
  closeTo(output('labor.place_concrete_mh').quantity, 3.7037);
  closeTo(output('labor.forms_mh').quantity, 10.2);
  closeTo(output('labor.reinforcing_mh').quantity, 9.0044);
  assert.equal(output('labor.anchors_embeds_mh').quantity, 1);
  closeTo(output('labor.excavation_mh').quantity, 2.2222);
  closeTo(output('labor.backfill_mh').quantity, 1.1852);
  assert.equal(output('labor.misc_mh').quantity, 1);
});

test('a missing reinforcing fact holds only reinforcing-dependent outputs', () => {
  const request = fullRequest();
  request.modules = request.modules?.map(item => item.instanceKey === 'reinforcing-2'
    ? { ...item, inputValues: { ...item.inputValues, spacing_in: '' } }
    : item);
  const calculation = calculateStripFootingV2(request);
  const concrete = calculation.outputs.find(item => item.outputKey === 'concrete.installed_cy');
  const rebar = calculation.outputs.find(item => item.outputKey === 'reinforcing.steel_lb');
  const rebarLabor = calculation.outputs.find(item => item.outputKey === 'labor.reinforcing_mh');
  const forms = calculation.outputs.find(item => item.outputKey === 'forms.side_contact_sf');
  assert.equal(concrete?.status, 'ready');
  assert.equal(forms?.status, 'ready');
  assert.equal(rebar?.status, 'held');
  assert.equal(rebarLabor?.status, 'held');
  assert.ok(rebar?.holds.some(item => item.message.includes('spacing')));
});

test('reinforcing calculator does not infer a bar size when the estimator has not supplied one', () => {
  const request = fullRequest();
  request.modules = request.modules?.map(item => item.instanceKey === 'reinforcing-1'
    ? { ...item, inputValues: { ...item.inputValues, bar_size: '' } }
    : item);
  const calculation = calculateStripFootingV2(request);
  const rebar = calculation.outputs.find(item => item.outputKey === 'reinforcing.steel_lb');
  assert.equal(rebar?.status, 'held');
  assert.ok(rebar?.holds.some(item => item.message.toLowerCase().includes('bar size')));
});
