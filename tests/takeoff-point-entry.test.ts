import test from 'node:test';
import assert from 'node:assert/strict';
import {pointFromPagePercent} from '../lib/takeoff/pointEntry.ts';

test('keyboard point entry preserves normalized page coordinates and boundary zeros',()=>{
  assert.deepEqual(pointFromPagePercent('20','57.142857'),{x:.2,y:.57142857});
  assert.deepEqual(pointFromPagePercent('0','100'),{x:0,y:1});
});
test('blank, nonfinite and out-of-page keyboard positions are rejected',()=>{
  for(const value of ['', ' ', 'NaN', 'Infinity','-1','100.01']){
    assert.throws(()=>pointFromPagePercent(value,'50'),/between 0 and 100/);
    assert.throws(()=>pointFromPagePercent('50',value),/between 0 and 100/);
  }
});
