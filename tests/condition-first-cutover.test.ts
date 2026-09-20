import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('app/takeoff/[setId]/page.tsx', 'utf8');
const shell = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx', 'utf8');
const integratedWorkspace = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
const workspace = readFileSync('components/takeoff/TakeoffDrawingWorkspace.tsx', 'utf8');
const canvas = readFileSync('components/takeoff/TakeoffDrawingCanvas.tsx', 'utf8');
const quantityDock = readFileSync('components/takeoff/TakeoffQuantityDock.tsx', 'utf8');
const builderContext = readFileSync('components/takeoff/AssemblyBuilderContext.tsx', 'utf8');

test('active Takeoff cuts over only after the governed Condition dependency gate passes', () => {
  assert.match(page, /const conditionAuthoringActive =/);
  assert.match(page, /CONDITION_ARCHETYPE_KEYS\.every/);
  assert.match(page, /\.eq\('status', 'published'\)/);
  assert.match(page, /\.eq\('engine_key', 'concrete_condition_v1'\)/);
  assert.match(page, /if \(!conditionAuthoringActive\)/);
  assert.match(page, /conditionAuthoringActive\s*\? <TakeoffConditionWorkflowShell/);
  assert.match(page, /: <TakeoffAssemblyBuilderShell/);
});

test('Condition-first shell mounts the integrated workstation without Scope Recipe authoring', () => {
  assert.match(shell, /IntegratedTakeoffConditionWorkspace/);
  assert.match(integratedWorkspace, /TakeoffDrawingWorkspace/);
  assert.match(workspace, /TakeoffDrawingCanvas/);
  assert.doesNotMatch(shell, /AssemblyBuilderProvider|AssemblyBuilderComposer|AssemblySystemPresetBar|TakeoffAssemblyBuilderShell/);
  assert.doesNotMatch(integratedWorkspace, /AssemblyBuilderProvider|AssemblyBuilderComposer|AssemblySystemPresetBar|TakeoffAssemblyBuilderShell/);
  assert.doesNotMatch(shell, /<ConcreteConditionAuthoring/);
});

test('legacy drawing wrapper composes the shared canvas while Condition mode keeps legacy authoring out of the active UI', () => {
  assert.match(workspace, /TakeoffDrawingCanvas/);
  assert.match(workspace, /carez:start-condition-takeoff/); // compatibility adapter only until direct specialist composition
  assert.match(canvas, /conditionAuthoringActive\?<div className=\{styles\.group\}>/);
  assert.match(canvas, /Legacy recipes and Build Methods stay out of the active workflow/);
  assert.match(canvas, /!conditionAuthoringActive&&<button[^>]+aria-selected=\{inspectorTab==='buildPlan'\}/);
  assert.match(canvas, /!conditionAuthoringActive&&inspectorTab==='buildPlan'/);
  assert.match(canvas, /conditionAuthoringActive\?<div className=\{styles\.statusWarn\}>/);
  assert.match(canvas, /:selectedVersionRecord&&selectedAssemblyRecord\?<TakeoffAssemblyInputEditor/);
  assert.match(canvas, /props\.roleMeasurementRequest/);
  assert.match(canvas, /if\(event\.key\.toLowerCase\(\)==='d'&&!conditionAuthoringActive/);
  assert.doesNotMatch(canvas, /carez:start-condition-takeoff|CustomEvent/);
});

test('Condition-first quantity worksheet does not expose the legacy Scope Recipe launcher', () => {
  assert.match(builderContext, /available:\s*value !== DEFAULT_ASSEMBLY_BUILDER_CONTEXT/);
  assert.match(quantityDock, /builder\.available && <button[^>]+builderButton[^>]+onClick=\{builder\.openLibrary\}/);
});
