import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspace = readFileSync('components/takeoff/TakeoffDrawingWorkspace.tsx', 'utf8');

test('2D PDF zoom keeps the current bitmap visible until the replacement render is ready', () => {
  const start = workspace.indexOf('async function render(){');
  const end = workspace.indexOf('},[pdfReady,pageNumber,zoom,fitWidth]);', start);
  assert.ok(start >= 0 && end > start);
  const render = workspace.slice(start, end);

  assert.match(render, /document\.createElement\('canvas'\)/);
  assert.match(render, /canvas\.style\.width=/);
  assert.match(render, /const task=page\.render\(\{canvasContext:stagingContext,viewport:renderViewport\}\)/);

  const awaitIndex = render.indexOf('await task.promise');
  const visibleResizeIndex = render.indexOf('visible.width=');
  assert.ok(awaitIndex >= 0, 'replacement PDF render must finish');
  assert.ok(visibleResizeIndex > awaitIndex, 'visible canvas backing buffer must not be cleared before replacement render finishes');
  assert.match(render, /context\.drawImage\(staging,0,0\)/);
});
