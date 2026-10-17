import test from 'node:test';import assert from 'node:assert/strict';
import {billingRequest,executeBillingCommand} from '../lib/billing/commands.ts';
const request='b9500000-0000-4000-8000-000000000001';
test('billing retries keep their request and whitelist only command fields',()=>{
 const f=new FormData();f.set('financial_request_id',request);f.set('invoice_id','source');f.set('retainage_percent','5');f.set('company_id','forged');f.set('status','sent');
 const p=billingRequest(f,'void_invoice');assert.deepEqual(p,{p_request_id:request,p_command:'void_invoice',p_values:{invoice_id:'source'}});assert.deepEqual(billingRequest(f,'void_invoice'),p);
});
test('missing identities and file-valued billing fields fail before RPC',()=>{
 assert.throws(()=>billingRequest(new FormData(),'send_invoice'),/request/i);
 const f=new FormData();f.set('financial_request_id',request);f.set('notes',new Blob(['unsupported']));assert.throws(()=>billingRequest(f,'create_invoice'),/Unsupported billing/);
});
test('unconfirmed or failed billing writes never report success',async()=>{
 const f=new FormData();f.set('financial_request_id',request);f.set('invoice_id','source');
 for(const result of [{data:null,error:{message:'unavailable'}},{data:{ok:true},error:null},{data:{ok:false,id:'id'},error:null}])await assert.rejects(executeBillingCommand({rpc:async()=>result},f,'send_invoice'));
 const saved=await executeBillingCommand({rpc:async(name,payload)=>{assert.equal(name,'carez_billing_command_v1');assert.equal(payload.p_request_id,request);return{data:{ok:true,id:'confirmed'},error:null};}},f,'send_invoice');assert.equal(saved.id,'confirmed');
});
