'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:p}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!p?.company_id)throw new Error('Company missing');
  return {supabase,user,companyId:p.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;

export async function createChangeOrder(fd:FormData){
  const project_id=String(fd.get('project_id')||'');
  const title=String(fd.get('title')||'').trim();
  if(!project_id||!title)return;
  const {supabase,user,companyId}=await ctx();
  const requestedDate=String(fd.get('requested_date')||new Date().toISOString().slice(0,10));
  const [{data:project},{count},{data:snapshot,error:snapshotError}]=await Promise.all([
    supabase.from('projects').select('target_margin_percent,bo_rate_percent,payment_processing_rate_percent').eq('id',project_id).eq('company_id',companyId).single(),
    supabase.from('change_orders').select('*',{count:'exact',head:true}).eq('project_id',project_id),
    supabase.rpc('capture_overhead_rate_snapshot',{p_effective_date:requestedDate})
  ]);
  if(!project)throw new Error('Project not found');
  if(snapshotError)throw new Error(snapshotError.message);
  const co_number=`CO-${String((count||0)+1).padStart(3,'0')}`;
  const {error}=await supabase.from('change_orders').insert({
    company_id:companyId,project_id,co_number,title,
    description:String(fd.get('description')||'').trim()||null,
    reason:String(fd.get('reason')||'').trim()||null,
    requested_by:String(fd.get('requested_by')||'').trim()||null,
    requested_date:requestedDate,
    change_type:String(fd.get('change_type')||'additive'),
    target_margin_percent:Number(project.target_margin_percent||30),
    bo_rate_percent:Number(project.bo_rate_percent||0.471),
    payment_processing_rate_percent:Number(project.payment_processing_rate_percent||0),
    overhead_snapshot_id:snapshot?.id||null,
    overhead_rate_snapshot:Number(snapshot?.overhead_rate_per_productive_hour||0),
    created_by:user.id
  });
  if(error)throw new Error(error.message);
  revalidatePath('/change-orders');
}

export async function addChangeOrderItem(fd:FormData){
  const change_order_id=String(fd.get('change_order_id')||'');
  const description=String(fd.get('description')||'').trim();
  if(!change_order_id||!description)return;
  const {supabase,companyId}=await ctx();
  const {data:co}=await supabase.from('change_orders').select('id,status,requested_date').eq('id',change_order_id).eq('company_id',companyId).single();
  if(!co)throw new Error('Change order not found');
  if(co.status!=='draft')throw new Error('Only draft change orders can be edited. Return it to Draft before changing scope.');

  const itemType=String(fd.get('item_type')||'material');
  const costEffect=String(fd.get('cost_effect')||'cost');
  const sign=costEffect==='credit'?-1:1;
  const crew_member_id=String(fd.get('crew_member_id')||'')||null;
  const riskClass=String(fd.get('risk_class_code')||'')||null;
  const quantity=Math.abs(n(fd.get('quantity')));
  const unitCost=Math.abs(n(fd.get('unit_cost')));
  const regular=Math.abs(n(fd.get('regular_hours')));
  const overtime=Math.abs(n(fd.get('overtime_hours')));
  let directCost=r(sign*quantity*unitCost),baseRate:null|number=null,ssRate:null|number=null,medRate:null|number=null,futaRate:null|number=null,suiRate:null|number=null,liRate:null|number=null,sickRate:null|number=null;
  let storedQty=sign*quantity,storedRegular=0,storedOvertime=0,unit=String(fd.get('unit')||'LS');

  if(itemType==='labor'){
    if(!crew_member_id)throw new Error('Select a worker for labor.');
    const year=Number(String(co.requested_date).slice(0,4));
    const [{data:crew},{data:tax},{data:taxStatus},{data:risk}]=await Promise.all([
      supabase.from('crew_members').select('hourly_rate,internal_field_rate,is_owner').eq('id',crew_member_id).eq('company_id',companyId).single(),
      supabase.from('labor_tax_settings').select('*').eq('company_id',companyId).eq('tax_year',year).maybeSingle(),
      supabase.from('employee_tax_status').select('*').eq('company_id',companyId).eq('crew_member_id',crew_member_id).eq('tax_year',year).maybeSingle(),
      riskClass?supabase.from('li_risk_classes').select('*').eq('company_id',companyId).eq('tax_year',year).eq('code',riskClass).maybeSingle():Promise.resolve({data:null})
    ]);
    if(!crew)throw new Error('Worker not found');
    const owner=Boolean(crew.is_owner);
    baseRate=Number(owner?(crew.internal_field_rate??crew.hourly_rate??0):(crew.hourly_rate??0));
    const gross=regular*baseRate+overtime*baseRate*1.5;
    if(owner){ssRate=0;medRate=0;futaRate=0;suiRate=0;liRate=0;sickRate=0;}
    else{
      if(!tax||!risk)throw new Error('Labor tax/L&I settings missing.');
      ssRate=taxStatus?.social_security_cap_reached?0:Number(tax.social_security_rate||0);
      medRate=Number(tax.medicare_rate||0);
      futaRate=taxStatus?.futa_cap_reached?0:Number(tax.futa_rate||0);
      suiRate=taxStatus?.wa_sui_cap_reached?0:Number(tax.wa_sui_rate||0);
      liRate=Number(risk.employer_rate_per_hour||0);
      sickRate=Number(tax.sick_leave_accrual_rate||0);
    }
    const loaded=gross+gross*((ssRate||0)+(medRate||0)+(futaRate||0)+(suiRate||0))+(regular+overtime)*(liRate||0)+(regular+overtime)*baseRate*(sickRate||0);
    directCost=r(sign*loaded);
    storedQty=sign*(regular+overtime);storedRegular=sign*regular;storedOvertime=sign*overtime;unit='HR';
  }

  const {error}=await supabase.from('change_order_items').insert({
    company_id:companyId,change_order_id,item_type:itemType,cost_effect:costEffect,
    cost_code_id:String(fd.get('cost_code_id')||'')||null,catalog_item_id:String(fd.get('catalog_item_id')||'')||null,
    crew_member_id,labor_task:String(fd.get('labor_task')||'')||null,risk_class_code:riskClass,description,
    quantity:storedQty,unit,unit_cost:itemType==='labor'?(baseRate||0):unitCost,direct_cost:directCost,
    regular_hours:storedRegular,overtime_hours:storedOvertime,base_hourly_rate_snapshot:baseRate,
    social_security_rate_snapshot:ssRate,medicare_rate_snapshot:medRate,futa_rate_snapshot:futaRate,wa_sui_rate_snapshot:suiRate,
    li_employer_rate_snapshot:liRate,sick_leave_accrual_rate_snapshot:sickRate,
    notes:String(fd.get('notes')||'').trim()||null,sort_order:Date.now()%1000000
  });
  if(error)throw new Error(error.message);
  revalidatePath('/change-orders');
}

export async function updateChangeOrder(fd:FormData){
  const id=String(fd.get('change_order_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:co}=await supabase.from('change_orders').select('status,change_type').eq('id',id).eq('company_id',companyId).single();
  if(!co||co.status==='approved'||co.status==='rejected'||co.status==='void')return;
  const status=String(fd.get('status')||'draft');
  if(!['draft','submitted'].includes(status))throw new Error('Invalid workflow status');
  const rawPrice=Math.abs(n(fd.get('proposed_sell_price')));
  const signedPrice=co.change_type==='deductive'?-rawPrice:co.change_type==='no_cost'?0:rawPrice;
  const patch:any={
    target_margin_percent:n(fd.get('target_margin_percent')),
    payment_processing_rate_percent:n(fd.get('payment_processing_rate_percent')),
    proposed_sell_price:signedPrice,
    field_work_status:String(fd.get('field_work_status')||'not_started'),
    status,updated_at:new Date().toISOString()
  };
  if(status==='submitted'&&co.status!=='submitted')patch.submitted_at=new Date().toISOString();
  const {error}=await supabase.from('change_orders').update(patch).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/change-orders');
}

export async function approveChangeOrder(fd:FormData){
  const id=String(fd.get('change_order_id')||'');if(!id)return;
  const {supabase}=await ctx();
  const {error}=await supabase.rpc('approve_change_order',{p_change_order_id:id});
  if(error)throw new Error(error.message);
  revalidatePath('/change-orders');revalidatePath('/projects');revalidatePath('/forecast');revalidatePath('/field');revalidatePath('/costs');
}

export async function rejectChangeOrder(fd:FormData){
  const id=String(fd.get('change_order_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:co}=await supabase.from('change_orders').select('status').eq('id',id).eq('company_id',companyId).single();
  if(!co||co.status==='approved')return;
  await supabase.from('change_orders').update({status:'rejected',rejected_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  revalidatePath('/change-orders');
}

export async function deleteChangeOrderItem(fd:FormData){
  const id=String(fd.get('item_id')||'');const coId=String(fd.get('change_order_id')||'');if(!id||!coId)return;
  const {supabase,companyId}=await ctx();
  const {data:co}=await supabase.from('change_orders').select('status').eq('id',coId).eq('company_id',companyId).single();
  if(co?.status!=='draft')throw new Error('Only draft change orders can be edited.');
  await supabase.from('change_order_items').delete().eq('id',id).eq('company_id',companyId);
  revalidatePath('/change-orders');
}
