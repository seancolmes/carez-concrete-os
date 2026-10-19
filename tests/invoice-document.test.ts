import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceDocumentState} from '../lib/billing/invoiceDocument.ts';
const summary={data:{subtotal:0,sales_tax:0,retainage_held:0,invoice_total:0,amount_paid:0,balance_due:0,payment_basis_status:'known'},error:null};
const lines={data:[{quantity:0,unit_price:0,line_amount:0}],error:null,count:1};
test('recorded zero is printable; missing summary, payment basis and failed reads are not',()=>{
 assert.equal(invoiceDocumentState(summary,lines).canPrint,true);
 for(const read of [{data:null,error:null},{data:null,error:new Error('read')},{data:{...summary.data,balance_due:null},error:null},{data:{...summary.data,payment_basis_status:'review'},error:null}])assert.equal(invoiceDocumentState(read,lines).canPrint,false);
});
test('line failures, missing amounts and truncated results cannot print a complete invoice',()=>{
 for(const read of [{...lines,error:new Error('read')},{data:null,error:null,count:null},{...lines,count:2},{data:[{...lines.data[0],quantity:null}],error:null,count:1}])assert.equal(invoiceDocumentState(summary,read).canPrint,false);
 assert.equal(invoiceDocumentState(summary,{data:[],error:null,count:0}).canPrint,true);
});
