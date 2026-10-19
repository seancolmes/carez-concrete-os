import assert from 'node:assert/strict';
import test from 'node:test';
import {executeIntelligenceCommand,intelligenceRequest} from '../lib/opportunities/intelligenceCommands.ts';
const id='e1900000-0000-4000-8000-000000000001';
test('Intelligence preserves zero, missing, signed inputs and selected revision without client defaults',()=>{
 const f=new FormData();f.set('financial_request_id',id);f.set('competitor_price','0');f.set('estimate_id','revision');f.set('actor_id','untrusted');
 const r=intelligenceRequest(f,'record_feedback');assert.equal(r.p_values.competitor_price,'0');assert.equal(r.p_values.competitor_name,null);assert.equal(r.p_values.estimate_id,'revision');assert.equal(r.p_values.actor_id,undefined);
 f.set('sell_price_change','-100.25');assert.equal(intelligenceRequest(f,'add_value_option').p_values.sell_price_change,'-100.25');
});
test('Intelligence unconfirmed response rejects and retries preserve identity and payload',async()=>{
 const f=new FormData();f.set('financial_request_id',id);f.set('lead_id','lead');const calls:unknown[]=[];const c={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return{data:{ok:false},error:null};}};
 await assert.rejects(executeIntelligenceCommand(c,f,'record_follow_up'),/not confirmed/);await assert.rejects(executeIntelligenceCommand(c,f,'record_follow_up'),/not confirmed/);assert.deepEqual(calls[0],calls[1]);
});
