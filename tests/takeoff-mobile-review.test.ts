import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('mobile Takeoff is a read-only 2D review surface', () => {
  const shell = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx', 'utf8');
  const integrated = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
  const drawing = readFileSync('components/takeoff/TakeoffDrawingWorkspace.tsx', 'utf8');

  assert.match(shell, /mobileReview=\{mobileReview\}/);
  assert.match(shell, /!mobileReview&&<Button/);
  assert.match(integrated, /data-view-mode=\{mobileReview\?'2d':viewMode\}/);
  assert.match(integrated, /!mobileReview&&viewMode!=='2d'/);
  assert.match(integrated, /!mobileReview&&<aside id="takeoff-condition-properties"/);
  assert.match(drawing, /mobileReview\?:boolean/);
  assert.match(drawing, /setTool\('pan'\)/);
  assert.match(drawing, /!mobileReview&&<TakeoffQuantityDock/);
  assert.match(drawing, /Review only/);
});

test('mobile Takeoff exposes only review navigation and zoom chrome', () => {
  const drawing = readFileSync('components/takeoff/TakeoffDrawingWorkspace.tsx', 'utf8');
  const drawingCss = readFileSync('components/takeoff/TakeoffDrawingWorkspace.module.css', 'utf8');
  const shellCss = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.module.css', 'utf8');

  assert.match(drawing, /className=\{styles\.mobilePageGroup\}/);
  assert.match(drawing, /title="Previous sheet"/);
  assert.match(drawing, /title="Next sheet"/);
  assert.match(drawing, /title="Pan plan"/);
  assert.match(drawing, /title="Fit page"/);
  assert.match(drawingCss, /\.workstation\[data-mobile-review="true"\]/);
  assert.match(shellCss, /\.propertiesCollapse,\.propertiesExpand\{display:none!important\}/);
});
