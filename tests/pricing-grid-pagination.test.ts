import assert from 'node:assert/strict';
import test from 'node:test';
import { groupPricingRows, paginateConditionGroups } from '../lib/estimating/pricingGrid.ts';

test('condition pagination never splits outputs, including an oversized condition', () => {
  const rows = [
    ...Array.from({ length: 2 }, (_, index) => ({ conditionId: 'a', conditionName: 'Footing', id: `a-${index}` })),
    ...Array.from({ length: 12 }, (_, index) => ({ conditionId: 'b', conditionName: 'Slab', id: `b-${index}` })),
    { conditionId: 'c', conditionName: 'Wall', id: 'c-0' },
  ];
  const pages = paginateConditionGroups(groupPricingRows(rows), 10);
  assert.deepEqual(pages.map(page => page.map(group => group.id)), [['a'], ['b'], ['c']]);
  assert.equal(pages[1][0].rows.length, 12);
});

test('grouping retains sorted output order within each condition', () => {
  const groups = groupPricingRows([
    { conditionId: 'a', conditionName: 'Footing', id: 'high' },
    { conditionId: 'b', conditionName: 'Slab', id: 'other' },
    { conditionId: 'a', conditionName: 'Footing', id: 'low' },
  ]);
  assert.deepEqual(groups.map(group => group.rows.map(row => row.id)), [['high', 'low'], ['other']]);
});
