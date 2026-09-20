import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {resolveProjectRoute} from '../lib/ui/navigation.ts';

const read=(path:string)=>
  readFileSync(new URL('../'+path,import.meta.url),'utf8');



test('Condition Properties is the only active property authority',()=>{
  const properties=read('components/takeoff/ConditionProperties.tsx');
  for(const label of ['Scope','Concrete','Forms','Rebar','Labor','Review','Save &amp; Recalculate']){
    assert.match(properties,new RegExp(label));
  }
  assert.match(properties,/ConditionModuleEditor/);
  assert.match(properties,/ConditionRolePicker/);
  assert.doesNotMatch(properties,/createPortal|querySelector|CustomEvent/);
});

test('dirty Condition selection requires an explicit decision',()=>{
  const editor=read('components/takeoff/useConditionEditor.ts');
  assert.match(editor,/pendingSwitch/);
  assert.match(editor,/executeDirtySwitchAction/);
  assert.match(editor,/requestConditionSelection/);
  assert.doesNotMatch(editor,/CustomEvent|querySelector|createPortal/);
});

test('Takeoff remains outside authoritative Project Context',()=>{
  assert.equal(resolveProjectRoute('/takeoff/set-1'),null);
});

test('Takeoff identity stays Estimate-authoritative with optional Project lineage',()=>{
  const page=read('app/takeoff/[setId]/page.tsx');
  assert.match(page,/project_id/);
  assert.match(page,/TakeoffWorkspaceIdentity/);
  assert.doesNotMatch(page,/CarezProjectContextBar/);
});

test('Project Overview links only an exact originating Takeoff',()=>{
  const page=read('app/projects/[id]/page.tsx');
  assert.match(page,/source_estimate_id/);
  assert.match(page,/Original Takeoff/);
  assert.match(page,/takeoff_sets/);
  assert.match(page,/sourceTakeoffs\.length===1/);
});

test('active Takeoff exposes 2D and 3D only',()=>{
  const workstation=read(
    'components/takeoff/IntegratedTakeoffConditionWorkspace.tsx',
  );

  assert.doesNotMatch(workstation,/['"]split['"]/);
});

test('navigator owns Plans Conditions Zones directly',()=>{
  const nav=read('components/takeoff/TakeoffContextNavigator.tsx');
  assert.match(nav,/Plans/);
  assert.match(nav,/Conditions/);
  assert.match(nav,/Zones/);
  assert.match(nav,/onSelectSheet/);
  assert.match(nav,/onSelectCondition/);
  assert.match(nav,/onToggleVisibility/);
  assert.doesNotMatch(nav,/querySelector|createPortal|CustomEvent/);
});

test('navigator pins keyboard ownership and row navigation',()=>{
  const nav=read('components/takeoff/TakeoffContextNavigator.tsx');
  assert.match(nav,/ArrowDown/);
  assert.match(nav,/ArrowUp/);
  assert.match(nav,/ArrowLeft/);
  assert.match(nav,/ArrowRight/);
  assert.match(nav,/event\.key==='Enter'/);
  assert.match(nav,/event\.stopPropagation\(\)/);
  assert.match(nav,/groupHeaderRef\.current\?\.focus\(\)/);
  assert.match(nav,/onKeyDown=\{onGroupHeaderKeyDown\}/);
});

test('navigator passes New Condition values through its explicit async callback',()=>{
  const nav=read('components/takeoff/TakeoffContextNavigator.tsx');
  assert.match(nav,/onCreateCondition:\(input:\{archetypeKey:ConditionArchetypeKey;code:string;name:string\}\)=>void\|Promise<void>/);
  assert.match(nav,/await props\.onCreateCondition\(\{archetypeKey:family,code:code\.trim\(\),name:name\.trim\(\)\}\)/);
  assert.match(nav,/try\{[\s\S]*setCreateOpen\(false\);[\s\S]*\}finally\{[\s\S]*setPending\(false\)/);
});


test('Condition-first drawing uses a direct canvas API instead of browser events',()=>{
  const canvas=read('components/takeoff/TakeoffDrawingCanvas.tsx');
  assert.match(canvas,/roleMeasurementRequest/);
  assert.match(canvas,/onMeasurementCommitted/);
  assert.match(canvas,/onActiveSheetChange/);
  assert.match(canvas,/onSelectedMeasurementChange/);
  assert.match(canvas,/onRoleMeasurementRequestConsumed/);
  assert.doesNotMatch(canvas,/carez:start-condition-takeoff|CustomEvent/);
});


test('specialist worksheet exposes exactly six governed views and mature dock mechanics',()=>{
  const worksheet=read('components/takeoff/TakeoffWorksheet.tsx');
  const projector=read('lib/takeoff/specialistWorksheet.ts');
  assert.match(projector,/WORKSHEET_VIEWS=\['quantities','resources','labor','pricing','holds','recap'\] as const/);
  assert.match(worksheet,/This Sheet/);
  assert.match(worksheet,/All Sheets/);
  assert.match(worksheet,/Resize Quantity \/ Estimate Worksheet/);
  assert.match(worksheet,/columnResizeHandle/);
  assert.match(worksheet,/onDoubleClick/);
  assert.match(worksheet,/localStorage/);
  assert.match(worksheet,/visibleRows/);
  assert.match(worksheet,/selectedMeasurementId/);
  assert.match(worksheet,/selectedConditionVersionId/);
  assert.doesNotMatch(worksheet,/customer.?price|margin|markup|overhead|reserve|sell.?price/i);
});
