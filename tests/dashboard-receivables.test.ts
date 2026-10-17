import assert from 'node:assert/strict';
import test from 'node:test';
import {dashboardReceivables} from '../lib/dashboard/receivables.ts';

const ok=<T>(data:T[])=>({data,error:null});
const failed={data:null,error:new Error('read failed')};
test('deployed partial/credit classifications and unknown payment basis retain their meaning',()=>{
 assert.deepEqual(dashboardReceivables(ok([{outstanding_ar:90}]),ok([{collection_status:'overdue_partial',balance_due:40},{collection_status:'partially_paid',balance_due:50},{collection_status:'credit',balance_due:-10}])),{outstanding:90,overdue:40});
 assert.deepEqual(dashboardReceivables(ok([{outstanding_ar:null}]),ok([{collection_status:'unavailable',balance_due:null}])),{outstanding:null,overdue:null});
});

test('sums only server-classified overdue invoice balances',()=>{
  const result=dashboardReceivables(ok([{outstanding_ar:'75000'}]),ok([
    {collection_status:'overdue',balance_due:'12000'},
    {collection_status:'overdue',balance_due:3000},
    {collection_status:'open',balance_due:75000},
    {collection_status:'paid',balance_due:0},
    {collection_status:'draft',balance_due:9000},
    {collection_status:'void',balance_due:1000},
  ]));
  assert.deepEqual(result,{outstanding:75000,overdue:15000});
});

test('successful empty reads and recorded zero balances stay zero',()=>{
  assert.deepEqual(dashboardReceivables(ok([]),ok([])),{outstanding:0,overdue:0});
  assert.deepEqual(dashboardReceivables(ok([{outstanding_ar:0}]),ok([{collection_status:'overdue',balance_due:0}])),{outstanding:0,overdue:0});
});

test('an overdue invoice with a missing or invalid balance makes overdue unavailable',()=>{
  for(const balance_due of [null,undefined,'',Number.NaN]){
    assert.deepEqual(dashboardReceivables(ok([{outstanding_ar:75000}]),ok([{collection_status:'overdue',balance_due}])),{outstanding:75000,overdue:null});
  }
  assert.deepEqual(dashboardReceivables(ok([{outstanding_ar:75000}]),ok([{collection_status:null,balance_due:75000}])),{outstanding:75000,overdue:null});
});

test('invoice and outstanding read failures remain independent',()=>{
  assert.deepEqual(dashboardReceivables(ok([{outstanding_ar:75000}]),failed),{outstanding:75000,overdue:null});
  assert.deepEqual(dashboardReceivables(failed,ok([{collection_status:'overdue',balance_due:12000}])),{outstanding:null,overdue:12000});
  assert.deepEqual(dashboardReceivables(ok([{outstanding_ar:75000}]),{data:null,error:null}),{outstanding:75000,overdue:null});
});
