import assert from 'node:assert/strict';
import test from 'node:test';
import {footingPlacementRecommendation} from '../lib/takeoff/conditions/nationalEstimatorRecommendations.ts';

test('footing placing recommendations match National Estimator p. 351 and reject unmapped methods', () => {
  assert.equal(footingPlacementRecommendation('direct_chute')?.factor, 0.564);
  assert.equal(footingPlacementRecommendation('line_pump')?.factor, 0.125);
  assert.equal(footingPlacementRecommendation('buggy')?.factor, 0.701);
  assert.equal(footingPlacementRecommendation('boom_pump'), null);
  assert.equal(footingPlacementRecommendation('wheelbarrow'), null);
});
