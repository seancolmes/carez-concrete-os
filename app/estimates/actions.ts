'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');
 const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');
 return {supabase,user,companyId:p.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;

export async function createEstimate(fd:FormData){
 const {supabase,user,companyId}=await ctx();
 const project_id=String(fd.get('project_id')||'')||null;
 const requestedName=String(fd.get('name')||'').trim();
 const [{data:company},{data:snapshot},{data:project}]=await Promise.all([
  supabase.from('companies').select('target_margin_percent,default_bo_classification,retailing_bo_rate_percent,wholesaling_bo_rate_percent').eq('id',companyId).single(),
  supabase.rpc('capture_overhead_rate_snapshot',{p_effective_date:new Date().toISOString().slice(0,10)}),
  project_id?supabase.from('projects').select('job_number,name').eq('id',project_id).eq('company_id',companyId).maybeSingle():Promise.resolve({data:null})
 ]);
 let opportunity=project?.job_number||null;if(!opportunity){const {data:o,error}=await supabase.rpc('next_opportunity_number');if(error||!o)throw new Error(error?.message||'Could not create opportunity number.');opportunity=o;}
 const name=requestedName||project?.name||`Concrete Opportunity ${opportunity}`,estimate_number=`E-${opportunity}`;
 const bo=company?.default_bo_classification||'retailing';
 const boRate=bo==='wholesaling'?Number(company?.wholesaling_bo_rate_percent||0.484):Number(company?.retailing_bo_rate_percent||0.471);
 const {data:estimate,error}=await supabase.from('estimates').insert({company_id:companyId,project_id,opportunity_number:opportunity,estimate_number,name,target_margin_percent:Number(company?.target_margin_percent||30),bo_classification:bo,bo_rate_percent:boRate,overhead_snapshot_id:snapshot?.id||null,overhead_rate_snapshot:Number(snapshot?.overhead_rate_per_productive_hour||0),created_by:user.id}).select('id').single();
 if(error)throw new Error(error.message);
 const starter=['Footings','Stem Walls','Slabs / Flatwork'];
 await supabase.from('estimate_sections').insert(starter.map((s,i)=>({company_id:companyId,estimate_id:estimate.id,name:s,scope_type:s==='Footings'?'footing':s==='Stem Walls'?'wall':'flatwork',sort_order:(i+1)*10})));
 revalidatePath('/estimates');
}

export async function addEstimateSection(fd:FormData){
 const estimate_id=String(fd.get('estimate_id')||''),name=String(fd.get('name')||'').trim();if(!estimate_id||!name)return;
 const {supabase,companyId}=await ctx();
 await supabase.from('estimate_sections').insert({company_id:companyId,estimate_id,name,scope_type:String(fd.get('scope_type')||'other'),sort_order:Date.now()%1000000});
 revalidatePath('/estimates');
}

export async function addEstimateItem(fd:FormData){
 const estimate_id=String(fd.get('estimate_id')||''),section_id=String(fd.get('section_id')||'')||null,item_type=String(fd.get('item_type')||'material'),description=String(fd.get('description')||'').trim();if(!estimate_id||!description)return;
 const {supabase,companyId}=await ctx();
 const quantity=n(fd.get('quantity')),unit=String(fd.get('unit')||'LS'),unitCost=n(fd.get('unit_cost'));
 const crew_member_id=String(fd.get('crew_member_id')||'')||null;
 const regular=n(fd.get('regular_hours')),ot=n(fd.get('overtime_hours'));
 let directCost=r(quantity*unitCost),baseRate:null|number=null,ssRate:null|number=null,medRate:null|number=null,futaRate:null|number=null,suiRate:null|number=null,liRate:null|number=null,sickRate:null|number=null;
 if(item_type==='labor'){
  if(!crew_member_id)throw new Error('Select a worker for labor.');
  const [{data:crew},{data:tax},{data:status},{data:risk}]=await Promise.all([
   supabase.from('crew_members').select('hourly_rate,internal_field_rate,is_owner').eq('id',crew_member_id).eq('company_id',companyId).single(),
   supabase.from('labor_tax_settings').select('*').eq('company_id',companyId).eq('tax_year',2026).maybeSingle(),
   supabase.from('employee_tax_status').select('*').eq('company_id',companyId).eq('crew_member_id',crew_member_id).eq('tax_year',2026).maybeSingle(),
   String(fd.get('risk_class_code')||'')?supabase.from('li_risk_classes').select('*').eq('company_id',companyId).eq('tax_year',2026).eq('code',String(fd.get('risk_class_code'))).maybeSingle():Promise.resolve({data:null})
  ]);
  if(!crew)throw new Error('Worker not found');
  const owner=Boolean(crew.is_owner);baseRate=Number(owner?(crew.internal_field_rate??crew.hourly_rate??0):(crew.hourly_rate??0));
  const gross=regular*baseRate+ot*baseRate*1.5;
  if(owner){ssRate=0;medRate=0;futaRate=0;suiRate=0;liRate=0;sickRate=0;}else{
   if(!tax||!risk)throw new Error('Labor tax/L&I settings missing.');
   ssRate=status?.social_security_cap_reached?0:Number(tax.social_security_rate||0);medRate=Number(tax.medicare_rate||0);futaRate=status?.futa_cap_reached?0:Number(tax.futa_rate||0);suiRate=status?.wa_sui_cap_reached?0:Number(tax.wa_sui_rate||0);liRate=Number(risk.employer_rate_per_hour||0);sickRate=Number(tax.sick_leave_accrual_rate||0);
  }
  directCost=r(gross+gross*(ssRate+medRate+futaRate+suiRate)+(regular+ot)*(liRate||0)+(regular+ot)*baseRate*(sickRate||0));
 }
 await supabase.from('estimate_items').insert({company_id:companyId,estimate_id,section_id,item_type,cost_code_id:String(fd.get('cost_code_id')||'')||null,catalog_item_id:String(fd.get('catalog_item_id')||'')||null,crew_member_id,labor_task:String(fd.get('labor_task')||'')||null,risk_class_code:String(fd.get('risk_class_code')||'')||null,description,quantity:item_type==='labor'?(regular+ot):quantity,unit:item_type==='labor'?'HR':unit,unit_cost:item_type==='labor'?(baseRate||0):unitCost,direct_cost:directCost,regular_hours:regular,overtime_hours:ot,base_hourly_rate_snapshot:baseRate,social_security_rate_snapshot:ssRate,medicare_rate_snapshot:medRate,futa_rate_snapshot:futaRate,wa_sui_rate_snapshot:suiRate,li_employer_rate_snapshot:liRate,sick_leave_accrual_rate_snapshot:sickRate,sort_order:Date.now()%1000000});
 revalidatePath('/estimates');
}

export async function updateEstimatePricing(fd:FormData){
 const id=String(fd.get('estimate_id')||'');if(!id)return;const {supabase,companyId}=await ctx();
 const {data:e}=await supabase.from('estimates').select('status').eq('id',id).eq('company_id',companyId).maybeSingle();if(!e||['accepted','approved'].includes(e.status))throw new Error('Accepted/approved estimates are locked.');
 const bo=String(fd.get('bo_classification')||'retailing');
 const boRate=bo==='wholesaling'?0.484:0.471;
 await supabase.from('estimates').update({target_margin_percent:n(fd.get('target_margin_percent')),bo_classification:bo,bo_rate_percent:boRate,payment_processing_rate_percent:n(fd.get('payment_processing_rate_percent')),proposed_sell_price:n(fd.get('proposed_sell_price')),status:String(fd.get('status')||'draft')}).eq('id',id).eq('company_id',companyId);
 revalidatePath('/estimates');
}

export async function approveEstimateToBudget(fd:FormData){
 const estimate_id=String(fd.get('estimate_id')||'');if(!estimate_id)return;const {supabase,companyId}=await ctx();
 const [{data:e},{data:summary},{data:sections},{data:items}]=await Promise.all([
  supabase.from('estimates').select('*').eq('id',estimate_id).eq('company_id',companyId).single(),
  supabase.from('estimate_financial_summary').select('*').eq('estimate_id',estimate_id).single(),
  supabase.from('estimate_sections').select('*').eq('estimate_id',estimate_id).order('sort_order'),
  supabase.from('estimate_items').select('*').eq('estimate_id',estimate_id).order('sort_order')
 ]);
 if(e?.status==='accepted')throw new Error('This estimate was already accepted and frozen automatically.');
 if(!e?.project_id)throw new Error('Link this estimate to a project before approving.');
 await supabase.from('project_budgets').update({status:'superseded'}).eq('project_id',e.project_id).eq('budget_type','original').eq('status','active');
 const sell=Number(summary.selected_sell_price||0),rev=Number(summary.revenue_cost_reserve||0),totalCost=Number(summary.base_company_cost||0)+rev,profit=sell-totalCost,margin=sell>0?100*profit/sell:0;
 const {data:b,error}=await supabase.from('project_budgets').insert({company_id:companyId,project_id:e.project_id,estimate_id,budget_type:'original',version:e.version,status:'active',label:`${e.estimate_number}-R${e.version} Original Budget`,sell_price:sell,target_margin_percent:e.target_margin_percent,bo_rate_percent:e.bo_rate_percent,payment_processing_rate_percent:e.payment_processing_rate_percent,labor_hours:Number(summary.labor_hours||0),direct_labor_cost:Number(summary.direct_labor_cost||0),material_cost:Number(summary.material_cost||0),equipment_cost:Number(summary.equipment_cost||0),subcontractor_cost:Number(summary.subcontractor_cost||0),other_direct_cost:Number(summary.other_direct_cost||0),total_direct_cost:Number(summary.total_direct_cost||0),overhead_cost:Number(summary.overhead_cost||0),revenue_cost_reserve:rev,total_company_cost:r(totalCost),budgeted_profit:r(profit),budgeted_margin_percent:r(margin)}).select('id').single();
 if(error)throw new Error(error.message);
 const sectionMap=new Map<string,string>();
 for(const s of sections||[]){const {data:bs}=await supabase.from('project_budget_sections').insert({company_id:companyId,budget_id:b.id,source_estimate_section_id:s.id,name:s.name,scope_type:s.scope_type,sort_order:s.sort_order}).select('id').single();if(bs)sectionMap.set(s.id,bs.id);}
 if((items||[]).length)await supabase.from('project_budget_lines').insert((items||[]).map(i=>({company_id:companyId,budget_id:b.id,budget_section_id:i.section_id?sectionMap.get(i.section_id)||null:null,source_estimate_item_id:i.id,item_type:i.item_type,cost_code_id:i.cost_code_id,catalog_item_id:i.catalog_item_id,crew_member_id:i.crew_member_id,labor_task:i.labor_task,risk_class_code:i.risk_class_code,description:i.description,quantity:i.quantity,unit:i.unit,unit_cost:i.unit_cost,direct_cost:i.direct_cost,regular_hours:i.regular_hours,overtime_hours:i.overtime_hours,notes:i.notes,sort_order:i.sort_order})));
 await Promise.all([
  supabase.from('estimates').update({status:'approved',approved_at:new Date().toISOString()}).eq('id',estimate_id),
  supabase.from('projects').update({contract_value:sell,target_margin_percent:e.target_margin_percent,bo_classification:e.bo_classification,bo_rate_percent:e.bo_rate_percent,payment_processing_rate_percent:e.payment_processing_rate_percent,estimated_labor_hours:Number(summary.labor_hours||0),estimated_labor_cost:Number(summary.direct_labor_cost||0)}).eq('id',e.project_id)
 ]);
 revalidatePath('/estimates');revalidatePath('/projects');
}
