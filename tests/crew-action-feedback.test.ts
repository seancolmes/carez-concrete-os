import assert from 'node:assert/strict';
import test from 'node:test';
import {crewActionFeedback} from '../lib/crew/actionFeedback.ts';

test('calendar prerequisite is actionable and does not escape the form action',async()=>{
 const message='Configure the company operating calendar before changing Crew terms.';
 const result=await crewActionFeedback('create',async()=>{throw new Error(message);});
 assert.deepEqual(result,{status:'error',message,settingsHref:'/settings?tab=company'});
});

test('independent validation and save failures never become successful saves',async()=>{
 for(const message of ['Enter the applicable recorded rate.','Crew administration unavailable: rate history could not be loaded.','No worker change was confirmed.']){
  const result=await crewActionFeedback('update',async()=>{throw new Error(message);});
  assert.equal(result.status,'error');assert.equal(result.message,message);assert.equal(result.settingsHref,undefined);
 }
 const unknown=await crewActionFeedback('rate',async()=>{throw {unavailable:true};});
 assert.equal(unknown.status,'error');assert.match(unknown.message,/Review Crew before retrying/);
});

test('only a completed original mutation produces saved feedback, exactly once',async()=>{
 for(const operation of ['create','update','rate'] as const){let saves=0;const result=await crewActionFeedback(operation,async()=>{saves++;});assert.equal(saves,1);assert.equal(result.status,'saved');assert.equal(result.settingsHref,undefined);}
});
