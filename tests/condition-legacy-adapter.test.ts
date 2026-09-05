import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptConditionOutputsToLegacy } from '../lib/takeoff/conditions/legacyAdapter.ts';
import type { ConditionCalculation } from '../lib/takeoff/conditions/types.ts';

const calculation: ConditionCalculation = {
  archetypeKey: 'strip_wall_footing',
  conditionVersionId: 'condition-v3',
  outputs: [{
    outputKey: 'reinforcing.stock_bars_ea',
    moduleKey: 'reinforcing',
    label: 'Reinforcing stock bars — order guide',
    resourceClass: 'material',
    unit: 'EA',
    status: 'ready',
    quantity: 13,
    quantityMode: 'derived',
    holds: [],
    trace: { algorithm: 'strip-rebar-stock-bars-v3', conditionVersionId: 'condition-v3', measurementIds: ['m1'], values: [], derivedQuantity: 13 },
    legacyComponentKey: 'rebar_stock_bars',
  }],
};

test('non-estimate-visible Condition outputs remain available without creating pricing issues', () => {
  const [prepared] = adaptConditionOutputsToLegacy(calculation, [{
    outputKey: 'reinforcing.stock_bars_ea',
    assemblyComponentId: 'component-stock-bars',
    componentKey: 'rebar_stock_bars',
    label: 'Reinforcing stock bars — order guide',
    estimateItemType: 'material',
    outputUnit: 'EA',
    unitCost: null,
    estimateVisible: false,
    resourceBehavior: 'consumed_material',
  }]);
  assert.equal(prepared.production_quantity, 13);
  assert.equal(prepared.pricing_status, 'not_priced');
  assert.equal(prepared.estimate_visible, false);
  assert.equal(prepared.direct_cost, 0);
});
