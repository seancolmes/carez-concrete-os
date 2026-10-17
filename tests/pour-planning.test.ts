import test from 'node:test';import assert from 'node:assert/strict';
import {pourPlanningRequest,executePourPlanning} from '../lib/financials/pourPlanning.ts';
const id='f9900000-0000-4000-8000-000000000001';
test('planning preserves explicit zero and independent work/payroll dates without accepting calculated amounts',()=>{
 const f=new FormData();for(const [key,value] of Object.entries({financial_request_id:id,pour_plan_id:'plan',crew_member_id:'worker',regular_hours:'0',overtime_hours:'1',payroll_tax_date:'2027-01-10',expected_cost:'0',company_id:'forged',base_hourly_rate_snapshot:'0'}))f.set(key,value);
 const p=pourPlanningRequest(f,'add_labor');assert.equal(p.p_request_id,id);assert.equal(p.p_values.regular_hours,'0');assert.equal(p.p_values.payroll_tax_date,'2027-01-10');assert.equal('expected_cost' in p.p_values,false);assert.equal('base_hourly_rate_snapshot' in p.p_values,false);assert.equal('company_id' in p.p_values,false);
});
test('plan commands require stable identities and confirmed database outcomes',async()=>{
 assert.throws(()=>pourPlanningRequest(new FormData(),'create_plan'));
 const f=new FormData();f.set('financial_request_id',id);f.set('pour_plan_id','plan');
 for(const response of [{data:null,error:{message:'read unavailable'}},{data:{ok:true},error:null},{data:{ok:false,id:'bad'},error:null}])await assert.rejects(executePourPlanning({rpc:async()=>response},f,'close_plan'));
 const result=await executePourPlanning({rpc:async(name,args)=>{assert.equal(name,'carez_pour_planning_command_v1');assert.equal(args.p_command,'close_plan');return{data:{ok:true,id:'confirmed'},error:null};}},f,'close_plan');assert.equal(result.id,'confirmed');
});
