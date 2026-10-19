import test from 'node:test';
import assert from 'node:assert/strict';
import {closeoutReadModel} from '../lib/projects/closeoutReadModel.ts';
const checked=Object.fromEntries(['punch_complete','timecards_complete','purchase_orders_closed','vendor_bills_complete','change_orders_complete','customer_billed_complete','customer_paid_complete','documents_complete'].map(k=>[k,true]));
const base=()=>({checklist:{data:checked,error:null},billing:{data:{payment_basis_status:'known',outstanding_ar:0,unbilled_contract:0},error:null},orders:{data:[],error:null,count:0},bills:{data:[],error:null,count:0},changes:{data:[],error:null,count:0},shifts:{data:[],error:null,count:0}});
test('closeout guidance requires explicit confirmations and independent known zero balances',()=>{
 assert.equal(closeoutReadModel('p',base()).canComplete,true);
 const missing=base();missing.checklist.data={...checked,documents_complete:false};assert.equal(closeoutReadModel('p',missing).canComplete,false);
 const offset=base();offset.billing.data={payment_basis_status:'known',outstanding_ar:10,unbilled_contract:-10};const result=closeoutReadModel('p',offset);assert.equal(result.blockers,1);assert.equal(result.canComplete,false);
});
test('each failed required read or missing billing basis prevents an all clear without hiding known holds',()=>{
 for(const key of ['checklist','billing','orders','bills','changes','shifts'] as const){const reads=base();reads[key].error={message:'failed'} as any;assert.equal(closeoutReadModel('p',reads).unavailable,true,key);}
 const missing=base();missing.billing.data=null as any;assert.equal(closeoutReadModel('p',missing).billingStatus,'Billing summary missing');
 const held=base();held.shifts.data=[{project_id:'p',status:'active'}] as any;held.shifts.count=1;held.orders.error={} as any;const result=closeoutReadModel('p',held);assert.equal(result.openTime,1);assert.equal(result.unavailable,true);assert.equal(result.canComplete,false);
});
test('incomplete blocker coverage never confirms zero and retains independently observed holds',()=>{
 const truncated=base();truncated.shifts.count=1001;
 let result=closeoutReadModel('p',truncated);assert.equal(result.openTime,null);assert.equal(result.unavailable,true);assert.equal(result.canComplete,false);
 truncated.shifts.data=[{project_id:'p',status:'submitted'}] as any;
 result=closeoutReadModel('p',truncated);assert.equal(result.openTime,'At least 1');assert.equal(result.blockers,1);assert.equal(result.canComplete,false);
 const missingCoverage=base();delete (missingCoverage.orders as {count?:number}).count;
 assert.equal(closeoutReadModel('p',missingCoverage).openPO,null);
 assert.equal(closeoutReadModel('p',missingCoverage).canComplete,false);
});
