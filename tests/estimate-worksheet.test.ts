import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWorksheetCostBuckets,
  getWorksheetLineQuantity,
  getWorksheetPricingLabel,
  getWorksheetPricingState,
} from '../lib/estimating/worksheet.ts';

test('generated output pricing states stay explicit', () => {
  const generated = { source_takeoff_output_id: 'output-1' };
  assert.equal(getWorksheetPricingState(generated, { pricing_status: 'missing_price' }), 'price_required');
  assert.equal(getWorksheetPricingState(generated, { pricing_status: 'missing_labor_rate' }), 'price_required');
  assert.equal(getWorksheetPricingState(generated, { pricing_status: 'manual_override' }), 'manual_override');
  assert.equal(getWorksheetPricingState(generated, { pricing_status: 'catalog' }), 'priced');
  assert.equal(getWorksheetPricingLabel('price_required'), 'PRICE REQUIRED');
});

test('manual estimate lines do not masquerade as takeoff pricing', () => {
  assert.equal(getWorksheetPricingState({ source_takeoff_output_id: null }, null), 'manual');
});

test('worksheet quantities use labor hours and preserve production units', () => {
  assert.deepEqual(
    getWorksheetLineQuantity({ item_type: 'labor', quantity: 12, regular_hours: 4.5, overtime_hours: 1.5, unit: 'EA' }),
    { quantity: 6, unit: 'HR' },
  );
  assert.deepEqual(
    getWorksheetLineQuantity({ item_type: 'material', quantity: 19.4, unit: 'CY' }),
    { quantity: 19.4, unit: 'CY' },
  );
});

test('direct costs land in one and only one worksheet bucket', () => {
  assert.deepEqual(getWorksheetCostBuckets({ item_type: 'material', direct_cost: 125 }), {
    material: 125,
    labor: 0,
    equipment: 0,
    total: 125,
  });
  assert.deepEqual(getWorksheetCostBuckets({ item_type: 'labor', direct_cost: 80 }), {
    material: 0,
    labor: 80,
    equipment: 0,
    total: 80,
  });
  assert.deepEqual(getWorksheetCostBuckets({ item_type: 'subcontractor', direct_cost: 500 }), {
    material: 0,
    labor: 0,
    equipment: 500,
    total: 500,
  });
});
