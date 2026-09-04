import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCondition } from '../lib/takeoff/conditions/calculate.ts';
import { adaptConditionOutputsToLegacy } from '../lib/takeoff/conditions/legacyAdapter.ts';
import {
  assertCompleteConditionMappings,
  buildConditionCommitOutputs,
  resolveConditionInputGroups,
} from '../lib/takeoff/conditions/persistence.ts';
import type {
  ConditionCalculationRequest,
  ConditionInputGroup,
  ConditionInputGroups,
  ConditionMeasurementRole,
  ConditionScalar,
} from '../lib/takeoff/conditions/types.ts';

const value = (input: ConditionScalar) => ({ value: input, mode: 'project_value' as const, sourceLabel: 'fixture' });

function inputs(groups: Partial<Record<ConditionInputGroup, Record<string, ConditionScalar>>>): ConditionInputGroups {
  return Object.fromEntries(Object.entries(groups).map(([group, values]) => [
    group,
    Object.fromEntries(Object.entries(values || {}).map(([key, input]) => [key, value(input)])),
  ]));
}

const role = (
  roleKey: string,
  measurementId: string,
  sheetId: string,
  quantity: number,
  unit: ConditionMeasurementRole['unit'],
  geometryType: ConditionMeasurementRole['geometryType'],
): ConditionMeasurementRole => ({ roleKey, measurementId, sheetId, quantity, unit, geometryType });

const output = (request: ConditionCalculationRequest, key: string) => {
  const found = calculateCondition(request).outputs.find(item => item.outputKey === key);
  assert.ok(found, `Missing output ${key}`);
  return found;
};

test('pad footing produces deterministic EA, CY, SF, LB, and labor outputs', () => {
  const request: ConditionCalculationRequest = {
    archetypeKey: 'pad_column_footing',
    conditionVersionId: 'condition-pad-v1',
    measurementRoles: [
      role('locations', 'pad-count', 'S1', 4, 'EA', 'count'),
      role('anchors_embeds', 'pad-anchors', 'S2', 16, 'EA', 'count'),
    ],
    inputs: inputs({
      planFacts: { width_ft: 6, length_ft: 6, depth_ft: 1.5 },
      methods: { formed_sides: 4, rebar_lf_per_each: 80, rebar_unit_weight_lb_per_ft: 0.668 },
      commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 },
      production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02, anchor_embed_mh_per_ea: 0.1 },
    }),
  };

  assert.equal(output(request, 'concrete.installed_cy').quantity, 8);
  assert.equal(output(request, 'concrete.procurement_cy').quantity, 8.4);
  assert.equal(output(request, 'forms.contact_sf').quantity, 144);
  assert.equal(output(request, 'reinforcing.steel_lb').quantity, 235.136);
  assert.equal(output(request, 'anchors_embeds.anchor_ea').quantity, 16);
  assert.equal(output(request, 'labor.place_concrete_mh').quantity, 4);
  assert.equal(output(request, 'labor.forms_mh').quantity, 7.2);
  assert.equal(output(request, 'labor.reinforcing_mh').quantity, 4.7027);
  assert.equal(output(request, 'labor.anchors_embeds_mh').quantity, 1.6);
});

test('strip footing aggregates independent primary and secondary roles across sheets', () => {
  const request: ConditionCalculationRequest = {
    archetypeKey: 'strip_wall_footing',
    conditionVersionId: 'condition-strip-v1',
    measurementRoles: [
      role('run', 'run-a', 'S1', 40, 'LF', 'polyline'),
      role('run', 'run-b', 'S2', 60, 'LF', 'polyline'),
      role('end_forms', 'ends', 'S2', 2, 'EA', 'count'),
      role('anchors_embeds', 'anchors-a', 'S1', 8, 'EA', 'count'),
      role('anchors_embeds', 'anchors-b', 'S2', 12, 'EA', 'count'),
    ],
    inputs: inputs({
      planFacts: { width_ft: 2, depth_ft: 1 },
      methods: { formed_sides: 2, longitudinal_bar_count: 4, rebar_unit_weight_lb_per_ft: 0.668 },
      commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10 },
      production: { place_concrete_mh_per_cy: 0.5, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02, anchor_embed_mh_per_ea: 0.1 },
    }),
  };

  assert.equal(output(request, 'concrete.installed_cy').quantity, 7.4074);
  assert.equal(output(request, 'concrete.procurement_cy').quantity, 7.7778);
  assert.equal(output(request, 'forms.side_contact_sf').quantity, 200);
  assert.equal(output(request, 'forms.end_contact_sf').quantity, 4);
  assert.equal(output(request, 'reinforcing.steel_lb').quantity, 293.92);
  assert.equal(output(request, 'anchors_embeds.anchor_ea').quantity, 20);
  assert.deepEqual(output(request, 'concrete.installed_cy').trace.measurementIds, ['run-a', 'run-b']);
  assert.deepEqual(output(request, 'anchors_embeds.anchor_ea').trace.measurementIds, ['anchors-a', 'anchors-b']);
});

test('slab uses cutout-adjusted SF while edge forms and embeds remain separate roles', () => {
  const request: ConditionCalculationRequest = {
    archetypeKey: 'slab_on_grade',
    conditionVersionId: 'condition-slab-v1',
    measurementRoles: [
      role('area', 'net-area-a', 'S1', 500, 'SF', 'polygon'),
      role('area', 'net-area-b', 'S2', 400, 'SF', 'polygon'),
      role('edge_forms', 'slab-edge', 'S1', 140, 'LF', 'polyline'),
      role('anchors_embeds', 'slab-embeds', 'S2', 12, 'EA', 'count'),
    ],
    inputs: inputs({
      planFacts: { thickness_in: 5, base_depth_in: 4 },
      methods: { reinforcing_lb_per_sf: 0.75 },
      commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10, vapor_barrier_waste_pct: 10 },
      production: { place_finish_mh_per_sf: 0.025, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02, anchor_embed_mh_per_ea: 0.1 },
    }),
  };

  assert.equal(output(request, 'concrete.installed_cy').quantity, 13.8889);
  assert.equal(output(request, 'concrete.procurement_cy').quantity, 14.5833);
  assert.equal(output(request, 'forms.edge_contact_sf').quantity, 58.3333);
  assert.equal(output(request, 'reinforcing.steel_lb').quantity, 742.5);
  assert.equal(output(request, 'slab_systems.vapor_barrier_sf').quantity, 990);
  assert.equal(output(request, 'slab_systems.base_cy').quantity, 11.1111);
  assert.equal(output(request, 'anchors_embeds.anchor_ea').quantity, 12);
  assert.equal(output(request, 'labor.place_finish_mh').quantity, 22.5);
});

test('missing dimensions hold only dependent outputs while valid geometry remains usable', () => {
  const request: ConditionCalculationRequest = {
    archetypeKey: 'slab_on_grade',
    conditionVersionId: 'condition-slab-holds',
    measurementRoles: [
      role('area', 'net-area', 'S1', 900, 'SF', 'polygon'),
      role('edge_forms', 'edge', 'S1', 140, 'LF', 'polyline'),
      role('anchors_embeds', 'embeds', 'S1', 12, 'EA', 'count'),
    ],
    inputs: inputs({
      planFacts: { base_depth_in: 4 },
      methods: { reinforcing_lb_per_sf: 0.75 },
      commercial: { concrete_waste_pct: 5, rebar_waste_pct: 10, vapor_barrier_waste_pct: 10 },
      production: { place_finish_mh_per_sf: 0.025, form_mh_per_sf: 0.05, rebar_mh_per_lb: 0.02, anchor_embed_mh_per_ea: 0.1 },
    }),
  };

  assert.equal(output(request, 'concrete.installed_cy').status, 'held');
  assert.equal(output(request, 'concrete.procurement_cy').status, 'held');
  assert.equal(output(request, 'forms.edge_contact_sf').status, 'held');
  assert.equal(output(request, 'reinforcing.steel_lb').status, 'ready');
  assert.equal(output(request, 'slab_systems.vapor_barrier_sf').status, 'ready');
  assert.equal(output(request, 'slab_systems.base_cy').status, 'ready');
  assert.equal(output(request, 'anchors_embeds.anchor_ea').status, 'ready');
  assert.equal(output(request, 'labor.place_finish_mh').status, 'ready');
});

test('explicit output override preserves the derived value and becomes the downstream quantity', () => {
  const request: ConditionCalculationRequest = {
    archetypeKey: 'pad_column_footing',
    conditionVersionId: 'condition-pad-override',
    measurementRoles: [role('locations', 'pad-count', 'S1', 4, 'EA', 'count')],
    modules: [
      { moduleKey: 'forms', enabled: false },
      { moduleKey: 'reinforcing', enabled: false },
      { moduleKey: 'anchors_embeds', enabled: false },
      { moduleKey: 'labor', enabled: false },
    ],
    inputs: inputs({
      planFacts: { width_ft: 6, length_ft: 6, depth_ft: 1.5 },
      commercial: { concrete_waste_pct: 5 },
    }),
    outputOverrides: {
      'concrete.installed_cy': { quantity: 9, reason: 'Estimator-confirmed stepped footing volume', sourceLabel: 'Detail 3/S5.1' },
    },
  };

  const installed = output(request, 'concrete.installed_cy');
  assert.equal(installed.quantity, 9);
  assert.equal(installed.quantityMode, 'explicit_override');
  assert.equal(installed.trace.derivedQuantity, 8);
  assert.equal(output(request, 'concrete.procurement_cy').quantity, 9.45);
  assert.equal(output(request, 'forms.contact_sf').status, 'inactive');
});

test('measurement role unit and geometry contracts are enforced', () => {
  assert.throws(
    () => calculateCondition({
      archetypeKey: 'strip_wall_footing',
      conditionVersionId: 'invalid-role',
      measurementRoles: [role('run', 'wrong', 'S1', 100, 'SF', 'polygon')],
    }),
    /requires polyline geometry measured in LF/,
  );
});

test('legacy adapter emits existing atomic-RPC payload without invoking formula logic', () => {
  const calculation = calculateCondition({
    archetypeKey: 'pad_column_footing',
    conditionVersionId: 'condition-pad-compat',
    measurementRoles: [role('locations', 'pad-count', 'S1', 4, 'EA', 'count')],
    modules: [
      { moduleKey: 'forms', enabled: false },
      { moduleKey: 'reinforcing', enabled: false },
      { moduleKey: 'anchors_embeds', enabled: false },
      { moduleKey: 'labor', enabled: false },
    ],
    inputs: inputs({
      planFacts: { width_ft: 6, length_ft: 6, depth_ft: 1.5 },
      commercial: { concrete_waste_pct: 5 },
    }),
  });

  const payload = adaptConditionOutputsToLegacy(calculation, [
    {
      outputKey: 'concrete.installed_cy',
      assemblyComponentId: 'legacy-concrete-component',
      componentKey: 'concrete',
      label: 'Concrete',
      estimateItemType: 'material',
      outputUnit: 'CY',
      unitCost: 175,
      costSource: 'fixture quote',
    },
    {
      outputKey: 'forms.contact_sf',
      assemblyComponentId: 'legacy-forms-component',
      componentKey: 'forms',
      label: 'Forms',
      estimateItemType: 'material',
      outputUnit: 'SF',
    },
  ]);

  assert.equal(payload[0].production_quantity, 8);
  assert.equal(payload[0].direct_cost, 1400);
  assert.equal(payload[0].pricing_status, 'priced');
  assert.equal(payload[0].formula_trace.engine, 'concrete_condition_v1');
  assert.equal(payload[1].production_quantity, 0);
  assert.equal(payload[1].pricing_status, 'not_priced');
  assert.equal(payload[1].is_active, true);
  assert.equal(payload[1].estimate_visible, false);
});

test('project inputs override company defaults while provenance remains explicit', () => {
  const resolved = resolveConditionInputGroups({
    companyDefaults: {
      planFacts: { width_ft: 2, depth_ft: 1 },
      commercial: { concrete_waste_pct: 5 },
    },
    companyProvenance: {
      planFacts: { width_ft: { mode: 'company_default', sourceLabel: 'Perez footing default' } },
    },
    projectValues: {
      planFacts: { width_ft: 2.5 },
    },
    projectProvenance: {
      planFacts: { width_ft: { mode: 'explicit_override', sourceLabel: 'Detail 4/S5.1', note: 'Stepped footing' } },
    },
  });

  assert.deepEqual(resolved.planFacts?.width_ft, {
    value: 2.5,
    mode: 'explicit_override',
    sourceLabel: 'Detail 4/S5.1',
    note: 'Stepped footing',
  });
  assert.deepEqual(resolved.planFacts?.depth_ft, { value: 1, mode: 'company_default' });
  assert.deepEqual(resolved.commercial?.concrete_waste_pct, { value: 5, mode: 'company_default' });
});

test('database commit payload preserves holds and never accepts a second quantity source', () => {
  const calculation = calculateCondition({
    archetypeKey: 'slab_on_grade',
    conditionVersionId: 'condition-server-authority',
    measurementRoles: [role('area', 'slab-area', 'S1', 900, 'SF', 'polygon')],
    inputs: inputs({ commercial: { concrete_waste_pct: 5 } }),
  });
  const commit = buildConditionCommitOutputs(calculation);
  const concrete = commit.find(item => item.output_key === 'concrete.installed_cy');
  assert.ok(concrete);
  assert.equal(concrete.status, 'held');
  assert.equal(concrete.production_quantity, null);
  assert.equal(concrete.holds[0].hold_code, 'input_required');
  assert.equal(concrete.provenance.authority, 'server');
  assert.deepEqual(concrete.calculation_trace.measurementIds, ['slab-area']);
});

test('production persistence requires an exact one-to-one compatibility mapping', () => {
  const calculation = calculateCondition({
    archetypeKey: 'pad_column_footing',
    conditionVersionId: 'condition-mapping',
    measurementRoles: [role('locations', 'pad-count', 'S1', 4, 'EA', 'count')],
    modules: [
      { moduleKey: 'forms', enabled: false },
      { moduleKey: 'reinforcing', enabled: false },
      { moduleKey: 'anchors_embeds', enabled: false },
      { moduleKey: 'labor', enabled: false },
    ],
    inputs: inputs({
      planFacts: { width_ft: 6, length_ft: 6, depth_ft: 1.5 },
      commercial: { concrete_waste_pct: 5 },
    }),
  });
  const keys = calculation.outputs.map(item => item.outputKey);
  assert.doesNotThrow(() => assertCompleteConditionMappings(calculation, keys));
  assert.throws(
    () => assertCompleteConditionMappings(calculation, keys.slice(1)),
    /mapping is incomplete; missing concrete\.installed_cy/,
  );
  assert.throws(
    () => assertCompleteConditionMappings(calculation, [...keys, keys[0]]),
    /mapped more than once/,
  );
});
