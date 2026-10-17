import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectionIsCleared,startReadinessPresentation,scheduledWorkReadiness} from '../lib/field/startReadinessPresentation.ts';

test('presentation keeps complete resource holds even when the base gate is ready',()=>{
  const row=startReadinessPresentation({ready_to_start:true,ready_to_start_all:false,start_readiness_status:'resource_hold',start_next_action:'Reserve the pump',all_blocking_reasons:['Reserve the pump']});
  assert.equal(row.ready_to_start,false);assert.equal(row.readiness_status,'resource_hold');assert.equal(row.next_action,'Reserve the pump');assert.deepEqual(row.blocking_reasons,['Reserve the pump']);
  assert.equal(startReadinessPresentation({ready_to_start_all:true,start_readiness_status:'ready',start_next_action:'Start work'}).ready_to_start,true);
  assert.equal(startReadinessPresentation({ready_to_start:true}).ready_to_start,null,'missing full gate is unavailable');
});

test('canceling a required inspection never counts as clearance',()=>{
  for(const status of ['required','scheduled','failed','cancelled',null,undefined])assert.equal(inspectionIsCleared(status),false);
  assert.equal(inspectionIsCleared('passed'),true);assert.equal(inspectionIsCleared('waived'),true);
});

test('employee work distinguishes unlinked tasks, ready, held, and unavailable operation readiness',()=>{
  assert.equal(scheduledWorkReadiness({}).blocked,false);
  const linked={work_package_operation_id:'operation'};
  assert.equal(scheduledWorkReadiness({...linked,ready_to_start:true}).label,'Ready');
  assert.equal(scheduledWorkReadiness({...linked,ready_to_start:false,readiness_action:'Required inspection cancelled'}).reason,'Required inspection cancelled');
  assert.equal(scheduledWorkReadiness(linked).blocked,true);
  assert.equal(scheduledWorkReadiness(linked).label,'Readiness unavailable');
});
