import assert from 'node:assert/strict';
import test from 'node:test';
import { computePlanTextureSize, renderPdfPageCanvas } from '../lib/takeoff/3d/planTexture.ts';

test('plan texture targets twice displayed resolution at exact source proportions', () => {
  const size = computePlanTextureSize(1000, 800, 1200, 800);
  assert.ok(Math.max(size.width, size.height) <= 4096);
  assert.equal(Number((size.width / size.height).toFixed(6)), 1.25);
  assert.ok(size.width >= 2000);
});

test('large display caps texture to 4096 and portrait retains aspect', () => {
  const large = computePlanTextureSize(1000, 800, 6000, 4000);
  assert.equal(large.width, 4096);
  assert.ok(Math.abs(large.width / large.height - 1.25) < 0.001);
  const portrait = computePlanTextureSize(800, 1000, 800, 1200);
  assert.equal(portrait.width / portrait.height, 0.8);
});

test('invalid page dimensions are rejected before allocating a texture', () => {
  assert.throws(() => computePlanTextureSize(0, 800, 1200, 800), /dimensions/);
});

test('already aborted loads never import PDF.js or create browser resources', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(renderPdfPageCanvas('/unused.pdf', 1, { width: 100, height: 80, scale: 0.1 }, controller.signal), { name: 'AbortError' });
});
