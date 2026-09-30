import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('app/takeoff/[setId]/page.tsx', 'utf8');
const shell = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx', 'utf8');
const integratedWorkspace = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
const workspace = readFileSync('components/takeoff/TakeoffDrawingWorkspace.tsx', 'utf8');
const quantityDock = readFileSync('components/takeoff/TakeoffQuantityDock.tsx', 'utf8');
const takeoffLanding = readFileSync('app/takeoff/page.tsx', 'utf8');
const navigation = readFileSync('lib/ui/navigation.ts', 'utf8');
test('normal Takeoff is permanently Condition-first after P0.5E parity', () => {
  assert.match(page, /<TakeoffConditionWorkflowShell/);
  assert.doesNotMatch(page, /TakeoffAssemblyBuilderShell|conditionAuthoringActive/);
  assert.doesNotMatch(workspace, /buildPlan|Legacy recipes and Build Methods stay out of the active workflow/);
  assert.doesNotMatch(quantityDock, /openLibrary|builderButton/);
});

test('Condition-first shell mounts the integrated workstation without Scope Recipe authoring', () => {
  assert.match(shell, /IntegratedTakeoffConditionWorkspace/);
  assert.match(integratedWorkspace, /TakeoffDrawingWorkspace/);
  assert.doesNotMatch(shell, /AssemblyBuilderProvider|AssemblyBuilderComposer|AssemblySystemPresetBar|TakeoffAssemblyBuilderShell/);
  assert.doesNotMatch(integratedWorkspace, /AssemblyBuilderProvider|AssemblyBuilderComposer|AssemblySystemPresetBar|TakeoffAssemblyBuilderShell/);
  assert.doesNotMatch(shell, /<ConcreteConditionAuthoring/);
});



test('legacy assembly mutation action modules are retired after dependency cutover', () => {
  assert.equal(existsSync('app/takeoff/[setId]/assemblyActions.ts'), false);
  assert.equal(existsSync('app/takeoff/[setId]/assemblySystemActions.ts'), false);
  assert.equal(existsSync('app/takeoff/[setId]/scopeVariantActions.ts'), false);
});


test('retired review and preview routes are absent from normal navigation', () => {
  for (const route of ['app/takeoff/assemblies/page.tsx', 'app/takeoff/intelligence/page.tsx', 'app/design-review/page.tsx', 'app/design-reviews/overlays/page.tsx']) {
    assert.equal(existsSync(route), false);
  }
  assert.doesNotMatch(takeoffLanding, /\/takeoff\/assemblies|Assembly history/);
  assert.doesNotMatch(navigation, /\/takeoff\/(?:assemblies|intelligence)/);
});
