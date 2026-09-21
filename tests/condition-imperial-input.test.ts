import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { combineImperialLength, splitImperialLength } from '../lib/ui/imperialLength.ts';

test('feet-based Condition dimensions round-trip through feet + inches without changing canonical authority', () => {
  assert.deepEqual(splitImperialLength(2.5, 'FT'), { feet: 2, inches: 6 });
  assert.equal(combineImperialLength(2, 6, 'FT'), 2.5);
  assert.equal(combineImperialLength(2, 7.5, 'FT'), 2.625);
});

test('inch-based Condition dimensions use the same feet + inches editor and preserve inch canonical values', () => {
  assert.deepEqual(splitImperialLength(30, 'IN'), { feet: 2, inches: 6 });
  assert.equal(combineImperialLength(2, 6, 'IN'), 30);
  assert.equal(combineImperialLength(0, 4, 'IN'), 4);
});

test('Condition Properties applies architectural entry only to governed plan dimensions', () => {
  const workspace = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
  assert.match(workspace, /input\.group==='planFacts'/);
  assert.match(workspace, /input\.unit==='FT'\|\|input\.unit==='IN'/);
  assert.match(workspace, /<CarezFeetInchesField/);
  assert.match(workspace, /canonicalUnit=\{input\.unit\}/);
  assert.match(workspace, /Feet \+ inches/);
});
