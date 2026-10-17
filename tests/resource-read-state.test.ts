import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceReadState,resourceQuantity} from '../lib/field/resourceReadState.ts';
test('resource sources fail independently without erasing known sources',()=>{
 const reads=resourceReadState({inventory:new Error('synthetic unavailable'),calendar:true});
 assert.equal(reads.inventory,false);assert.equal(reads.calendar,false);assert.equal(reads.requirements,true);assert.equal(reads.operations,true);assert.equal(reads.vendors,true);
});
test('zero resource quantities remain distinct from missing and invalid coverage',()=>{
 assert.equal(resourceQuantity(0,'EA'),'0 EA');assert.equal(resourceQuantity(null),'Unavailable');assert.equal(resourceQuantity(undefined),'Unavailable');assert.equal(resourceQuantity('NaN'),'Unavailable');assert.equal(resourceQuantity(12.5,'CY'),'12.5 CY');
});
