import test from 'node:test';
import assert from 'node:assert/strict';
import {timedFieldRead} from '../lib/field/readTiming.ts';

test('timing returns the original read result without converting errors or zeros',async()=>{
 const reports:{name:string;ms:number}[]=[];
 for(const result of [{data:[],error:null},{data:[{count:0}],error:null},{data:null,error:{message:'unavailable'}}]){
  assert.equal(await timedFieldRead('schedule.items',async()=>result,(name,ms)=>reports.push({name,ms})),result);
 }
 assert.equal(reports.length,3);assert.ok(reports.every(entry=>entry.name==='schedule.items'&&entry.ms>=0));
});
test('rejected reads remain rejected and record a timing once',async()=>{
 const error=new Error('read failed');let calls=0;
 await assert.rejects(timedFieldRead('auth',async()=>{throw error;},()=>{calls++;}),e=>e===error);
 assert.equal(calls,1);
});
