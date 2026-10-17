import assert from 'node:assert/strict';
import test from 'node:test';
import {executeResourceCommand,resourceRequest} from '../lib/field/resourceCommand.ts';
function form(){const input=new FormData();input.set('financial_request_id','d1950000-0000-4000-8000-000000000001');return input;}
test('resource commands keep explicit checkbox decisions and whitelist tenant/approval authority',()=>{
 const input=form();input.set('required_before_start','on');input.set('company_id','foreign');input.set('waived_by','forged');input.set('required_quantity','0');const result=resourceRequest(input,'create');assert.equal(result.p_values.required_before_start,true);assert.equal(result.p_values.equipment_confirmed,false);assert.equal(result.p_values.required_quantity,'0');assert.equal('company_id' in result.p_values,false);assert.equal('waived_by' in result.p_values,false);
});
test('unknown inventory costs stay missing while recorded zero and signed corrections survive parsing',()=>{
 const input=form();input.set('quantity_on_hand','0');assert.equal(resourceRequest(input,'create_inventory').p_values.average_unit_cost,null);assert.equal(resourceRequest(input,'create_inventory').p_values.quantity_on_hand,'0');input.set('average_unit_cost','0');assert.equal(resourceRequest(input,'create_inventory').p_values.average_unit_cost,'0');input.set('quantity','-2');assert.equal(resourceRequest(input,'adjust_inventory').p_values.quantity,'-2');
});
test('unconfirmed resource outcomes cannot appear saved; retries bind the original identity',async()=>{
 const input=form();const original=resourceRequest(input,'consume');assert.deepEqual(resourceRequest(input,'consume'),original);
 await assert.rejects(()=>executeResourceCommand({rpc:async()=>({data:null,error:{message:'Reservation unavailable'}})},input,'consume'),/Reservation unavailable/);
 await assert.rejects(()=>executeResourceCommand({rpc:async()=>({data:{ok:true},error:null})},input,'consume'),/not confirmed/);
 input.delete('financial_request_id');assert.throws(()=>resourceRequest(input,'consume'),/request identity/);
});
