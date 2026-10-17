import assert from 'node:assert/strict';
import test from 'node:test';
import {dashboardProjectAttention,dashboardProjectReadiness,showDashboardPlanningPrompt} from '../lib/dashboard/projectReadiness.ts';

const projectId='qa-job-001';
const clearedSetup={award_setup_applies:true,job_ready:true,readiness_reason:'Job setup is complete.'};
const heldSetup={award_setup_applies:true,job_ready:false,readiness_reason:'Accepted agreement record is missing.'};
const work=(ready:number,blocked:number)=>({ready_operation_count:ready,blocked_operation_count:blocked});
const actions=(readiness:ReturnType<typeof dashboardProjectReadiness>,scheduledHold=false)=>dashboardProjectAttention(projectId,'active',null,readiness,scheduledHold);

test('a setup hold retains its authoritative reason and job-specific destination',()=>{
  const readiness=dashboardProjectReadiness(projectId,heldSetup,work(0,0));
  assert.equal(readiness.readinessLabel,'Job setup hold');
  assert.deepEqual(actions(readiness).map(item=>({kind:item.kind,issue:item.issue,href:item.href})),[
    {kind:'job_setup',issue:'Accepted agreement record is missing.',href:'/job-setup/qa-job-001'},
  ]);
  assert.equal(showDashboardPlanningPrompt('active',readiness,false),false);
});

test('scheduled work and a linked operation hold do not hide the governing setup hold',()=>{
  const readiness=dashboardProjectReadiness(projectId,heldSetup,work(1,1));
  assert.equal(readiness.readyCount,1);
  assert.equal(readiness.blockedCount,1);
  assert.deepEqual(actions(readiness,true).map(item=>item.kind),['job_setup']);
  assert.equal(showDashboardPlanningPrompt('active',readiness,true),false);
});

test('mixed readiness keeps ready and blocked counts and surfaces blocked work',()=>{
  const readiness=dashboardProjectReadiness(projectId,clearedSetup,work(2,1));
  assert.equal(readiness.hardHold,false);
  assert.equal(readiness.readinessLabel,'Blocked work');
  assert.equal(readiness.readyCount,2);
  assert.equal(readiness.blockedCount,1);
  assert.deepEqual(actions(readiness).map(item=>item.kind),['blocked_work']);
  assert.match(actions(readiness)[0].issue,/2 are ready/);
  assert.equal(showDashboardPlanningPrompt('active',readiness,false),false);
});

test('fully ready work has no hold attention',()=>{
  const readiness=dashboardProjectReadiness(projectId,clearedSetup,work(2,0));
  assert.equal(readiness.readinessLabel,'Ready');
  assert.deepEqual(actions(readiness),[]);
});

test('a successful empty work summary is known zero, not unavailable',()=>{
  const readiness=dashboardProjectReadiness(projectId,clearedSetup,work(0,0));
  assert.equal(readiness.incomplete,false);
  assert.equal(readiness.readinessLabel,'No open physical work');
  assert.equal(readiness.readyCount,0);
  assert.equal(readiness.blockedCount,0);
  assert.deepEqual(actions(readiness),[]);
});

test('independent failed or missing reads stay incomplete without erasing known holds',()=>{
  const missingSetup=dashboardProjectReadiness(projectId,null,work(0,1));
  assert.equal(missingSetup.incomplete,true);
  assert.deepEqual(actions(missingSetup).map(item=>item.kind),['blocked_work']);

  const missingWork=dashboardProjectReadiness(projectId,heldSetup,null);
  assert.equal(missingWork.incomplete,true);
  assert.equal(missingWork.readyCount,null);
  assert.deepEqual(actions(missingWork).map(item=>item.kind),['job_setup']);

  const missingBoth=dashboardProjectReadiness(projectId,null,null);
  assert.equal(missingBoth.readinessLabel,'Unavailable');
  assert.deepEqual(actions(missingBoth),[]);
  assert.deepEqual(dashboardProjectAttention(projectId,'on_hold','Call superintendent',missingBoth,false).map(item=>item.kind),['project_hold']);
  assert.equal(showDashboardPlanningPrompt('active',missingBoth,false),false);
});
