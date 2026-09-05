import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('app/takeoff/[setId]/page.tsx', 'utf8');
const shell = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx', 'utf8');
const workspace = readFileSync('components/takeoff/TakeoffDrawingWorkspace.tsx', 'utf8');

test('active Takeoff cuts over only after the governed Condition dependency gate passes', () => {
  assert.match(page, /const conditionAuthoringActive =/);
  assert.match(page, /CONDITION_ARCHETYPE_KEYS\.every/);
  assert.match(page, /\.eq\('status', 'published'\)/);
  assert.match(page, /\.eq\('engine_key', 'concrete_condition_v1'\)/);
  assert.match(page, /if \(!conditionAuthoringActive\)/);
  assert.match(page, /conditionAuthoringActive\s*\? <TakeoffConditionWorkflowShell/);
  assert.match(page, /: <TakeoffAssemblyBuilderShell/);
});

test('Condition-first shell does not mount Scope Recipe authoring', () => {
  assert.match(shell, /TakeoffDrawingWorkspace/);
  assert.match(shell, /ConcreteConditionAuthoring/);
  assert.doesNotMatch(shell, /AssemblyBuilderProvider|AssemblyBuilderComposer|AssemblySystemPresetBar|TakeoffAssemblyBuilderShell/);
});

test('Condition-first workspace removes legacy assembly and Build Plan authoring from the active UI', () => {
  assert.match(workspace, /conditionAuthoringActive\?<div className=\{styles\.group\}>/);
  assert.match(workspace, /Legacy recipes and Build Methods stay out of the active workflow/);
  assert.match(workspace, /!conditionAuthoringActive&&<button[^>]+aria-selected=\{inspectorTab==='buildPlan'\}/);
  assert.match(workspace, /!conditionAuthoringActive&&inspectorTab==='buildPlan'/);
  assert.match(workspace, /conditionAuthoringActive\?<div className=\{styles\.statusWarn\}>/);
  assert.match(workspace, /:selectedVersionRecord&&selectedAssemblyRecord\?<TakeoffAssemblyInputEditor/);
  assert.match(workspace, /if\(conditionAuthoringActive\)\{openConditions\(\);return;\}/);
  assert.match(workspace, /if\(event\.key\.toLowerCase\(\)==='d'&&!conditionAuthoringActive/);
});
