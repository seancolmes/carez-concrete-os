import assert from 'node:assert/strict';
import test from 'node:test';
import {confirmItemUpdate,parseItemValues,parsePlanValues,persistPlan,type PlanValues} from '../app/overhead/save-contract.ts';

const validPlan=()=>new FormData();
function planForm(){
  const form=validPlan();
  form.set('target_margin_percent','0');form.set('planned_productive_hours_annual','2160');
  form.set('owner_compensation_target_annual','0');form.set('owner_planned_field_hours_annual','0');form.set('owner_field_rate','0');
  return form;
}
const values:PlanValues={target_margin_percent:0,planned_productive_hours_annual:2160,owner_compensation_target_annual:0,owner_planned_field_hours_annual:0,owner_field_rate:0};

test('server validation preserves valid zeros and rejects missing or invalid submissions',()=>{
  assert.deepEqual(parsePlanValues(planForm()),values);
  for(const bad of ['', 'Infinity', 'NaN', '-1', '81', '0.01']){
    const form=planForm();form.set('target_margin_percent',bad);
    assert.throws(()=>parsePlanValues(form));
  }
  const absent=planForm();absent.delete('owner_field_rate');assert.throws(()=>parsePlanValues(absent));
  const item=new FormData();item.set('id','item-1');item.set('amount','0');item.set('business_use_percent','0');
  assert.deepEqual(parseItemValues(item),{id:'item-1',amount:0,business_use_percent:0,active:false});
  item.set('business_use_percent','101');assert.throws(()=>parseItemValues(item));
});

test('atomic company-plan save confirms the intended company and preserves valid zero values',async()=>{
 const calls:unknown[]=[];await persistPlan('company-1',values,'f0000000-0000-4000-8000-000000000001','0',async args=>{calls.push(args);return {data:{company_id:'company-1'},error:null};});
 assert.deepEqual(calls,[{p_request_id:'f0000000-0000-4000-8000-000000000001',p_expected_revision:0,p_values:values}]);
});
test('failed, unmatched and zero-row atomic responses never report a complete save',async()=>{
 for(const result of [{data:null,error:new Error('rollback')},{data:null,error:null},{data:{company_id:'foreign'},error:null}])await assert.rejects(persistPlan('company-1',values,'f0000000-0000-4000-8000-000000000001','2',async()=>result),/not saved/);
});
test('missing request identity and stale-form metadata never reach the database',async()=>{
 for(const [id,revision] of [['','0'],['f0000000-0000-4000-8000-000000000001',''],['f0000000-0000-4000-8000-000000000001','-1']]){
 let calls=0;await assert.rejects(persistPlan('company-1',values,id,revision,async()=>{calls++;return{data:null,error:null};}));assert.equal(calls,0);
 }
});
test('item update errors and zero-row updates are surfaced',async()=>{
 await assert.rejects(confirmItemUpdate('item-1',async()=>({data:null,error:new Error('failed')})),/not saved/);
 await assert.rejects(confirmItemUpdate('item-1',async()=>({data:null,error:null})),/not saved/);
 await confirmItemUpdate('item-1',async()=>({data:{id:'item-1'},error:null}));
});
