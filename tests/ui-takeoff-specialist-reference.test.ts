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
