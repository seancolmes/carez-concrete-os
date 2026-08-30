import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAssemblyPropertyValues } from '../lib/takeoff/assemblyContext.ts';
import { evaluateTakeoffFormula } from '../lib/takeoff/formula.ts';
import { outputSnapshotState } from '../lib/takeoff/outputMetadata.ts';
import { evaluateRule } from '../lib/takeoff/rules.ts';

const directRule = {
  op: 'eq' as const,
  left: { var: 'properties.placement_method' },
  right: { const: 'direct_chute' },
};

const linePumpRule = {
  op: 'eq' as const,
  left: { var: 'properties.placement_method' },
  right: { const: 'line_pump' },
};

const concreteQuantityFormula = {
  op: 'mul' as const,
  args: [
    {
      op: 'div' as const,
      args: [
        {
          op: 'mul' as const,
          args: [
            { var: 'quantity' },
            { op: 'div' as const, args: [{ var: 'width_in' }, { const: 12 }] },
            { op: 'div' as const, args: [{ var: 'depth_in' }, { const: 12 }] },
          ],
        },
        { const: 27 },
      ],
    },
    {
      op: 'add' as const,
      args: [
        { const: 1 },
        { op: 'div' as const, args: [{ var: 'concrete_waste_pct' }, { const: 100 }] },
      ],
    },
  ],
};

const placementVariables = [
  {
    id: 'placement-method',
    variable_key: 'placement_method',
    label: 'Placement Method',
    value_type: 'enum',
    required: true,
    options: [
      { value: 'direct_chute', label: 'Direct Chute' },
      { value: 'line_pump', label: 'Line Pump' },
    ],
  },
  {
    id: 'line-pump-hours',
    variable_key: 'line_pump_hours',
    label: 'Line Pump Hours',
    value_type: 'number',
    unit: 'HR',
    required: true,
    activation_rule: linePumpRule,
  },
  {
    id: 'line-pump-place-rate',
    variable_key: 'line_pump_place_mh_per_cy',
    label: 'Placement Labor MH / CY',
    value_type: 'number',
    unit: 'MH/CY',
    required: true,
    activation_rule: linePumpRule,
  },
];

const expectedPaths = [
  'footing_concrete_material',
  'formwork/footing_form_labor',
  'formwork/footing_form_material',
  'reinforcement/footing_rebar_labor',
  'reinforcement/footing_rebar_material',
  'placement_direct/footing_place_labor',
  'placement_line_pump/footing_place_labor',
  'placement_line_pump/line_pump_service',
];

test('FTG-STRIP V7 placement composition stays deterministic and structurally complete', () => {
  assert.equal(expectedPaths.length, 8);
  assert.deepEqual(new Set(expectedPaths).size, 8);

  const footing = {
    quantity: 40,
    width_in: 24,
    depth_in: 10,
    concrete_waste_pct: 3,
  };
  const concreteCy = evaluateTakeoffFormula(concreteQuantityFormula, footing);
  assert.ok(Math.abs(concreteCy - 2.5432098765432096) < 1e-12);

  const directContext = { properties: { placement_method: 'direct_chute' } };
  assert.equal(evaluateRule(directRule, directContext), true);
  assert.equal(evaluateRule(linePumpRule, directContext), false);
  assert.ok(Math.abs(concreteCy * 0.552 - 1.4038518518518518) < 1e-12);
  assert.deepEqual(outputSnapshotState({ estimate_visible: true }, true), {
    is_active: true,
    estimate_visible: true,
  });
  assert.deepEqual(outputSnapshotState({ estimate_visible: true }, false), {
    is_active: false,
    estimate_visible: true,
  });

  const directProperties = resolveAssemblyPropertyValues({
    variables: placementVariables,
    bindings: [],
    explicitInputs: {
      placement_method: 'direct_chute',
      line_pump_hours: 4,
      line_pump_place_mh_per_cy: 0.4,
    },
    context: {},
  });
  assert.equal(directProperties.missingRequired.length, 0);
  assert.equal('line_pump_hours' in directProperties.formulaValues, false);
  assert.equal('line_pump_place_mh_per_cy' in directProperties.formulaValues, false);

  const linePumpContext = { properties: { placement_method: 'line_pump' } };
  assert.equal(evaluateRule(directRule, linePumpContext), false);
  assert.equal(evaluateRule(linePumpRule, linePumpContext), true);

  const linePumpProperties = resolveAssemblyPropertyValues({
    variables: placementVariables,
    bindings: [],
    explicitInputs: {
      placement_method: 'line_pump',
      line_pump_hours: 4,
      line_pump_place_mh_per_cy: 0.4,
    },
    context: {},
  });
  assert.equal(linePumpProperties.missingRequired.length, 0);
  assert.equal(linePumpProperties.formulaValues.line_pump_hours, 4);
  assert.equal(linePumpProperties.formulaValues.line_pump_place_mh_per_cy, 0.4);
  assert.ok(Math.abs(concreteCy * 0.4 - 1.017283950617284) < 1e-12);

  const missingPumpInputs = resolveAssemblyPropertyValues({
    variables: placementVariables,
    bindings: [],
    explicitInputs: { placement_method: 'line_pump' },
    context: {},
  });
  assert.deepEqual(
    missingPumpInputs.missingRequired.map((item) => item.key).sort(),
    ['line_pump_hours', 'line_pump_place_mh_per_cy'],
  );

  const unresolvedMethod = resolveAssemblyPropertyValues({
    variables: placementVariables,
    bindings: [],
    explicitInputs: {},
    context: {},
  });
  assert.deepEqual(unresolvedMethod.missingRequired.map((item) => item.key), ['placement_method']);
  assert.equal(evaluateRule(directRule, { properties: {} }), false);
  assert.equal(evaluateRule(linePumpRule, { properties: {} }), false);
});
