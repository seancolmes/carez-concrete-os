import assert from 'node:assert/strict';
import test from 'node:test';
import {requireTakeoffRead} from '../lib/takeoff/requiredReads.ts';
test('successful empty lists and optional missing issued records remain valid',()=>{
  assert.deepEqual(requireTakeoffRead('measurements',[],null),[]);
  assert.equal(requireTakeoffRead('issued revision',null,null,false),null);
});
test('failed required and optional authority reads never become empty or unlocked',()=>{
  for(const required of [true,false])assert.throws(()=>requireTakeoffRead('revisions',null,{code:'READ_FAILED'},required),/unavailable/);
  assert.throws(()=>requireTakeoffRead('condition outputs',null,null),/unavailable/);
});
