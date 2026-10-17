import assert from 'node:assert/strict';
import test from 'node:test';
import {dashboardOperationBadge,dashboardOperationMessage,dashboardOperationReadModel} from '../lib/dashboard/operationReadiness.ts';
import {dashboardProjectAttention,dashboardProjectReadiness} from '../lib/dashboard/projectReadiness.ts';

const ok=<T>(data:T[])=>({data,error:null});
const failed={data:null,error:new Error('read failed')};
const operation=(ready_to_start_all:boolean|null)=>({operation_id:'operation-1',ready_to_start_all,start_next_action:'Inspection remains open.',inspection_clear_count:1,inspection_count:2});
const linked=[{work_package_operation_id:'operation-1'}];

test('explicit operation results alone produce Ready or Hold',()=>{
  const ready=dashboardOperationReadModel(ok([]),ok(linked),ok([operation(true)]));
  assert.equal(ready.attentionIncomplete,false);
  assert.deepEqual(ready.forOperation('operation-1'),{status:'ready',inspectionClear:1,inspectionCount:2,nextAction:'Inspection remains open.'});
  assert.equal(dashboardOperationBadge(ready.forOperation('operation-1')),'Ready');

  const held=dashboardOperationReadModel(ok([]),ok(linked),ok([operation(false)]));
  assert.equal(held.attentionIncomplete,false);
  assert.equal(held.forOperation('operation-1').status,'hold');
  assert.equal(dashboardOperationBadge(held.forOperation('operation-1')),'Hold');
});

test('successful empty reads distinguish no link from a missing linked row',()=>{
  const empty=dashboardOperationReadModel(ok([]),ok([{work_package_operation_id:null}]),ok([]));
  assert.equal(empty.attentionIncomplete,false);
  assert.equal(empty.forOperation(null).status,'unlinked');
  assert.equal(dashboardOperationBadge(empty.forOperation(null)),'Not linked');
  assert.equal(dashboardOperationMessage(empty.forOperation(null)),'No operation linked to this pour.');

  const missing=dashboardOperationReadModel(ok([]),ok(linked),ok([]));
  assert.equal(missing.attentionIncomplete,true);
  assert.equal(missing.forOperation('operation-1').status,'missing');
  assert.equal(dashboardOperationBadge(missing.forOperation('operation-1')),'Unavailable');
  assert.equal(dashboardOperationMessage(missing.forOperation('operation-1')),'Linked operation readiness record is missing.');

  const unknown=dashboardOperationReadModel(ok([]),ok(linked),ok([operation(null)]));
  assert.equal(unknown.attentionIncomplete,true);
  assert.equal(unknown.forOperation('operation-1').status,'unavailable');
  assert.equal(dashboardOperationBadge(unknown.forOperation('operation-1')),'Unavailable');
  assert.equal(dashboardOperationMessage(unknown.forOperation('operation-1')),'Readiness unavailable.');
});

test('shift, schedule, and operation failures independently mark attention incomplete',()=>{
  assert.equal(dashboardOperationReadModel(failed,ok(linked),ok([operation(false)])).attentionIncomplete,true);
  assert.equal(dashboardOperationReadModel(ok([]),failed,ok([operation(false)])).attentionIncomplete,true);
  const failedOperations=dashboardOperationReadModel(ok([]),ok(linked),failed);
  assert.equal(failedOperations.attentionIncomplete,true);
  assert.equal(failedOperations.forOperation('operation-1').status,'unavailable');
  assert.equal(dashboardOperationMessage(failedOperations.forOperation('operation-1')),'Readiness unavailable.');
  assert.equal(failedOperations.forOperation(null).status,'unlinked');
});

test('known project holds survive an independent operation-readiness failure',()=>{
  const failedOperations=dashboardOperationReadModel(ok([]),ok(linked),failed);
  const project=dashboardProjectReadiness('job-1',{award_setup_applies:true,job_ready:false,readiness_reason:'Accepted agreement record is missing.'},{ready_operation_count:0,blocked_operation_count:0});
  assert.equal(failedOperations.attentionIncomplete,true);
  assert.deepEqual(dashboardProjectAttention('job-1','active',null,project,false).map(item=>item.issue),['Accepted agreement record is missing.']);
});
