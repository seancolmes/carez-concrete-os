import assert from 'node:assert/strict';
import test from 'node:test';
import { conditionArchetype } from '../lib/takeoff/conditions/catalog.ts';
import { calculateCondition } from '../lib/takeoff/conditions/calculate.ts';
import type {
  ConditionCalculationRequest,
  ConditionInputGroup,
  ConditionInputGroups,
  ConditionMeasurementRole,
  ConditionScalar,
} from '../lib/takeoff/conditions/types.ts';

const value = (input: ConditionScalar) => ({ value: input, mode: 'project_value' as const, sourceLabel: 'edge fixture' });

function inputs(groups: Partial<Record<ConditionInputGroup, Record<string, ConditionScalar>>>): ConditionInputGroups {
  return Object.fromEntries(Object.entries(groups).map(([group, values]) => [
    group,
    Object.fromEntries(Object.entries(values || {}).map(([key, input]) => [key, value(input)])),
  ]));
}

const role = (
  roleKey: string,
  measurementId: string,
  quantity: number,
  unit: ConditionMeasurementRole['unit'],
  geometryType: ConditionMeasurementRole['geometryType'],
): ConditionMeasurementRole => ({ roleKey, measurementId, sheetId: 'EDGE-1', quantity, unit, geometryType });

test('V1 edge condition catalog exposes the requested concrete families', () => {
  for (const key of [
    'thickened_edge',
    'thickened_slab',
    'grade_beam',
    'foundation_wall',
    'column_pier',
    'elevated_slab',
    'stairs',
    'curb',
    'opening_boxout',
  ]) {
    assert.equal(conditionArchetype(key as never).key, key);
  }
});

test('grade beam produces deterministic concrete, forms, reinforcing, excavation, and labor outputs', () => {
  const request = {
    archetypeKey: 'grade_beam',
    conditionVersionId: 'condition-grade-beam-edge-v1',
    measurementRoles: [role('run', 'grade-beam-run', 120, 'LF', 'polyline')],
    inputs: inputs({
      planFacts: { width_ft: 1.5, depth_ft: 2, excavation_width_ft: 3, excavation_depth_ft: 2.5 },
      methods: { formed_sides: 2, longitudinal_bar_count: 4, rebar_unit_weight_lb_per_ft: 0.668 },
      commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 },
      production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 },
    }),
  } as unknown as ConditionCalculationRequest;

  const calculation = calculateCondition(request);
  const quantity = (key: string) => calculation.outputs.find(output => output.outputKey === key)?.quantity;
  assert.equal(quantity('concrete.installed_cy'), 13.3333);
  assert.equal(quantity('concrete.procurement_cy'), 14);
  assert.equal(quantity('forms.contact_sf'), 480);
  assert.equal(quantity('reinforcing.steel_lb'), 352.704);
  assert.equal(quantity('excavation_backfill.excavation_cy'), 33.3333);
  assert.equal(quantity('labor.place_concrete_mh'), 6.6667);
});

test('edge families hold only outputs that depend on missing dimensions', () => {
  const calculation = calculateCondition({
    archetypeKey: 'foundation_wall' as never,
    conditionVersionId: 'condition-foundation-wall-holds',
    measurementRoles: [role('run', 'foundation-wall-run', 80, 'LF', 'polyline')],
    inputs: inputs({
      planFacts: { height_ft: 2 },
      commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 },
      production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 },
    }),
  });

  const output = (key: string) => calculation.outputs.find(item => item.outputKey === key);
  assert.equal(output('concrete.installed_cy')?.status, 'held');
  assert.equal(output('concrete.procurement_cy')?.status, 'held');
  assert.equal(output('reinforcing.steel_lb')?.status, 'held');
  assert.equal(output('labor.place_concrete_mh')?.status, 'held');
  assert.equal(output('forms.contact_sf')?.status, 'held');
});

test('every edge family emits its complete declared output schema', () => {
  const fixtures: Array<{ key: string; roles: ConditionMeasurementRole[]; groups: Partial<Record<ConditionInputGroup, Record<string, ConditionScalar>>> }> = [
    {
      key: 'thickened_edge',
      roles: [role('run', 'thickened-edge-run', 40, 'LF', 'polyline')],
      groups: { planFacts: { width_ft: 1, depth_ft: 2, slab_thickness_in: 5 }, methods: { formed_sides: 2, longitudinal_bar_count: 2, rebar_unit_weight_lb_per_ft: 0.668 }, commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 }, production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 } },
    },
    {
      key: 'thickened_slab',
      roles: [role('area', 'thickened-slab-area', 500, 'SF', 'polygon'), role('thickened_edge', 'thickened-slab-edge', 40, 'LF', 'polyline')],
      groups: { planFacts: { thickness_in: 5, thickened_width_ft: 2, thickened_depth_in: 18 }, methods: { formed_sides: 2, reinforcing_lb_per_sf: 0.75 }, commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 }, production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 } },
    },
    {
      key: 'foundation_wall',
      roles: [role('run', 'foundation-wall-run-ready', 80, 'LF', 'polyline')],
      groups: { planFacts: { thickness_ft: 0.67, height_ft: 8, excavation_width_ft: 4, excavation_depth_ft: 3 }, methods: { formed_sides: 2, longitudinal_bar_count: 4, rebar_unit_weight_lb_per_ft: 0.668 }, commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 }, production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 } },
    },
    {
      key: 'column_pier',
      roles: [role('locations', 'column-pier-locations', 4, 'EA', 'count')],
      groups: { planFacts: { width_ft: 2, length_ft: 2, depth_ft: 10 }, methods: { formed_sides: 4, rebar_lf_per_each: 80, rebar_unit_weight_lb_per_ft: 0.668 }, commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 }, production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 } },
    },
    {
      key: 'elevated_slab',
      roles: [role('area', 'elevated-slab-area', 500, 'SF', 'polygon'), role('edge_forms', 'elevated-slab-edge', 100, 'LF', 'polyline')],
      groups: { planFacts: { thickness_in: 6 }, methods: { formed_sides: 2, reinforcing_lb_per_sf: 0.75 }, commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 }, production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 } },
    },
    {
      key: 'stairs',
      roles: [role('locations', 'stair-flights', 2, 'EA', 'count')],
      groups: { planFacts: { stair_width_ft: 4, tread_depth_ft: 1, riser_count: 12, riser_height_in: 7, waist_thickness_in: 8 }, methods: { formed_sides: 2, reinforcing_lb_per_sf: 0.75 }, commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 }, production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 } },
    },
    {
      key: 'curb',
      roles: [role('run', 'curb-run', 100, 'LF', 'polyline')],
      groups: { planFacts: { width_ft: 0.5, height_ft: 1 }, methods: { formed_sides: 2, rebar_lb_per_lf: 0.5 }, commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 }, production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02 } },
    },
    {
      key: 'opening_boxout',
      roles: [role('locations', 'opening-boxouts', 3, 'EA', 'count')],
      groups: { planFacts: { width_ft: 2, height_ft: 3, depth_ft: 1 }, methods: { formed_sides: 4 }, production: { form_mh_per_sf: 0.05 } },
    },
  ];

  for (const fixture of fixtures) {
    const calculation = calculateCondition({
      archetypeKey: fixture.key as never,
      conditionVersionId: `condition-${fixture.key}-complete`,
      measurementRoles: fixture.roles,
      inputs: inputs(fixture.groups),
    });
    assert.equal(calculation.outputs.length, conditionArchetype(fixture.key as never).outputs.length, fixture.key);
    assert.ok(calculation.outputs.every(output => output.status === 'ready'), fixture.key);
  }
});
