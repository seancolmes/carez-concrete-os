import assert from 'node:assert/strict';
import test from 'node:test';
import { formatArchitecturalLength, formatTakeoffMeasurement, formatTakeoffQuantityValue } from '../lib/takeoff/lengthFormat.ts';

test('worksheet quantity values keep LF in decimal form', () => {
  assert.equal(formatTakeoffQuantityValue(5.5, 'LF'), '5.5');
  assert.equal(formatTakeoffQuantityValue(2.5, 'lf'), '2.5');
  assert.equal(formatTakeoffQuantityValue(5.0105, 'LF'), '5.01');
});

test('operational takeoff measurements use decimal LF while the architectural helper remains available', () => {
  assert.equal(formatArchitecturalLength(5.5), `5'-6\"`);
  assert.equal(formatTakeoffMeasurement(5.5, 'LF'), '5.5 LF');
  assert.equal(formatTakeoffMeasurement(7 + 7.25 / 12, 'LF'), '7.6 LF');
  assert.equal(formatTakeoffMeasurement(28.5496, 'SF'), '28.55 SF');
});
