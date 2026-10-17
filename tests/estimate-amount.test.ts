import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateAmount,estimateMoney} from '../lib/estimating/estimateAmount.ts';
test('unconfigured estimate amounts stay unavailable while recorded zero remains zero',()=>{
 for(const value of [null,undefined,'',NaN,'NaN','Infinity']){assert.equal(estimateAmount(value),null);assert.equal(estimateMoney(value),'Unavailable');}
 assert.equal(estimateMoney(0),'$0.00');assert.equal(estimateMoney('10.12'),'$10.12');assert.equal(estimateMoney(0,0),'$0');
});
