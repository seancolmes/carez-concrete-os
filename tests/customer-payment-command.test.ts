import test from 'node:test';
import assert from 'node:assert/strict';
import {executeInvoicePayment,invoicePaymentRequest} from '../lib/billing/paymentCommand.ts';
function form(){const fd=new FormData();for(const [key,value] of Object.entries({financial_request_id:'a1900000-0000-4000-8000-000000000001',invoice_id:'a1800000-0000-4000-8000-000000000001',amount:'40',processing_fee:'0',received_date:'2026-10-16',payment_method:'check',status:'void',company_id:'foreign'}))fd.set(key,value);return fd;}
test('customer payment sends recorded values and a stable request without caller-controlled state or company',()=>{
 const fd=form(),request=invoicePaymentRequest(fd);assert.equal(request.p_values.processing_fee,'0');assert.equal(request.p_values.status,undefined);assert.equal(request.p_values.company_id,undefined);assert.equal(invoicePaymentRequest(fd).p_request_id,request.p_request_id);
 fd.delete('financial_request_id');assert.throws(()=>invoicePaymentRequest(fd),/identity/);
});
test('customer payment requires both payment and allocation confirmation',async()=>{
 const calls:any[]=[];const client={rpc:async(name:string,args:any)=>{calls.push([name,args]);return{data:{ok:true,id:'payment',allocation_id:'allocation'},error:null};}};
 await executeInvoicePayment(client,form());assert.equal(calls[0][0],'carez_record_invoice_payment_v2');
 for(const result of [{data:null,error:{message:'denied'}},{data:{ok:true,id:'orphan'},error:null}])await assert.rejects(executeInvoicePayment({rpc:async()=>result},form()));
});
