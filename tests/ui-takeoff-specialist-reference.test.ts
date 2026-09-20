import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {resolveProjectRoute} from '../lib/ui/navigation.ts';

const read=(path:string)=>
  readFileSync(new URL('../'+path,import.meta.url),'utf8');

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
});
