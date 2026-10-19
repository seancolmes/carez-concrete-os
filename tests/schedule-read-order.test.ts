import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScheduleReadSets} from '../lib/field/scheduleReads.ts';
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return {promise,resolve};};

test('independent reads start before the calendar resolves; item query waits only for its date',async()=>{
 const date=deferred<string>(),related=deferred<string>(),events:string[]=[];
 const pending=loadScheduleReadSets(()=>{events.push('calendar');return date.promise;},async value=>{events.push('items:'+value);return {data:[],error:null};},()=>{events.push('related');return related.promise;});
 await Promise.resolve();assert.deepEqual(events,['calendar','related']);
 date.resolve('2026-10-19');await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.ok(events.includes('items:2026-10-19'),'item read must not wait for unrelated choice lists');
 related.resolve('known-related');const result=await pending;assert.deepEqual(result,['2026-10-19',{data:[],error:null},'known-related']);
});
test('calendar read errors remain data for the existing fallback and read rejections are not hidden',async()=>{
 const calendar={data:null,error:{message:'calendar unavailable'}};
 const result=await loadScheduleReadSets(async()=>calendar,async value=>({unbounded:value===calendar}),async()=>({data:[],error:{message:'related unavailable'}}));
 assert.equal(result[0],calendar);assert.equal(result[1].unbounded,true);assert.equal(result[2].error?.message,'related unavailable');
 const failure=new Error('network failure');await assert.rejects(loadScheduleReadSets(async()=>{throw failure;},async()=>[],async()=>[]),error=>error===failure);
});
