import test from 'node:test';import assert from 'node:assert/strict';
import {bankSyncOutcome} from '../lib/banking/syncOutcome.ts';
test('accepted HTTP response alone never claims a completed refresh',()=>{
 for(const data of [{},{complete:false},{complete:false,busy:true}])assert.equal(bankSyncOutcome(data,true).complete,false);
 assert.match(bankSyncOutcome({connected:true,complete:false},true).message,/connection saved.*incomplete/i);
 assert.equal(bankSyncOutcome({complete:true},true).tone,'success');
 assert.equal(bankSyncOutcome({complete:true,matchedSourceChanges:1},true).tone,'warning');
 assert.equal(bankSyncOutcome({complete:true},false).complete,false);
});
