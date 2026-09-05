import assert from 'node:assert/strict';
import test from 'node:test';
import { projectConditionWorksheet } from '../lib/takeoff/conditionWorksheet.ts';

const base = {
  measurementId: 'm1',
  conditionVersionId: 'v1',
  conditionName: 'F1 Strip Footing',
  holds: [],
};

test('Condition worksheet suppresses compatibility quantities before first calculation', () => {
  const projected = projectConditionWorksheet({ ...base, calculated: false, outputs: [] });
  assert.equal(projected.status, 'Not calculated');
  assert.equal(projected.concrete, '—');
  assert.equal(projected.reinforcing, '—');
  assert.equal(projected.formwork, '—');
  assert.equal(projected.manHours, 0);
  assert.equal(projected.cost, 0);
});

test('Condition worksheet suppresses stale outputs while working state is pending recalculation', () => {
  const projected = projectConditionWorksheet({
    ...base,
    calculated: false,
    pendingRecalculation: true,
    outputs: [{ id: 'o1', output_key: 'concrete.installed_cy', label: 'Concrete — installed', production_quantity: 8, production_unit: 'CY', status: 'ready', direct_cost: 1200, pricing_status: 'priced' }],
  });
  assert.equal(projected.status, 'Pending recalculation');
  assert.equal(projected.concrete, '—');
  assert.equal(projected.cost, 0);
});

test('Condition worksheet uses installed rebar and Condition labor instead of compatibility outputs', () => {
  const projected = projectConditionWorksheet({
    ...base,
    calculated: true,
    outputs: [
      { id: 'o1', output_key: 'concrete.installed_cy', label: 'Concrete — installed', production_quantity: 8, production_unit: 'CY', status: 'ready', direct_cost: 800, pricing_status: 'priced' },
      { id: 'o2', output_key: 'reinforcing.installed_lb', label: 'Rebar — installed', production_quantity: 500, production_unit: 'LB', status: 'ready', direct_cost: 0, pricing_status: 'missing_price' },
      { id: 'o3', output_key: 'reinforcing.procurement_lb', label: 'Rebar — procurement', production_quantity: 525, production_unit: 'LB', status: 'ready', direct_cost: 0, pricing_status: 'missing_price' },
      { id: 'o4', output_key: 'forms.side_contact_sf', label: 'Side forms', production_quantity: 100, production_unit: 'SF', status: 'ready', direct_cost: 200, pricing_status: 'priced' },
      { id: 'o5', output_key: 'labor.forms_mh', label: 'Form labor', production_quantity: 12, production_unit: 'HR', status: 'ready', direct_cost: 900, pricing_status: 'priced' },
    ],
  });
  assert.equal(projected.concrete, '8 CY');
  assert.equal(projected.reinforcing, '500 LB');
  assert.equal(projected.formwork, '100 SF');
  assert.equal(projected.manHours, 12);
  assert.equal(projected.cost, 1900);
  assert.match(projected.status, /Qty ready/);
  assert.equal(projected.pricingMissing, 2);
});
