import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const plan = readFileSync('components/takeoff/3d/Takeoff3DPlan.tsx', 'utf8');

test('PDF material remounts after texture arrives so Three compiles the map shader', () => {
  assert.match(plan, /texture\s*\?\s*\(/);
  assert.match(plan, /key=\{texture\.uuid\}/);
});
