import test from 'node:test';
import assert from 'node:assert/strict';
import {workCoverage} from '../lib/field/workCoverage.ts';
test('missing coverage is unavailable and requires review without claiming a legacy shift',()=>{
 for(const value of [null,undefined,'',NaN,Infinity,-1,101]){
  const result=workCoverage(value);assert.equal(result.percentage,null);assert.equal(result.label,'Unavailable');assert.equal(result.needsReview,true);assert.doesNotMatch(result.detail,/legacy|predates|complete/i);
 }
});
test('recorded zero and existing 90 percent review threshold are preserved',()=>{
 assert.equal(workCoverage(0).label,'0%');assert.equal(workCoverage(0).needsReview,true);
 assert.equal(workCoverage('89.9').needsReview,true);assert.equal(workCoverage(90).needsReview,false);assert.equal(workCoverage(100).label,'100%');
});
