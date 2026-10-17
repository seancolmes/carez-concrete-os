import assert from 'node:assert/strict';
import test from 'node:test';
import {scheduleCommand,scheduleReadiness} from '../lib/field/scheduleCommand.ts';
const request='e1900000-0000-4000-8000-000000000001',project='e1300000-0000-4000-8000-000000000001',worker='e1400000-0000-4000-8000-000000000001';
function form(){const value=new FormData();for(const [key,text] of Object.entries({request_id:request,project_id:project,schedule_date:'2026-10-16',item_type:'work',title:'Overnight work',crew_needed:'0',start_time:'23:30',end_time:'01:30'}))value.set(key,text);return value;}
test('schedule planning keeps explicit zero and overnight times, deduplicates crew and excludes forged authority',()=>{
 const input=form();input.append('crew_member_ids',worker);input.append('crew_member_ids',worker);input.set('company_id','foreign');input.set('mix_design','4000 PSI');
 const {payload}=scheduleCommand(input,'create');assert.equal(payload.crew_needed,0);assert.equal(payload.schedule_date,'2026-10-16');assert.equal(payload.end_time,'01:30');assert.deepEqual(payload.crew_member_ids,[worker]);assert.equal(payload.notes,'Mix design: 4000 PSI');assert.equal('company_id' in payload,false);
 input.set('status','confirmed');assert.throws(()=>scheduleCommand(input,'create'),/planned work/);
});
test('invalid dates, crew, quantities, times and stale identities are rejected before RPC',()=>{
 for(const [key,text] of [['schedule_date','2026-02-30'],['schedule_date','infinity'],['crew_needed',''],['crew_needed','NaN'],['crew_needed','1.5'],['start_time','24:00'],['request_id','']]){const input=form();input.set(key,text);assert.throws(()=>scheduleCommand(input,'create'));}
 const input=form();input.set('id',project);assert.throws(()=>scheduleCommand(input,'delete'),/Reload/);input.set('expected_revision','0');assert.equal(scheduleCommand(input,'delete').payload.expected_revision,0);
});
test('job and operation readiness must explicitly clear, while known independent holds survive failed reads',()=>{
 const base={physical:true,linkedOperation:true,job:{job_ready:true},operation:{ready_to_start_all:true},jobReadFailed:false,operationReadFailed:false};
 assert.equal(scheduleReadiness(base).ready,true);
 for(const change of [{job:null},{operation:null},{jobReadFailed:true},{operationReadFailed:true},{job:{}},{operation:{}}]){const result=scheduleReadiness({...base,...change});assert.equal(result.ready,null);assert.equal(result.unavailable,true);assert.match(result.reason!,/unavailable/);}
 const held=scheduleReadiness({...base,job:{job_ready:false,readiness_reason:'Agreement missing'},operationReadFailed:true});assert.equal(held.blocked,true);assert.equal(held.reason,'Agreement missing');assert.equal(held.unavailable,true);
 const opHold=scheduleReadiness({...base,jobReadFailed:true,operation:{ready_to_start_all:false,start_next_action:'Inspection'}});assert.equal(opHold.blocked,true);assert.equal(opHold.reason,'Inspection');
 assert.equal(scheduleReadiness({...base,physical:false}).ready,null);
 const unlinked=scheduleReadiness({...base,linkedOperation:false,operation:null});assert.equal(unlinked.ready,null);assert.equal(unlinked.unavailable,false);assert.match(unlinked.reason!,/No linked operation/);
});
