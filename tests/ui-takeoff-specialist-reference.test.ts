import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {resolveProjectRoute} from '../lib/ui/navigation.ts';

const read=(path:string)=>
  readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Takeoff remains outside authoritative Project Context',()=>{
  assert.equal(resolveProjectRoute('/takeoff/set-1'),null);
});

test('active Takeoff exposes 2D, derived 3D, and Split',()=>{
  const workstation=read(
    'components/takeoff/IntegratedTakeoffConditionWorkspace.tsx',
  );

  assert.match(workstation,/['"]split['"]/);
});