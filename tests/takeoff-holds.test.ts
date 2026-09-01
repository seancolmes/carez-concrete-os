import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveAssemblyPropertyValues } from '../lib/takeoff/assemblyContext.ts';
import { evaluateRule, ruleVariables, type RuleExpression } from '../lib/takeoff/rules.ts';

const requiredSelectors = [
  { id: 'formwork', variable_key: 'formwork_method', label: 'Formwork Method', value_type: 'enum', required: true, default_value: null, options: [{ value: 'earth_formed' }, { value: 'formed_footing' }] },
  { id: 'placement', variable_key: 'placement_method', label: 'Placement Method', value_type: 'enum', required: true, default_value: null, options: [{ value: 'direct_chute' }, { value: 'line_pump' }] },
  { id: 'reinforcement', variable_key: 'reinforcement_method', label: 'Reinforcement Method', value_type: 'enum', required: true, default_value: null, options: [{ value: 'none' }, { value: 'continuous_rebar' }] },
];

const placementDirectRule: RuleExpression = {
  op: 'eq',
  left: { var: 'properties.placement_method' },
  right: { const: 'direct_chute' },
};
const placementPumpRule: RuleExpression = {
  op: 'eq',
  left: { var: 'properties.placement_method' },
  right: { const: 'line_pump' },
};

test('required method selectors remain explicit missing inputs until the estimator chooses them', () => {
  const unresolved = resolveAssemblyPropertyValues({
    variables: requiredSelectors,
    bindings: [],
    explicitInputs: {},
    context: {},
  });

  assert.deepEqual(
    unresolved.missingRequired.map(input => input.label),
    ['Formwork Method', 'Placement Method', 'Reinforcement Method'],
  );
  assert.equal(evaluateRule(placementDirectRule, { properties: unresolved.storedValues }), false);
  assert.deepEqual(ruleVariables(placementDirectRule), ['properties.placement_method']);

  const resolved = resolveAssemblyPropertyValues({
    variables: requiredSelectors,
    bindings: [],
    explicitInputs: {
      formwork_method: 'formed_footing',
      placement_method: 'direct_chute',
      reinforcement_method: 'continuous_rebar',
    },
    context: {},
  });

  assert.deepEqual(resolved.missingRequired, []);
  assert.equal(evaluateRule(placementDirectRule, { properties: resolved.storedValues }), true);
  assert.equal(evaluateRule(placementPumpRule, { properties: resolved.storedValues }), false);
});

test('sync migration preserves missing_input before inactive branches fall back to not_priced', () => {
  const sql = readFileSync('supabase/migrations/20260901033500_takeoff_nested_activation_missing_input.sql', 'utf8');
  const missingInput = "when coalesce(v_payload->>'pricing_status','')='missing_input' then 'missing_input'";
  const inactiveFallback = "else 'not_priced'";

  assert.ok(sql.includes(missingInput));
  assert.ok(sql.indexOf(missingInput) < sql.indexOf(inactiveFallback));
  assert.match(sql, /if not v_active or not v_visible then\s+delete from public\.estimate_items/i);
});
