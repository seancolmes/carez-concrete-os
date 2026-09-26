'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { signedChangeOrderCost } from '@/lib/change-orders/contracts';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!p?.company_id)throw new Error('Company missing');
  if(!['owner','office'].includes(p.role))throw new Error('Owner or office authority required.');
  return {supabase,user,companyId:p.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const s=(fd:FormData,key:string)=>String(fd.get(key)||'').trim()||null;
const refresh=()=>{for(const p of ['/change-orders','/projects','/forecast','/field','/costs','/billing','/pour-control'])revalidatePath(p);};

export async function createChangeOrder(fd:FormData){
  const project_id=String(fd.get('project_id')||''),title=String(fd.get('title')||'').trim();
  if(!project_id||!title)return;
  const {supabase}=await ctx();
  const requestedDate=String(fd.get('requested_date')||new Date().toISOString().slice(0,10));
  const {data:snapshot,error:snapshotError}=await supabase.rpc('capture_overhead_rate_snapshot',{p_effective_date:requestedDate});
  if(snapshotError)throw new Error(snapshotError.message);
  const {error}=await supabase.rpc('carez_create_change_order',{
    p_project_id:project_id,p_title:title,p_change_type:String(fd.get('change_type')||'additive'),p_requested_date:requestedDate,
    p_description:s(fd,'description'),p_reason:s(fd,'reason'),p_requested_by:s(fd,'requested_by'),
    p_overhead_snapshot_id:snapshot?.id||null,p_overhead_rate_snapshot:Number(snapshot?.overhead_rate_per_productive_hour||0),
    p_reversal_of_change_order_id:s(fd,'reversal_of_change_order_id')
  });
  if(error)throw new Error(error.message);
  refresh();
}

export async function addChangeOrderItem(fd:FormData){
  const change_order_id=String(fd.get('change_order_id')||''),description=String(fd.get('description')||'').trim();
  if(!change_order_id||!description)return;
  const {supabase,companyId}=await ctx();
  const {data:co}=await supabase.from('change_orders').select('id,status,requested_date').eq('id',change_order_id).eq('company_id',companyId).single();
  if(!co||co.status!=='draft')throw new Error('Only draft Change Orders can be edited.');
  const itemType=String(fd.get('item_type')||'material'),costEffect=String(fd.get('cost_effect')||'cost');
  const crew_member_id=s(fd,'crew_member_id'),riskClass=s(fd,'risk_class_code');
  const quantity=Math.abs(n(fd.get('quantity'))),unitCost=Math.abs(n(fd.get('unit_cost')));
  const regular=Math.abs(n(fd.get('regular_hours'))),overtime=Math.abs(n(fd.get('overtime_hours')));
  let directCost=r(signedChangeOrderCost(costEffect as 'cost'|'credit',quantity*unitCost));
  let baseRate:number|null=null,ssRate:number|null=null,medRate:number|null=null,futaRate:number|null=null,suiRate:number|null=null,liRate:number|null=null,sickRate:number|null=null;
  const storedQty=itemType==='labor'?regular+overtime:quantity,storedRegular=itemType==='labor'?regular:0,storedOvertime=itemType==='labor'?overtime:0;
  let unit=String(fd.get('unit')||'LS');
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
      medRate=Number(tax.medicare_rate||0);futaRate=taxStatus?.futa_cap_reached?0:Number(tax.futa_rate||0);
      suiRate=taxStatus?.wa_sui_cap_reached?0:Number(tax.wa_sui_rate||0);
      liRate=Number(risk.employer_rate_per_hour||0);sickRate=Number(tax.sick_leave_accrual_rate||0);
    }
    const loaded=gross+gross*((ssRate||0)+(medRate||0)+(futaRate||0)+(suiRate||0))+(regular+overtime)*(liRate||0)+(regular+overtime)*baseRate*(sickRate||0);
    directCost=r(signedChangeOrderCost(costEffect as 'cost'|'credit',loaded));unit='HR';
  }
  const {error}=await supabase.from('change_order_items').insert({
    company_id:companyId,change_order_id,item_type:itemType,cost_effect:costEffect,
    cost_code_id:s(fd,'cost_code_id'),catalog_item_id:s(fd,'catalog_item_id'),crew_member_id,
    labor_task:s(fd,'labor_task'),risk_class_code:riskClass,labor_tax_year:itemType==='labor'?Number(String(co.requested_date).slice(0,4)):null,
    affected_commercial_baseline_item_id:s(fd,'affected_commercial_baseline_item_id'),description,quantity:storedQty,unit,unit_cost:itemType==='labor'?(baseRate||0):unitCost,direct_cost:directCost,
    regular_hours:storedRegular,overtime_hours:storedOvertime,base_hourly_rate_snapshot:baseRate,
    social_security_rate_snapshot:ssRate,medicare_rate_snapshot:medRate,futa_rate_snapshot:futaRate,wa_sui_rate_snapshot:suiRate,
    li_employer_rate_snapshot:liRate,sick_leave_accrual_rate_snapshot:sickRate,notes:s(fd,'notes'),sort_order:Date.now()%1000000
  });
  if(error)throw new Error(error.message);
  refresh();
}

export async function updateChangeOrder(fd:FormData){
  const id=String(fd.get('change_order_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:co}=await supabase.from('change_orders').select('status').eq('id',id).eq('company_id',companyId).single();
  if(!co||co.status!=='draft')throw new Error('Only draft Change Orders can be edited.');
  const rawPrice=String(fd.get('proposed_sell_price')||'').trim(),changeType=String(fd.get('change_type')||'additive');
  const raw=Math.abs(n(rawPrice)),sell=rawPrice===''?null:changeType==='deductive'?-raw:changeType==='no_cost'?0:raw;
  const {error:updateError}=await supabase.rpc('carez_update_change_order',{p_change_order_id:id,p_values:{
    target_margin_percent:n(fd.get('target_margin_percent')),payment_processing_rate_percent:n(fd.get('payment_processing_rate_percent')),
    proposed_sell_price:sell,field_work_status:String(fd.get('field_work_status')||'not_started')
  }});
  if(updateError)throw new Error(updateError.message);
  if(String(fd.get('status')||'draft')==='submitted'){
    const {error}=await supabase.rpc('carez_transition_change_order',{
      p_change_order_id:id,p_transition:'submit',p_note:null,
      p_authorization_kind:String(fd.get('authorization_kind')||''),p_authorization_reference:s(fd,'authorization_reference'),
      p_external_authorized_by:s(fd,'external_authorized_by'),p_external_authorized_at:s(fd,'external_authorized_at'),
      p_authorization_note:s(fd,'authorization_note'),p_authorization_document_reference:s(fd,'authorization_document_reference'),p_sell_delta:sell
    });
    if(error)throw new Error(error.message);
  }
  refresh();
}

export async function approveChangeOrder(fd:FormData){
  const id=String(fd.get('change_order_id')||'');if(!id)return;
  const {supabase}=await ctx();const {error}=await supabase.rpc('approve_change_order',{p_change_order_id:id});
  if(error)throw new Error(error.message);refresh();
}
export async function rejectChangeOrder(fd:FormData){
  const id=String(fd.get('change_order_id')||'');if(!id)return;
  const {supabase}=await ctx();const {error}=await supabase.rpc('carez_transition_change_order',{p_change_order_id:id,p_transition:'reject',p_note:s(fd,'note')});
  if(error)throw new Error(error.message);refresh();
}
export async function returnChangeOrderToDraft(fd:FormData){
  const id=String(fd.get('change_order_id')||'');if(!id)return;
  const {supabase}=await ctx();const {error}=await supabase.rpc('carez_transition_change_order',{p_change_order_id:id,p_transition:'return_to_draft',p_note:s(fd,'note')});
  if(error)throw new Error(error.message);refresh();
}
export async function voidChangeOrder(fd:FormData){
  const id=String(fd.get('change_order_id')||'');if(!id)return;
  const {supabase}=await ctx();const {error}=await supabase.rpc('carez_transition_change_order',{p_change_order_id:id,p_transition:'void',p_note:s(fd,'note')});
  if(error)throw new Error(error.message);refresh();
}
export async function deleteChangeOrderItem(fd:FormData){
  const id=String(fd.get('item_id')||''),coId=String(fd.get('change_order_id')||'');if(!id||!coId)return;
  const {supabase,companyId}=await ctx();
  const {data:co}=await supabase.from('change_orders').select('status').eq('id',coId).eq('company_id',companyId).single();
  if(co?.status!=='draft')throw new Error('Only draft Change Orders can change items.');
  const {error}=await supabase.from('change_order_items').delete().eq('id',id).eq('change_order_id',coId).eq('company_id',companyId);
  if(error)throw new Error(error.message);refresh();
}
