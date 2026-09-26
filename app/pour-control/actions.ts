'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id)throw new Error('Company profile missing');
  return {supabase,user,companyId:profile.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;

async function resetForReview(supabase:any,companyId:string,pourPlanId:string){
  const {data:plan}=await supabase.from('pour_plans').select('status').eq('id',pourPlanId).eq('company_id',companyId).maybeSingle();
  if(plan&&plan.status!=='completed'&&plan.status!=='cancelled')await supabase.from('pour_plans').update({status:'planning',updated_at:new Date().toISOString()}).eq('id',pourPlanId).eq('company_id',companyId);
}

export async function createPourPlan(fd:FormData){
  const projectId=String(fd.get('project_id')||''),name=String(fd.get('name')||'').trim();
  if(!projectId||!name)return;
  const {supabase,user,companyId}=await ctx();
  const budgetSectionId=String(fd.get('budget_section_id')||'')||null;
  const changeOrderId=String(fd.get('change_order_id')||'')||null;
  if(budgetSectionId){const {data:s}=await supabase.from('project_budget_sections').select('id,budget_id,project_budgets(project_id)').eq('id',budgetSectionId).maybeSingle();if(!s||((s as any).project_budgets?.project_id!==projectId))throw new Error('Budget scope does not belong to this project.');}
  if(changeOrderId){const {data:co}=await supabase.from('approved_change_order_references').select('id,project_id').eq('id',changeOrderId).eq('company_id',companyId).maybeSingle();if(!co||co.project_id!==projectId)throw new Error('Only an approved change order from this project can be linked.');}
  const {error}=await supabase.from('pour_plans').insert({
    company_id:companyId,project_id:projectId,budget_section_id:budgetSectionId,change_order_id:changeOrderId,
    name,scheduled_date:String(fd.get('scheduled_date')||'')||null,
    expected_concrete_yards:Math.max(0,n(fd.get('expected_concrete_yards'))),
    contingency_percent:Math.max(0,n(fd.get('contingency_percent'))),
    minimum_cash_buffer:Math.max(0,n(fd.get('minimum_cash_buffer'))),
    company_cash_support:Math.max(0,n(fd.get('company_cash_support'))),
    notes:String(fd.get('notes')||'').trim()||null,created_by:user.id
  });
  if(error)throw new Error(error.message);
  revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function updatePourPlan(fd:FormData){
  const id=String(fd.get('pour_plan_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:plan}=await supabase.from('pour_plans').select('status').eq('id',id).eq('company_id',companyId).maybeSingle();
  if(!plan||plan.status==='completed'||plan.status==='cancelled')throw new Error('Completed or cancelled pour plans are locked.');
  const {error}=await supabase.from('pour_plans').update({
    name:String(fd.get('name')||'').trim(),scheduled_date:String(fd.get('scheduled_date')||'')||null,
    expected_concrete_yards:Math.max(0,n(fd.get('expected_concrete_yards'))),
    contingency_percent:Math.max(0,n(fd.get('contingency_percent'))),
    minimum_cash_buffer:Math.max(0,n(fd.get('minimum_cash_buffer'))),
    company_cash_support:Math.max(0,n(fd.get('company_cash_support'))),
    notes:String(fd.get('notes')||'').trim()||null,status:'planning',updated_at:new Date().toISOString()
  }).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/pour-control');
}

export async function addPourCostItem(fd:FormData){
  const pourPlanId=String(fd.get('pour_plan_id')||''),description=String(fd.get('description')||'').trim();if(!pourPlanId||!description)return;
  const {supabase,companyId}=await ctx();
  const {data:plan}=await supabase.from('pour_plans').select('status').eq('id',pourPlanId).eq('company_id',companyId).maybeSingle();
  if(!plan||plan.status==='completed'||plan.status==='cancelled')throw new Error('This pour plan is locked.');
  const quantity=Math.max(0,n(fd.get('quantity'))),unitCost=Math.max(0,n(fd.get('unit_cost'))),expected=r(quantity*unitCost);
  const {error}=await supabase.from('pour_cost_items').insert({
    company_id:companyId,pour_plan_id:pourPlanId,item_type:String(fd.get('item_type')||'other'),
    cost_code_id:String(fd.get('cost_code_id')||'')||null,catalog_item_id:String(fd.get('catalog_item_id')||'')||null,
    description,quantity,unit:String(fd.get('unit')||'LS'),unit_cost:unitCost,expected_cost:expected,
    committed:fd.get('committed')==='on',vendor_name:String(fd.get('vendor_name')||'').trim()||null,
    notes:String(fd.get('notes')||'').trim()||null,sort_order:Date.now()%1000000
  });
  if(error)throw new Error(error.message);
  await resetForReview(supabase,companyId,pourPlanId);
  revalidatePath('/pour-control');
}

export async function addPourLaborItem(fd:FormData){
  const pourPlanId=String(fd.get('pour_plan_id')||''),crewId=String(fd.get('crew_member_id')||'');if(!pourPlanId||!crewId)return;
  const {supabase,companyId}=await ctx();
  const {data:plan}=await supabase.from('pour_plans').select('status,scheduled_date').eq('id',pourPlanId).eq('company_id',companyId).maybeSingle();
  if(!plan||plan.status==='completed'||plan.status==='cancelled')throw new Error('This pour plan is locked.');
  const year=Number(String(plan.scheduled_date||new Date().toISOString().slice(0,10)).slice(0,4));
  const riskClass=String(fd.get('risk_class_code')||'');
  const regular=Math.max(0,n(fd.get('regular_hours'))),ot=Math.max(0,n(fd.get('overtime_hours'))),hours=regular+ot;if(hours<=0)return;
  const [{data:crew},{data:tax},{data:status},{data:risk}]=await Promise.all([
    supabase.from('crew_members').select('name,hourly_rate,internal_field_rate,is_owner').eq('id',crewId).eq('company_id',companyId).single(),
    supabase.from('labor_tax_settings').select('*').eq('company_id',companyId).eq('tax_year',year).maybeSingle(),
    supabase.from('employee_tax_status').select('*').eq('company_id',companyId).eq('crew_member_id',crewId).eq('tax_year',year).maybeSingle(),
    riskClass?supabase.from('li_risk_classes').select('*').eq('company_id',companyId).eq('tax_year',year).eq('code',riskClass).maybeSingle():Promise.resolve({data:null})
  ]);
  if(!crew)throw new Error('Worker not found');
  const owner=Boolean(crew.is_owner),base=Number(owner?(crew.internal_field_rate??crew.hourly_rate??0):(crew.hourly_rate??0));
  const gross=regular*base+ot*base*1.5;
  let ss=0,med=0,futa=0,sui=0,li=0,sick=0;
  if(!owner){
    if(!tax||!risk)throw new Error('Labor tax or L&I settings are missing for this scheduled year.');
    ss=status?.social_security_cap_reached?0:Number(tax.social_security_rate||0);
    med=Number(tax.medicare_rate||0);futa=status?.futa_cap_reached?0:Number(tax.futa_rate||0);sui=status?.wa_sui_cap_reached?0:Number(tax.wa_sui_rate||0);li=Number(risk.employer_rate_per_hour||0);sick=Number(tax.sick_leave_accrual_rate||0);
  }
  const expected=r(gross+gross*(ss+med+futa+sui)+hours*li+hours*base*sick);
  const description=String(fd.get('description')||'').trim()||`${crew.name} — Pour labor`;
  const {error}=await supabase.from('pour_cost_items').insert({
    company_id:companyId,pour_plan_id:pourPlanId,item_type:'labor',crew_member_id:crewId,description,
    quantity:hours,unit:'HR',unit_cost:base,expected_cost:expected,regular_hours:regular,overtime_hours:ot,
    risk_class_code:owner?null:riskClass,base_hourly_rate_snapshot:base,labor_cost_method:owner?'owner_internal_v1':'statutory_v1',
    committed:fd.get('committed')==='on',notes:String(fd.get('notes')||'').trim()||null,sort_order:Date.now()%1000000
  });
  if(error)throw new Error(error.message);
  await resetForReview(supabase,companyId,pourPlanId);
  revalidatePath('/pour-control');
}

export async function deletePourCostItem(fd:FormData){
  const id=String(fd.get('item_id')||''),pourPlanId=String(fd.get('pour_plan_id')||'');if(!id||!pourPlanId)return;
  const {supabase,companyId}=await ctx();
  const {data:plan}=await supabase.from('pour_plans').select('status').eq('id',pourPlanId).eq('company_id',companyId).maybeSingle();
  if(!plan||plan.status==='completed'||plan.status==='cancelled')throw new Error('This pour plan is locked.');
  await supabase.from('pour_cost_items').delete().eq('id',id).eq('company_id',companyId).eq('pour_plan_id',pourPlanId);
  await resetForReview(supabase,companyId,pourPlanId);
  revalidatePath('/pour-control');
}

export async function recordPourAuthorization(fd:FormData){
  const pourPlanId=String(fd.get('pour_plan_id')||''),decision=String(fd.get('decision')||'hold');if(!pourPlanId)return;
  const {supabase,user,companyId}=await ctx();
  const {data:s}=await supabase.from('pour_plan_financial_summary').select('*').eq('pour_plan_id',pourPlanId).eq('company_id',companyId).maybeSingle();
  if(!s)throw new Error('Pour plan not found');
  if(['completed','cancelled'].includes(String(s.status)))throw new Error('Completed or cancelled pour plans are locked.');
  const override=s.system_recommendation==='hold'&&decision==='authorized';
  const reason=String(fd.get('override_reason')||'').trim()||null;
  if(override&&!reason)throw new Error('An override reason is required to authorize a pour that is not cash-cleared.');
  const {error}=await supabase.from('pour_authorization_snapshots').insert({
    company_id:companyId,pour_plan_id:pourPlanId,
    project_funding_balance:Number(s.project_funding_balance||0),gross_customer_cash:Number(s.gross_customer_cash||0),
    sales_tax_cash_reserved:Number(s.sales_tax_cash_reserved||0),processing_fees_paid:Number(s.processing_fees_paid||0),incurred_direct_cost:Number(s.incurred_direct_cost||0),
    planned_exposure:Number(s.planned_exposure||0),contingency_amount:Number(s.contingency_amount||0),minimum_cash_buffer:Number(s.minimum_cash_buffer||0),
    company_cash_support:Number(s.company_cash_support||0),funding_gap:Number(s.required_additional_cash||0),system_recommendation:String(s.system_recommendation),
    decision:decision==='authorized'?'authorized':'hold',override_used:override,override_reason:reason,notes:String(fd.get('notes')||'').trim()||null,created_by:user.id
  });
  if(error)throw new Error(error.message);
  await supabase.from('pour_plans').update({status:decision==='authorized'?'authorized':'hold',updated_at:new Date().toISOString()}).eq('id',pourPlanId).eq('company_id',companyId);
  revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function closePourPlan(fd:FormData){
  const id=String(fd.get('pour_plan_id')||''),status=String(fd.get('status')||'completed');if(!id)return;
  if(!['completed','cancelled'].includes(status))return;
  const {supabase,companyId}=await ctx();
  await supabase.from('pour_plans').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  revalidatePath('/pour-control');revalidatePath('/projects');
}
