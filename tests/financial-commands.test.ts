import test from 'node:test';
import assert from 'node:assert/strict';
import {executeFinancialCommand,financialRequestId,optionalFinancialNumber} from '../lib/financials/commands.ts';
const request='8b03276d-f4f8-4873-8e2f-349e8af8c274';
test('financial actions target only request-bearing governed commands',async()=>{
 const calls:unknown[]=[];const client={rpc:(name:string,args:Record<string,unknown>)=>{calls.push([name,args]);return Promise.resolve({data:{ok:true},error:null});}};
 await executeFinancialCommand(client,'record_vendor_bill_payment',{p_amount:0,p_request_id:'forged'},request);
 assert.deepEqual(calls,[['carez_record_vendor_bill_payment_v2',{p_amount:0,p_request_id:request}]]);
 assert.throws(()=>executeFinancialCommand(client,'arbitrary_sql',{},request));
 assert.throws(()=>executeFinancialCommand(client,'void_vendor_payment',{},'bad'));
});
test('missing financial request cannot silently generate a new form submission',()=>{
 const form=new FormData();assert.throws(()=>financialRequestId(form));
 form.set('financial_request_id',request);assert.equal(financialRequestId(form),request);
});
test('optional financial numbers preserve blank and zero, rejecting malformed inputs',()=>{
 assert.equal(optionalFinancialNumber(''),null);assert.equal(optionalFinancialNumber(null),null);
 assert.equal(optionalFinancialNumber('0'),0);assert.equal(optionalFinancialNumber('25.50'),25.5);
 for(const value of ['NaN','Infinity','-1','10%','1e3'])assert.throws(()=>optionalFinancialNumber(value));
 assert.throws(()=>optionalFinancialNumber('101',{max:100}));
});
