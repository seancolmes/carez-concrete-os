import assert from 'node:assert/strict';
import test from 'node:test';
import {executeCloseoutCommand,closeoutRequest} from '../lib/projects/closeoutCommands.ts';
test('closeout preserves explicit checkbox, version and reason fields without accepting actors',()=>{
 const f=new FormData();f.set('financial_request_id','c8500000-0000-4000-8000-000000000001');f.set('punch_complete','on');f.set('expected_updated_at','2026-10-17T03:00:00Z');f.set('actor_id','forged');
 const r=closeoutRequest(f,'save_checklist');assert.equal(r.p_values.punch_complete,'on');assert.equal(r.p_values.documents_complete,null);assert.equal(r.p_values.actor_id,undefined);assert.equal(r.p_values.expected_updated_at,'2026-10-17T03:00:00Z');
 f.set('reopen_reason','New work');assert.equal(closeoutRequest(f,'reopen').p_values.reopen_reason,'New work');assert.equal(closeoutRequest(f,'complete').p_values.reopen_reason,undefined);
});
test('closeout transport never treats an empty outcome as completion',async()=>{
 const f=new FormData();f.set('financial_request_id','c8500000-0000-4000-8000-000000000001');await assert.rejects(executeCloseoutCommand({rpc:async()=>({data:null,error:null})},f,'complete'),/not confirmed/);
});
