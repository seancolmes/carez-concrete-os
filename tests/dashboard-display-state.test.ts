import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardPlanningAction,dashboardDetailState,metricIsZero} from '../lib/dashboard/displayState.ts';
const prompt='Review external agreement evidence and Job Setup before physical work.';
test('only the exact stale intake reminder is replaced after explicit server clearance',()=>{
 assert.equal(dashboardPlanningAction(prompt,true),'Schedule the next work.');
 for(const ready of [false,null,undefined])assert.equal(dashboardPlanningAction(prompt,ready),prompt);
 assert.equal(dashboardPlanningAction('Call the superintendent about access.',true),'Call the superintendent about access.');
});
test('zero activity collapses without confusing unavailable or missing data with zero',()=>{
 for(const value of ['$0','0','0 CY','0 hrs','0.0 hr'])assert.equal(metricIsZero(value),true);
 for(const value of ['—','$1','1 CY','Not recorded'])assert.equal(metricIsZero(value),false);
 const base={fieldValues:['0 CY','0 hrs'],financialValues:[{label:'A/R outstanding',value:'$0'},{label:'Contract backlog',value:'$44,408'}],pipelineCount:0,pipelineUnavailable:false,pourCount:0,pourUnavailable:false};
 assert.deepEqual(dashboardDetailState(base),{hasActivity:false,incomplete:false});
 assert.deepEqual(dashboardDetailState({...base,financialValues:[...base.financialValues,{label:'Earned / unbilled',value:'—'}]}),{hasActivity:false,incomplete:true});
 assert.deepEqual(dashboardDetailState({...base,fieldValues:['—']}),{hasActivity:false,incomplete:true});
 assert.equal(dashboardDetailState({...base,pipelineCount:1}).hasActivity,true);
 assert.equal(dashboardDetailState({...base,pourUnavailable:true}).incomplete,true);
});
