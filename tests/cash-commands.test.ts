import test from 'node:test';
import assert from 'node:assert/strict';
import {cashRequest,executeCashCommand} from '../lib/financials/cashCommands.ts';
const request='ca500000-0000-4000-8000-000000000001';
test('cash requests preserve signed and zero inputs, explicit dates and correction identity',()=>{
 const f=new FormData();f.set('financial_request_id',request);f.set('balance','-25.01');f.set('balance_date','2026-10-16');f.set('expected_revision','0');f.set('company_id','untrusted');
 const value=cashRequest(f,'record_balance');assert.equal(value.p_request_id,request);assert.equal(value.p_values.balance,'-25.01');assert.equal(value.p_values.expected_revision,'0');assert.equal(value.p_values.company_id,undefined);assert.equal(value.p_values.balance_date,'2026-10-16');
});
test('cash transport fails on unconfirmed results and preserves request on retry',async()=>{
 const f=new FormData();f.set('financial_request_id',request);f.set('amount','0');const calls:unknown[]=[];
 const client={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return{data:null,error:null};}};
 await assert.rejects(executeCashCommand(client,f,'add_reserve'),/not confirmed/);await assert.rejects(executeCashCommand(client,f,'add_reserve'),/not confirmed/);
 assert.deepEqual(calls[0],calls[1]);assert.equal(cashRequest(f,'add_reserve').p_values.amount,'0');
 f.delete('financial_request_id');assert.throws(()=>cashRequest(f,'add_reserve'),/identity is missing/);
});
