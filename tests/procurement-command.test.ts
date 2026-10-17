import assert from 'node:assert/strict';
import test from 'node:test';
import {executeProcurementCommand,procurementRequest} from '../lib/financials/procurementCommands.ts';
const request='d1900000-0000-4000-8000-000000000001';
function form(){const input=new FormData();input.set('financial_request_id',request);input.set('quantity','0');input.set('unit_cost','0');input.set('sales_tax','0');input.set('vendor_quote_id','d1100000-0000-4000-8000-000000000001');return input;}
test('procurement payload preserves explicit zero and missing values without accepting forged totals or company',()=>{
 const input=form();input.set('company_id','foreign');input.set('total_cost','123');input.set('status','posted');const values=procurementRequest(input,'add_quote_line');assert.equal(values.p_request_id,request);assert.equal(values.p_values.quantity,'0');assert.equal(values.p_values.description,null);assert.equal('company_id' in values.p_values,false);assert.equal('total_cost' in values.p_values,false);assert.equal('status' in values.p_values,false);
});
test('one rendered identity survives uncertain retries; missing identity is rejected',()=>{const input=form();assert.deepEqual(procurementRequest(input,'add_quote_line'),procurementRequest(input,'add_quote_line'));input.delete('financial_request_id');assert.throws(()=>procurementRequest(input,'add_quote_line'),/request identity/);});
test('only a confirmed record is treated as saved and read/RPC failures remain visible',async()=>{
 const calls:unknown[]=[];const client={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return{data:{ok:true,id:'recorded'},error:null};}};
 assert.equal((await executeProcurementCommand(client,form(),'add_quote_line')).id,'recorded');assert.equal((calls[0] as {name:string}).name,'carez_procurement_command_v1');
 await assert.rejects(()=>executeProcurementCommand({rpc:async()=>({data:null,error:{message:'Read unavailable'}})},form(),'add_quote_line'),/Read unavailable/);
 await assert.rejects(()=>executeProcurementCommand({rpc:async()=>({data:{ok:true},error:null})},form(),'add_quote_line'),/not confirmed/);
});
